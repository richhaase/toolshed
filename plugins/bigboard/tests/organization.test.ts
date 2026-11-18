import assert from "node:assert/strict";
import test from "node:test";
import { createOrganizationPullRequestCollector, type OrganizationCollectorDependencies } from "../src/sources/organization";

const interval = { since: "2026-10-16T00:00:00.000Z", until: "2026-11-15T00:00:00.000Z" };
const viewer = { id: 17, login: "fixture-viewer" };
const response = (value: unknown, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
const first = (nodes: unknown[]) => ({ totalCount: nodes.length, pageInfo: { hasNextPage: false }, nodes });
const last = (nodes: unknown[]) => ({ totalCount: nodes.length, pageInfo: { hasPreviousPage: false }, nodes });
const issue = (number: number, repository = "example/alpha") => ({ node_id: `${repository}#${number}`, number, repository_url: `https://api.github.com/repos/${repository}`, pull_request: { url: `https://api.github.com/repos/${repository}/pulls/${number}` } });
const search = (items: unknown[], count = items.length, incomplete = false) => response({ items, total_count: count, incomplete_results: incomplete });
const isOpen = (url: URL) => url.searchParams.get("q")!.includes("is:open");

function node(id: string, overrides: Record<string,unknown> = {}) {
  const [repository, number] = id.split("#");
  return { __typename: "PullRequest", id, number: Number(number), repository: { nameWithOwner: repository }, title: `Synthetic change ${number}`, url: `https://github.com/${repository}/pull/${number}`, state: "OPEN", isDraft: false, createdAt: "2001-01-01T00:00:00Z", updatedAt: "2026-11-14T12:00:00Z", mergedAt: null, baseRefName: "release", headRefOid: "a".repeat(40), author: { login: "fixture-contributor", __typename: "User" }, reviewDecision: null, statusCheckRollup: null, reviewRequests: first([]), assignees: first([]), reviews: last([]), comments: last([]), reviewThreads: last([]), commits: { nodes: [{ commit: { committedDate: "2026-11-13T00:00:00Z" } }] }, timelineItems: last([]), ...overrides };
}

function ids(init: RequestInit): string[] {
  const body = JSON.parse(String(init.body));
  assert.match(body.query, /^query BigBoardOrganizationPullRequests/);
  assert.doesNotMatch(body.query, /mutation/);
  assert.ok(body.variables.ids.length <= 20);
  return body.variables.ids;
}

function harness(route: (url: URL, init: RequestInit) => Response | Promise<Response>, options: Omit<OrganizationCollectorDependencies,"request" | "token"> = {}) {
  const calls: URL[] = [];
  const collect = createOrganizationPullRequestCollector({ token: async () => "synthetic-credential", request: async (url, init) => {
    calls.push(url);
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(init.redirect, "error");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer synthetic-credential");
    return url.pathname === "/user" ? response(viewer) : route(url, init);
  }, ...options });
  return { collect, calls };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "Collector did not reach the expected state.");
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

test("organization discovery needs no clones, retains old open drafts, and does not constrain merged base branches", async () => {
  const { collect, calls } = harness((url, init) => url.pathname === "/search/issues" ? search(isOpen(url) ? [issue(1)] : [issue(2)]) : response({ data: { nodes: ids(init).map(id => node(id, id.endsWith("#1") ? { isDraft: true, author: { login: "fixture-viewer", __typename: "User" } } : { state: "MERGED", mergedAt: interval.since })) } }));
  const result = await collect("EXAMPLE", interval);
  assert.deepEqual(result.account, { id: "17", login: "fixture-viewer" });
  assert.equal(result.organization, "example");
  assert.equal(result.openComplete, true);
  assert.equal(result.mergedComplete, true);
  assert.equal(result.detailsComplete, true);
  assert.deepEqual(result.pullRequests.map(pr => [pr.number, pr.state, pr.baseBranch]), [[1,"open","release"],[2,"merged","release"]]);
  assert.equal(result.pullRequests[0].createdAt, "2001-01-01T00:00:00.000Z");
  assert.equal(result.pullRequests[0].attention?.group, "other_yours");
  assert.ok(calls.filter(url => url.pathname === "/search/issues").every(url => url.searchParams.get("per_page") === "100"));
  assert.equal(calls.find(url => url.pathname === "/search/issues" && isOpen(url))!.searchParams.get("q"), "org:example is:pr is:open");
});

test("full organization pagination validates counts, canonical identities, and search truncation", async () => {
  const paged = harness((url, init) => {
    if (url.pathname === "/graphql") return response({ data: { nodes: ids(init).map(id => node(id)) } });
    if (!isOpen(url)) return search([]);
    return url.searchParams.get("page") === "1" ? search(Array.from({ length: 100 }, (_, index) => issue(index + 1)), 101) : search([issue(101)],101);
  });
  const result = await paged.collect("example", interval);
  assert.equal(result.pullRequests.length,101);
  assert.equal(result.openComplete,true);
  const capped = harness((url, init) => url.pathname === "/graphql" ? response({ data: { nodes: ids(init).map(id => node(id)) } }) : isOpen(url) ? search(Array.from({ length:100 },(_,index)=>issue(index+1)),101) : search([]), { maximumOpenPages:1 });
  const cappedResult=await capped.collect("example", interval);
  assert.equal(cappedResult.openComplete,false);
  assert.match(cappedResult.error!,/search page limit/);
  const malformed = harness((url,init) => url.pathname === "/graphql" ? response({ data:{ nodes:ids(init).map(id=>node(id)) } }) : isOpen(url) ? search([issue(1),issue(1),issue(2,"outside/alpha")],3,true) : search([]));
  const partial = await malformed.collect("example",interval);
  assert.equal(partial.openComplete,false);
  assert.equal(partial.pullRequests.length,1);
  assert.match(partial.error!,/incomplete/);
});

test("review history, dismissal provenance, author replies, and checks are collected with explicit completeness", async () => {
  const { collect } = harness((url,init) => url.pathname === "/search/issues" ? search(isOpen(url) ? [issue(1),issue(2)] : []) : response({ data:{ nodes:ids(init).map(id=>node(id, { author:{ login:"fixture-viewer",__typename:"User" }, reviewDecision:"CHANGES_REQUESTED", reviews:last([{ id:"review-1",author:{login:"fixture-reviewer"},state:"CHANGES_REQUESTED",submittedAt:"2026-11-14T08:00:00Z",commit:{oid:"a".repeat(40)},comments:{totalCount:1}}]), comments:last([{author:{login:"fixture-viewer"},createdAt:"2026-11-14T09:00:00Z"}]), reviewThreads:last([{ comments:{ ...last([{author:{login:"fixture-viewer"},createdAt:"2026-11-14T10:00:00Z"}]), ...(id.endsWith("#2") ? {totalCount:20,pageInfo:{hasPreviousPage:true}} : {}) } }]), statusCheckRollup:{state:"PENDING"},timelineItems:last([{review:{id:"review-1"},previousReviewState:"APPROVED"}]) })) } }));
  const result=await collect("example",interval);
  const firstPR=result.pullRequests[0], secondPR=result.pullRequests[1];
  assert.equal(firstPR.workflow?.lastAuthorResponseAt,"2026-11-14T10:00:00.000Z");
  assert.equal(firstPR.workflow?.checks,"pending");
  assert.equal(firstPR.workflow?.reviews[0].commitSha,"a".repeat(40));
  assert.deepEqual(firstPR.workflow?.dismissals,[{reviewId:"review-1",previousState:"APPROVED"}]);
  assert.equal(firstPR.attention?.group,"awaiting_reviewer");
  assert.equal(secondPR.workflow?.responsesComplete,false);
  assert.equal(secondPR.attention?.group,"other_yours");
  assert.equal(result.detailsComplete,false);
  assert.equal(result.openComplete,true);
});

test("authored open discovery has no date cutoff and retains owned work beyond the bounded organization inventory", async () => {
  const { collect, calls } = harness((url, init) => {
    if (url.pathname === "/graphql") return response({ data: { nodes: ids(init).map(id => node(id, id.endsWith("#1001") ? { author: { login: "fixture-viewer", __typename: "User" }, isDraft: true } : {})) } });
    if (!isOpen(url)) return search([]);
    if (url.searchParams.get("q")!.includes("author:")) return search([issue(1001)]);
    return search(Array.from({ length: 100 }, (_, index) => issue(index + 1)), 1500);
  }, { maximumOpenPages: 1 });
  const result = await collect("example", interval);
  assert.equal(result.openComplete, false);
  assert.equal(result.pullRequests.length, 101);
  assert.equal(result.pullRequests.find(pr => pr.number === 1001)?.attention?.group, "other_yours");
  const authored = calls.find(url => url.pathname === "/search/issues" && url.searchParams.get("q")!.includes("author:"))!;
  assert.equal(authored.searchParams.get("q"), "org:example is:pr is:open author:fixture-viewer");
  assert.doesNotMatch(authored.searchParams.get("q")!, /updated:|created:/);
});

test("GraphQL field errors retain visible authored inventory with unknown details while identity changes do not attach evidence", async () => {
  const { collect }=harness((url,init)=>url.pathname==="/search/issues" ? search(isOpen(url)?[issue(1),issue(2)]:[]) : response({data:{nodes:ids(init).map(id=>node(id,{author:{login:"fixture-viewer",__typename:"User"},...(id.endsWith("#2")?{number:999}:{})}))},errors:[{path:["nodes",0,"reviews"],extensions:{type:"FORBIDDEN"}}]}));
  const result=await collect("example",interval);
  assert.equal(result.pullRequests.length,1);
  assert.equal(result.pullRequests[0].review?.decision,"unknown");
  assert.equal(result.pullRequests[0].workflow,undefined);
  assert.equal(result.pullRequests[0].attention?.group,"other_yours");
  assert.equal(result.openComplete,false);
  assert.equal(result.detailsComplete,false);
  assert.equal(result.scopeDenied,false);
  assert.deepEqual(result.deniedRepositories,[]);
});

test("organization enrichment uses no more than three concurrent requests and keeps progress monotonic",async()=>{
  const gate=deferred();
  let active=0,maximum=0,graphs=0;
  const progress:Array<{completed:number;requests:number}>=[];
  const {collect}=harness(async(url,init)=>{
    if(url.pathname==="/search/issues")return search(isOpen(url)?Array.from({length:64},(_,index)=>issue(index+1)):[]);
    graphs+=1;active+=1;maximum=Math.max(maximum,active);
    await gate.promise;active-=1;
    return response({data:{nodes:ids(init).map(id=>node(id))}});
  },{concurrency:99});
  const pending=collect("example",{...interval,onProgress:value=>progress.push(value)});
  await waitFor(()=>graphs===3);
  assert.equal(active,3);gate.resolve();
  const result=await pending;
  assert.equal(maximum,3);assert.equal(graphs,4);assert.equal(result.pullRequests.length,64);
  assert.equal(progress.at(-1)?.completed,64);
  assert.ok(progress.every((value,index)=>index===0||value.completed>=progress[index-1].completed&&value.requests>=progress[index-1].requests));
});

test("oversized detail responses split into bounded smaller batches without dropping records or double-counting progress",async()=>{
  for (const streaming of [false,true]) {
    const batchLengths:number[]=[],progress:Array<{completed:number;total:number|null;requests:number}>=[];
    const {collect}=harness((url,init)=>{
      if(url.pathname==="/search/issues")return search(isOpen(url)?Array.from({length:20},(_,index)=>issue(index+1)):[]);
      const batch=ids(init);batchLengths.push(batch.length);
      const value={data:{nodes:batch.map(id=>node(id))}};
      if(batch.length>10)return streaming?response({...value,padding:"x".repeat(2*1024*1024)}):response(value,200,{"content-length":String(2*1024*1024+1)});
      return response(value);
    });
    const result=await collect("example",{...interval,onProgress:value=>progress.push(value)});
    assert.deepEqual(batchLengths,[20,10,10]);
    assert.equal(result.pullRequests.length,20);
    assert.equal(new Set(result.pullRequests.map(pr=>pr.id)).size,20);
    assert.equal(result.openComplete,true);assert.equal(result.detailsComplete,true);assert.equal(result.error,null);
    assert.equal(result.requests,7);
    assert.equal(progress.at(-1)?.completed,20);
    assert.ok(progress.every((value,index)=>value.completed<=20&&(index===0||value.completed>=progress[index-1].completed&&value.requests>=progress[index-1].requests)));
  }
});

test("oversized leaf failures stay partial and recursive splits honor the shared request budget without retrying other errors",async()=>{
  const progress:number[]=[];
  const leaves=harness((url,init)=>{
    if(url.pathname==="/search/issues")return search(isOpen(url)?Array.from({length:8},(_,index)=>issue(index+1)):[]);
    const batch=ids(init);
    return batch.length>1||batch[0].endsWith("#3")?response({},200,{"content-length":String(2*1024*1024+1)}):response({data:{nodes:batch.map(id=>node(id))}});
  });
  const partial=await leaves.collect("example",{...interval,onProgress:value=>progress.push(value.completed)});
  assert.equal(partial.pullRequests.length,7);assert.equal(partial.openComplete,false);assert.equal(partial.detailsComplete,false);assert.match(partial.error!,/size limit/);
  assert.equal(progress.at(-1),8);assert.ok(progress.every(value=>value<=8));
  const capped=harness(url=>url.pathname==="/search/issues"?search(isOpen(url)?Array.from({length:20},(_,index)=>issue(index+1)):[]):response({},200,{"content-length":String(2*1024*1024+1)}),{maximumRequests:6});
  const limited=await capped.collect("example",interval);
  assert.equal(limited.requests,6);assert.equal(capped.calls.length,6);assert.match(limited.error!,/request limit/);assert.equal(limited.openComplete,false);
  let failedBatches=0;
  const unavailable=harness(url=>{
    if(url.pathname==="/search/issues")return search(isOpen(url)?Array.from({length:20},(_,index)=>issue(index+1)):[]);
    failedBatches+=1;return response({},500);
  });
  await unavailable.collect("example",interval);
  assert.equal(failedBatches,1);
});

test("merged-only batches omit expensive workflow connections while retaining complete basic review metadata",async()=>{
  const workflowFlags:boolean[]=[];
  const {collect}=harness((url,init)=>{
    if(url.pathname==="/search/issues")return search(isOpen(url)?[issue(1)]:Array.from({length:20},(_,index)=>issue(index+101)));
    const batch=ids(init),body=JSON.parse(String(init.body));
    assert.equal(typeof body.variables.includeWorkflow,"boolean");workflowFlags.push(body.variables.includeWorkflow);
    assert.match(body.query,/\$includeWorkflow:Boolean!/);
    assert.match(body.query,/reviews\(last:100\)@include\(if:\$includeWorkflow\)/);
    return response({data:{nodes:batch.map(id=>{
      const value:Record<string,unknown>=node(id,id.endsWith("#1")?{}:{state:"MERGED",mergedAt:interval.since});
      if(!body.variables.includeWorkflow){
        delete value.reviews;delete value.comments;delete value.reviewThreads;delete value.commits;delete value.timelineItems;
      }
      return value;
    })}});
  });
  const result=await collect("example",interval);
  assert.deepEqual(workflowFlags,[true,false]);
  assert.equal(result.pullRequests.length,21);assert.equal(result.openComplete,true);assert.equal(result.mergedComplete,true);assert.equal(result.detailsComplete,true);
  const merged=result.pullRequests.filter(pr=>pr.state==="merged");
  assert.ok(merged.every(pr=>pr.review?.reviewRequestsComplete&&pr.review.assigneesComplete&&pr.review.decision==="none"));
  assert.ok(merged.every(pr=>pr.attention?.incomplete===false));
});

test("overlapping authentication denial purges successful batches and ignores late responses",async()=>{
  const fail=deferred(),late=deferred();let graphs=0;
  const {collect}=harness(async(url,init)=>{
    if(url.pathname==="/search/issues")return search(isOpen(url)?Array.from({length:60},(_,index)=>issue(index+1)):[]);
    const index=graphs++;
    if(index===1){await fail.promise;return response({},401);}
    if(index===2)await late.promise;
    return response({data:{nodes:ids(init).map(id=>node(id))}});
  });
  const pending=collect("example",interval);
  await waitFor(()=>graphs===3);fail.resolve();
  const result=await pending;late.resolve();
  assert.equal(result.account,null);assert.equal(result.accessInvalidated,true);
  assert.deepEqual(result.pullRequests,[]);assert.equal(result.openComplete,false);
  assert.doesNotMatch(JSON.stringify(result),/synthetic-credential/);
});

test("repository denial purges its earlier records and retains permitted organization repositories",async()=>{
  const {collect}=harness((url,init)=>{
    if(url.pathname==="/search/issues")return search(isOpen(url)?[issue(1),issue(2,"example/beta"),issue(3,"example/beta")]:[]);
    const batch=ids(init);
    return batch[0].endsWith("#3")?response({data:{nodes:[null]},errors:[{path:["nodes",0],extensions:{type:"FORBIDDEN"}}]}):response({data:{nodes:batch.map(id=>node(id))}});
  },{batchSize:1});
  const result=await collect("example",interval);
  assert.deepEqual(result.pullRequests.map(pr=>pr.repository),["example/alpha"]);
  assert.equal(result.openComplete,false);assert.equal(result.accessInvalidated,false);
  assert.equal(result.scopeDenied,false);
  assert.deepEqual(result.deniedRepositories,["example/beta"]);
  assert.match(result.error!,/denied/);
});

test("organization discovery and GraphQL transport denial have explicit scope-denial signals",async()=>{
  const deniedSearch=harness(()=>response({},403));
  const discovery=await deniedSearch.collect("example",interval);
  assert.equal(discovery.scopeDenied,true);
  assert.deepEqual(discovery.deniedRepositories,[]);
  assert.equal(discovery.account?.login,viewer.login);
  assert.equal(discovery.openComplete,false);
  const deniedDetails=harness(url=>url.pathname==="/search/issues"?search(isOpen(url)?[issue(1)]:[]):response({},403));
  const detail=await deniedDetails.collect("example",interval);
  assert.equal(detail.scopeDenied,true);
  assert.equal(detail.accessInvalidated,false);
  assert.deepEqual(detail.pullRequests,[]);
});

test("request budgets, large bodies, and rate limits remain bounded and explicit",async()=>{
  const budget=harness(url=>search(isOpen(url)?[issue(1)]:[]),{maximumRequests:4});
  const bounded=await budget.collect("example",interval);
  assert.equal(budget.calls.length,4);assert.equal(bounded.openComplete,false);assert.match(bounded.error!,/request limit/);
  const oversized=harness((url,init)=>url.pathname==="/search/issues"?search(isOpen(url)?[issue(1)]:[]):response({data:{nodes:ids(init).map(id=>node(id))}},200,{"content-length":String(2*1024*1024+1)}));
  assert.equal((await oversized.collect("example",interval)).detailsComplete,false);
  const rate=harness(()=>response({},403,{"x-ratelimit-remaining":"0"}));
  const limited=await rate.collect("example",interval);
  assert.match(limited.error!,/rate-limited/);assert.ok(rate.calls.length<=4);
});

test("cancellation, timeouts, invalid organizations, and invalid credentials never leak diagnostics",async()=>{
  let called=false;
  const invalid=createOrganizationPullRequestCollector({token:async()=>{called=true;return "secret";}});
  assert.match((await invalid("outside/organization",interval)).error!,/Choose a GitHub organization/);assert.equal(called,false);
  const canceled=new AbortController();canceled.abort();
  assert.match((await invalid("example",{...interval,signal:canceled.signal})).error!,/cancelled/);assert.equal(called,false);
  const timed=harness(()=>new Promise(()=>{}),{requestTimeoutMs:10,timeoutMs:20});
  assert.match((await timed.collect("example",interval)).error!,/timed out/);
  const denied=createOrganizationPullRequestCollector({token:async()=>{throw new Error("private diagnostic credential");}});
  const result=await denied("example",interval);
  assert.equal(result.accessInvalidated,true);
  assert.doesNotMatch(JSON.stringify(result),/private diagnostic credential/);
});
