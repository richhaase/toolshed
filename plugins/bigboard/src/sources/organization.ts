import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { classifyPullRequest } from "../pr-attention";
import type { OrganizationCollectionOptions, OrganizationPullRequestCollection, PullRequestWorkflow, QueueCollectedPullRequest } from "../pr-queue-types";
import type { PullRequestReview } from "../shared";

const execute = promisify(execFile);
const ORGANIZATION = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const REPOSITORY = /^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_.-]{1,100}$/i;
const LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,100})(?:\[bot\])?$/i;
const MAXIMUM_BYTES = 2 * 1024 * 1024;
const QUERY = `query BigBoardOrganizationPullRequests($ids:[ID!]!,$includeWorkflow:Boolean!){nodes(ids:$ids){__typename ... on PullRequest{id number title url state isDraft createdAt updatedAt mergedAt baseRefName headRefOid author{login __typename} repository{nameWithOwner} reviewDecision statusCheckRollup{state} reviewRequests(first:50){totalCount pageInfo{hasNextPage}nodes{requestedReviewer{__typename ... on User{login} ... on Team{slug organization{login}}}}} assignees(first:50){totalCount pageInfo{hasNextPage}nodes{login}} reviews(last:100)@include(if:$includeWorkflow){totalCount pageInfo{hasPreviousPage}nodes{id author{login}state submittedAt commit{oid}comments(first:1){totalCount}}} comments(last:100)@include(if:$includeWorkflow){totalCount pageInfo{hasPreviousPage}nodes{author{login}createdAt}} reviewThreads(last:100)@include(if:$includeWorkflow){totalCount pageInfo{hasPreviousPage}nodes{comments(last:10){totalCount pageInfo{hasPreviousPage}nodes{author{login}createdAt}}}} commits(last:1)@include(if:$includeWorkflow){nodes{commit{committedDate}}} timelineItems(last:50,itemTypes:[REVIEW_DISMISSED_EVENT])@include(if:$includeWorkflow){pageInfo{hasPreviousPage}nodes{... on ReviewDismissedEvent{previousReviewState review{id}}}}}}}`;

export interface OrganizationCollectorDependencies {
  token?: (signal: AbortSignal) => Promise<string>;
  request?: (url: URL, init: RequestInit) => Promise<Response>;
  maximumRequests?: number;
  maximumOpenPages?: number;
  maximumMergedPages?: number;
  batchSize?: number;
  concurrency?: number;
  requestTimeoutMs?: number;
  timeoutMs?: number;
}

type FailureKind = "auth" | "denied" | "rate" | "budget" | "search_limit" | "timeout" | "cancelled" | "size" | "response" | "unavailable";
class CollectionFailure extends Error {
  constructor(readonly kind: FailureKind) {
    super({ auth: "GitHub authentication is unavailable. Check the active GitHub CLI account with gh auth status.", denied: "GitHub denied access to part of this organization. Check organization and repository access.", rate: "GitHub rate-limited collection. Retry after the account's rate limit resets.", budget: "The GitHub request limit was reached; organization PR coverage is incomplete.", search_limit: "A GitHub PR search page limit was reached; organization PR coverage is incomplete.", timeout: "GitHub collection timed out; organization PR coverage is incomplete.", cancelled: "GitHub collection was cancelled; organization PR coverage is incomplete.", size: "Some PR detail responses exceeded the size limit; organization PR coverage is incomplete.", response: "Some organization PR evidence was unavailable or incomplete.", unavailable: "GitHub could not be reached; organization PR coverage is incomplete." }[kind]);
  }
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const date = (value: unknown): string | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const bounded = (value: number | undefined, fallback: number, maximum: number) => value === undefined || !Number.isFinite(value) ? fallback : Math.max(1, Math.min(maximum, Math.floor(value)));

async function tokenFromCLI(signal: AbortSignal): Promise<string> {
  try {
    return (await execute("gh", ["auth", "token", "--hostname", "github.com"], { encoding: "utf8", timeout: 10_000, maxBuffer: 16_384, windowsHide: true, signal })).stdout.trim();
  } catch { throw new CollectionFailure(signal.aborted ? "cancelled" : "auth"); }
}

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAXIMUM_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new CollectionFailure("size");
  }
  if (!response.body) throw new CollectionFailure("response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const part = await abortable(reader.read(), signal);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAXIMUM_BYTES) throw new CollectionFailure("size");
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error instanceof SyntaxError ? new CollectionFailure("response") : error;
  } finally { reader.releaseLock(); }
}

function connection(value: unknown, maximum: number, last = false, requireCount = true): { nodes: unknown[]; complete: boolean } {
  const row = object(value);
  const nodes = Array.isArray(row?.nodes) ? row.nodes.slice(0, maximum) : [];
  return { nodes, complete: Array.isArray(row?.nodes) && row.nodes.length <= maximum && object(row.pageInfo)?.[last ? "hasPreviousPage" : "hasNextPage"] === false && (!requireCount || row.totalCount === nodes.length) };
}

function review(row: Record<string, unknown>): PullRequestReview {
  const requests = connection(row.reviewRequests, 50);
  const assigned = connection(row.assignees, 50);
  const users: string[] = [], teams: string[] = [], assignees: string[] = [];
  for (const value of requests.nodes) {
    const actor = object(object(value)?.requestedReviewer);
    if (actor?.__typename === "User" && typeof actor.login === "string" && LOGIN.test(actor.login)) users.push(actor.login);
    else if (actor?.__typename === "Team" && typeof actor.slug === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/i.test(actor.slug) && typeof object(actor.organization)?.login === "string" && ORGANIZATION.test(String(object(actor.organization)!.login))) teams.push(`${object(actor.organization)!.login}/${actor.slug}`);
  }
  for (const value of assigned.nodes) {
    const login = object(value)?.login;
    if (typeof login === "string" && LOGIN.test(login)) assignees.push(login);
  }
  const decisions: Record<string, PullRequestReview["decision"]> = { APPROVED: "approved", CHANGES_REQUESTED: "changes_requested", REVIEW_REQUIRED: "review_required" };
  return { decision: row.reviewDecision === null ? "none" : typeof row.reviewDecision === "string" && Object.hasOwn(decisions, row.reviewDecision) ? decisions[row.reviewDecision] : "unknown", requestedReviewers: [...new Set(users)], requestedTeams: [...new Set(teams)], assignees: [...new Set(assignees)], reviewRequestsComplete: requests.complete && users.length + teams.length === requests.nodes.length && new Set([...users, ...teams].map(value => value.toLowerCase())).size === requests.nodes.length, assigneesComplete: assigned.complete && assignees.length === assigned.nodes.length && new Set(assignees.map(value => value.toLowerCase())).size === assigned.nodes.length };
}

function workflow(row: Record<string, unknown>, author: string): PullRequestWorkflow {
  const reviews = connection(row.reviews, 100, true);
  const comments = connection(row.comments, 100, true);
  const threads = connection(row.reviewThreads, 100, true);
  const events = connection(row.timelineItems, 50, true, false);
  let reviewsComplete = reviews.complete;
  const normalizedReviews: PullRequestWorkflow["reviews"] = [];
  const reviewIds = new Set<string>();
  for (const value of reviews.nodes) {
    const item = object(value), login = object(item?.author)?.login;
    if (item?.state === "PENDING" && item.submittedAt === null) continue;
    const submittedAt = date(item?.submittedAt), sha = object(item?.commit)?.oid;
    const inlineComments = object(item?.comments)?.totalCount;
    if (!item || typeof item.id !== "string" || !item.id || reviewIds.has(item.id) || typeof login !== "string" || !LOGIN.test(login) || !submittedAt || !["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"].includes(String(item.state)) || !Number.isSafeInteger(inlineComments) || Number(inlineComments) < 0) {
      reviewsComplete = false;
      continue;
    }
    reviewIds.add(item.id);
    normalizedReviews.push({ id: item.id, author: login, state: String(item.state), submittedAt, commitSha: typeof sha === "string" && /^[a-f0-9]{40,64}$/i.test(sha) ? sha : null, inlineComments: Number(inlineComments) });
  }
  let responsesComplete = comments.complete && threads.complete;
  const responseDates: string[] = [];
  const collectResponses = (nodes: unknown[]) => {
    for (const value of nodes) {
      const item = object(value), login = object(item?.author)?.login, createdAt = date(item?.createdAt);
      if (!item || typeof login !== "string" || !LOGIN.test(login) || !createdAt) { responsesComplete = false; continue; }
      if (login.toLowerCase() === author.toLowerCase()) responseDates.push(createdAt);
    }
  };
  collectResponses(comments.nodes);
  for (const value of threads.nodes) {
    const replies = connection(object(value)?.comments, 10, true);
    if (!replies.complete) responsesComplete = false;
    collectResponses(replies.nodes);
  }
  const dismissals: PullRequestWorkflow["dismissals"] = [];
  let dismissalsComplete = events.complete;
  for (const value of events.nodes) {
    const event = object(value), id = object(event?.review)?.id;
    if (typeof id !== "string" || !id || !["APPROVED", "CHANGES_REQUESTED", "COMMENTED"].includes(String(event?.previousReviewState))) { dismissalsComplete = false; continue; }
    dismissals.push({ reviewId: id, previousState: String(event!.previousReviewState) });
  }
  const commits = object(row.commits)?.nodes;
  const lastCommitAt = Array.isArray(commits) && commits.length === 1 ? date(object(object(commits[0])?.commit)?.committedDate) : null;
  const check = object(row.statusCheckRollup)?.state;
  const checks: PullRequestWorkflow["checks"] = row.statusCheckRollup === null ? "none" : check === "SUCCESS" ? "success" : check === "PENDING" || check === "EXPECTED" ? "pending" : check === "FAILURE" || check === "ERROR" ? "failure" : "unknown";
  return { reviews: normalizedReviews, reviewsComplete, lastCommitAt, lastAuthorResponseAt: responseDates.sort().at(-1) ?? null, responsesComplete, checks, dismissals, dismissalsComplete, bot: object(row.author)?.__typename === "Bot" || /\[bot\]$/i.test(author) };
}

interface Candidate { nodeId: string; repository: string; number: number; state: "open" | "merged"; authored?: boolean }

function candidate(value: unknown, organization: string, state: "open" | "merged"): Candidate | null {
  const row = object(value);
  if (!row || typeof row.node_id !== "string" || !row.node_id || row.node_id.length > 512 || row.node_id.includes("\0") || !Number.isSafeInteger(row.number) || Number(row.number) < 1 || typeof row.repository_url !== "string" || !object(row.pull_request)) return null;
  try {
    const url = new URL(row.repository_url);
    const match = /^\/repos\/([^/]+\/[^/]+)$/.exec(url.pathname);
    if (url.origin !== "https://api.github.com" || url.search || url.hash || !match || !REPOSITORY.test(match[1]) || match[1].split("/")[0].toLowerCase() !== organization || [".", ".."].includes(match[1].split("/")[1])) return null;
    return { nodeId: row.node_id, repository: match[1].toLowerCase(), number: Number(row.number), state };
  } catch { return null; }
}

function normalize(value: unknown, expected: Candidate, since: string, until: string): QueueCollectedPullRequest | null {
  const row = object(value), repository = object(row?.repository)?.nameWithOwner, login = object(row?.author)?.login;
  const createdAt = date(row?.createdAt), updatedAt = date(row?.updatedAt), mergedAt = date(row?.mergedAt);
  if (!row || row.__typename !== "PullRequest" || row.id !== expected.nodeId || row.number !== expected.number || typeof repository !== "string" || repository.toLowerCase() !== expected.repository || typeof login !== "string" || !LOGIN.test(login) || typeof row.title !== "string" || row.title.length > 10000 || !createdAt || !updatedAt || updatedAt < createdAt || typeof row.headRefOid !== "string" || !/^[a-f0-9]{40,64}$/i.test(row.headRefOid) || typeof row.baseRefName !== "string" || !row.baseRefName || typeof row.isDraft !== "boolean" || (expected.state === "open" ? row.state !== "OPEN" || row.mergedAt !== null : row.state !== "MERGED" || !mergedAt || mergedAt < createdAt || mergedAt > updatedAt || mergedAt < since || mergedAt >= until)) return null;
  return { id: `${expected.repository}#${expected.number}`, repository: expected.repository, number: expected.number, title: row.title, url: `https://github.com/${expected.repository}/pull/${expected.number}`, author: login, state: expected.state, draft: row.isDraft, createdAt, updatedAt, mergedAt: expected.state === "merged" ? mergedAt : null, baseBranch: row.baseRefName, headSha: row.headRefOid, review: review(row), workflow: workflow(row, login) };
}

export function createOrganizationPullRequestCollector(dependencies: OrganizationCollectorDependencies = {}) {
  const getToken = dependencies.token ?? tokenFromCLI;
  const transport = dependencies.request ?? ((url: URL, init: RequestInit) => fetch(url, init));
  const maximumRequests = bounded(dependencies.maximumRequests, 128, 128);
  const openPages = bounded(dependencies.maximumOpenPages, 10, 10), mergedPages = bounded(dependencies.maximumMergedPages, 4, 4);
  const batchSize = bounded(dependencies.batchSize, 20, 20), concurrency = bounded(dependencies.concurrency, 3, 3);
  return async (input: string, options: OrganizationCollectionOptions): Promise<OrganizationPullRequestCollection> => {
    const organization = input.toLowerCase();
    const since = date(options.since), until = date(options.until);
    const result: OrganizationPullRequestCollection = { organization, account: null, collectedAt: until ?? new Date().toISOString(), pullRequests: [], openComplete: false, mergedComplete: false, detailsComplete: false, error: null, accessInvalidated: false, deniedRepositories: [], scopeDenied: false, requests: 0 };
    if (!ORGANIZATION.test(organization) || !since || !until || since >= until) { result.error = "Choose a GitHub organization and a valid collection interval."; return result; }
    const deadline = AbortSignal.timeout(bounded(dependencies.timeoutMs, 120000, 120000));
    const baseSignal = AbortSignal.any([deadline, ...(options.signal ? [options.signal] : [])]);
    const authentication = new AbortController();
    const collectionSignal = AbortSignal.any([baseSignal, authentication.signal]);
    let terminal: CollectionFailure | null = null, credential = "";
    let phase: "discovering" | "details" = "discovering", completed = 0, total: number | null = null;
    const report = () => { try { options.onProgress?.({ phase, completed, total, requests: result.requests }); } catch {} };
    const fail = (kind: FailureKind) => {
      const error = new CollectionFailure(kind);
      if (["auth", "rate", "budget", "timeout", "cancelled"].includes(kind)) {
        if (!terminal || kind === "auth") terminal = error;
        if (kind === "auth") { result.accessInvalidated = true; authentication.abort(); }
      }
      return error;
    };
    const errorKind = () => options.signal?.aborted ? "cancelled" : "timeout";
    const request = async (endpoint: string, query?: Record<string,string>, ids?: string[], includeWorkflow = true): Promise<unknown> => {
      if (terminal) throw terminal;
      if (collectionSignal.aborted) throw fail(errorKind());
      if (result.requests >= maximumRequests) throw fail("budget");
      const url = new URL(`https://api.github.com/${endpoint}`);
      for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
      const signal = AbortSignal.any([collectionSignal, AbortSignal.timeout(bounded(dependencies.requestTimeoutMs, 15000, 15000))]);
      result.requests += 1;
      report();
      try {
        const response = await abortable(transport(url, { method: ids ? "POST" : "GET", headers: { Authorization: `Bearer ${credential}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "BigBoard-MCP", ...(ids ? { "Content-Type": "application/json" } : {}) }, ...(ids ? { body: JSON.stringify({ query: QUERY, variables: { ids, includeWorkflow } }) } : {}), redirect: "error", signal }), signal);
        if (response.status === 401) throw fail("auth");
        if (response.status === 429 || response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after"))) throw fail("rate");
        if (response.status === 403 || response.status === 404) throw fail("denied");
        if (!response.ok) throw fail(response.status >= 500 ? "unavailable" : "response");
        const value = await readJson(response, signal);
        if ((terminal as CollectionFailure | null)?.kind === "auth") throw terminal;
        return value;
      } catch (error) {
        if (error instanceof CollectionFailure) throw error;
        if ((terminal as CollectionFailure | null)?.kind === "auth") throw terminal;
        if (signal.aborted) throw fail(errorKind());
        throw fail("unavailable");
      }
    };
    const note = (error: unknown) => { result.error ??= error instanceof CollectionFailure ? error.message : new CollectionFailure("response").message; };
    const finish = () => {
      if ((terminal as CollectionFailure | null)?.kind === "auth" || result.accessInvalidated) { result.account = null; result.pullRequests = []; result.openComplete = false; result.mergedComplete = false; result.detailsComplete = false; result.error = new CollectionFailure("auth").message; }
      result.pullRequests.sort((a,b) => a.id.localeCompare(b.id));
      return result;
    };
    report();
    try {
      if (collectionSignal.aborted) throw fail(errorKind());
      credential = await abortable(getToken(collectionSignal), collectionSignal);
      if (!credential || credential.length > 8192 || !/^[\x21-\x7e]+$/.test(credential)) throw fail("auth");
      const user = object(await request("user"));
      if (!user || !Number.isSafeInteger(user.id) || Number(user.id) < 1 || typeof user.login !== "string" || !LOGIN.test(user.login)) throw fail("auth");
      result.account = { id: String(user.id), login: user.login };
    } catch (error) { note(error instanceof CollectionFailure ? error : fail(collectionSignal.aborted ? errorKind() : "auth")); return finish(); }
    const discovered = new Map<string, Candidate>();
    const canonical = new Map<string, string>();
    const discover = async (state: "open" | "merged", pages: number, author?: string) => {
      let valid = true, found = 0, firstCount: number | null = null;
      const seen = new Set<string>();
      try {
        for (let page = 1; page <= pages; page += 1) {
          const q = state === "open" ? `org:${organization} is:pr is:open${author ? ` author:${author}` : ""}` : `org:${organization} is:pr is:merged merged:>=${since.slice(0,10)}`;
          const response = object(await request("search/issues", { q, sort: "updated", order: "asc", per_page: "100", page: String(page) }));
          if (!response || !Array.isArray(response.items) || response.items.length > 100 || !Number.isSafeInteger(response.total_count) || Number(response.total_count) < 0 || typeof response.incomplete_results !== "boolean") throw fail("response");
          if (firstCount === null) firstCount = Number(response.total_count);
          if (response.total_count !== firstCount || response.incomplete_results) valid = false;
          for (const value of response.items) {
            const row = candidate(value, organization, state);
            const key = row ? `${row.repository}#${row.number}` : "";
            if (!row || seen.has(row.nodeId) || discovered.has(row.nodeId) && discovered.get(row.nodeId)!.state !== state || canonical.has(key) && canonical.get(key) !== row.nodeId) { valid = false; continue; }
            canonical.set(key,row.nodeId);
            row.authored = Boolean(author) || discovered.get(row.nodeId)?.authored === true;
            seen.add(row.nodeId); discovered.set(row.nodeId, row); found += 1;
          }
          if (response.items.length < 100 || page * 100 >= Number(response.total_count)) {
            if (found !== response.total_count) valid = false;
            if (!valid) note(fail("response"));
            return valid;
          }
        }
        note(new CollectionFailure("search_limit"));
        return false;
      } catch (error) { if (error instanceof CollectionFailure && error.kind === "denied") result.scopeDenied = true; note(error); return false; }
    };
    const inventories = await Promise.all([discover("open", openPages), discover("merged", mergedPages), discover("open", openPages, result.account.login)]);
    result.openComplete = inventories[0]; result.mergedComplete = inventories[1];
    if (!inventories[2]) result.openComplete = false;
    if ((terminal as CollectionFailure | null)?.kind === "auth") return finish();
    phase = "details"; total = discovered.size; report();
    const entries = [...discovered.values()].sort((a,b) => Number(b.authored === true) - Number(a.authored === true) || a.repository.localeCompare(b.repository) || a.number - b.number);
    const batches: Candidate[][] = [];
    for (const state of ["open", "merged"]) {
      const inventory = entries.filter(value => value.state === state);
      for (let index = 0; index < inventory.length; index += batchSize) batches.push(inventory.slice(index, index + batchSize));
    }
    let next = 0, detailsComplete = true;
    const deniedRepositories = new Set<string>();
    const unavailable = (items: Candidate[]) => {
      detailsComplete = false;
      if (items.some(value => value.state === "open")) result.openComplete = false;
      if (items.some(value => value.state === "merged")) result.mergedComplete = false;
    };
    const worker = async () => {
      while (next < batches.length && !terminal && !collectionSignal.aborted) {
        const batch = batches[next++];
        const active = batch.filter(value => !deniedRepositories.has(value.repository));
        completed += batch.length - active.length;
        if (!active.length) { report(); continue; }
        try {
          const response = object(await request("graphql", undefined, active.map(value => value.nodeId), active.some(value => value.state === "open")));
          const errors = Array.isArray(response?.errors) ? response.errors : [];
          const malformedFields = new Set<number>();
          for (const value of errors) {
            const issue = object(value), extensions = object(issue?.extensions), type = String(extensions?.type ?? extensions?.code ?? issue?.type ?? "").toUpperCase();
            if (["UNAUTHORIZED", "BAD_CREDENTIALS", "UNAUTHENTICATED"].includes(type)) throw fail("auth");
            const path = Array.isArray(issue?.path) ? issue.path : [];
            const index = path[0] === "nodes" && Number.isSafeInteger(path[1]) && Number(path[1]) >= 0 && Number(path[1]) < active.length ? Number(path[1]) : null;
            if (["FORBIDDEN", "NOT_FOUND"].includes(type) && (path.length <= 2 || path[2] === "repository")) {
              if (index === null) result.scopeDenied = true;
              for (const target of index === null ? active : [active[index]]) deniedRepositories.add(target.repository);
              unavailable(index === null ? active : [active[index]]);
            } else if (index !== null) { malformedFields.add(index); detailsComplete = false; }
            else detailsComplete = false;
            note(fail("response"));
          }
          const nodes = object(response?.data)?.nodes;
          if (!Array.isArray(nodes) || nodes.length !== active.length) { unavailable(active); note(fail("response")); }
          for (let index = 0; index < active.length; index += 1) {
            const expected = active[index];
            if (deniedRepositories.has(expected.repository)) continue;
            const record = normalize(Array.isArray(nodes) ? nodes[index] : null, expected, since, until);
            if (!record) { unavailable([expected]); note(fail("response")); continue; }
            if (malformedFields.has(index)) {
              record.review = { decision: "unknown", requestedReviewers: [], requestedTeams: [], assignees: [], reviewRequestsComplete: false, assigneesComplete: false };
              record.workflow = undefined;
            }
            record.attention = classifyPullRequest(record, result.account!.login);
            if (record.attention.incomplete) detailsComplete = false;
            result.pullRequests.push(record);
          }
        } catch (error) {
          if (error instanceof CollectionFailure && error.kind === "size" && active.length > 1) {
            const middle = Math.floor(active.length / 2);
            batches.splice(next,0,active.slice(0,middle),active.slice(middle));
            report();
            continue;
          }
          if (error instanceof CollectionFailure && error.kind === "denied") result.scopeDenied = true;
          unavailable(active); note(error);
        }
        completed += active.length; report();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
    if (next < batches.length) unavailable(batches.slice(next).flat());
    if (collectionSignal.aborted && !terminal) { unavailable(entries); note(fail(errorKind())); }
    if (deniedRepositories.size > 0) {
      result.deniedRepositories = [...deniedRepositories].sort();
      result.pullRequests = result.pullRequests.filter(value => !deniedRepositories.has(value.repository));
      unavailable(entries.filter(value => deniedRepositories.has(value.repository)));
      result.error = new CollectionFailure("denied").message;
    }
    result.detailsComplete = detailsComplete && result.pullRequests.length === discovered.size;
    if (!result.detailsComplete) note(fail("response"));
    return finish();
  };
}

export const collectOrganizationPullRequests = createOrganizationPullRequestCollector();
