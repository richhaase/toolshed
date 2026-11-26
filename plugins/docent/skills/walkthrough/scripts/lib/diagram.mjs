// Diagram scenes: validate the graph and place its nodes in ranks before the page draws it.

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** `flow` is one path ['a', 'b', 'c'] or several [['a', 'b'], ['a', 'c']]. */
const flowPaths = (flow) => (flow == null ? [] : Array.isArray(flow[0]) ? flow : [flow]);

/**
 * Check a diagram scene and attach `_edges` ({ from, to, label }) and `_ranks` (node ids per
 * column or row). Ranks come from `layout` when given, otherwise from the edges: each node sits
 * one rank past its furthest upstream node.
 */
export function resolveDiagramScene(scene, where) {
  if (!Array.isArray(scene.nodes) || !scene.nodes.length) throw new Error(`${where}: a diagram scene needs a non-empty \`nodes\` array`);
  const ids = new Set();
  for (const n of scene.nodes) {
    if (!n || typeof n.id !== 'string' || !n.label) throw new Error(`${where}: every node needs a string \`id\` and a \`label\``);
    if (ids.has(n.id)) throw new Error(`${where}: duplicate node id "${n.id}"`);
    ids.add(n.id);
  }
  const known = (id, what) => {
    if (!ids.has(id)) throw new Error(`${what}: unknown node "${id}" (nodes: ${[...ids].join(', ')})`);
  };

  const edges = (scene.edges ?? []).map((e, i) => {
    const edge = Array.isArray(e) ? { from: e[0], to: e[1], label: e[2] } : { ...e };
    known(edge.from, `${where} edge ${i + 1}`);
    known(edge.to, `${where} edge ${i + 1}`);
    return edge;
  });
  const linked = (a, b) => edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));

  for (const [j, step] of scene.steps.entries()) {
    const at = `${where} step ${j + 1}`;
    for (const id of [...list(step.show), ...list(step.focus)]) known(id, at);
    for (const p of flowPaths(step.flow)) {
      if (!Array.isArray(p) || p.length < 2) throw new Error(`${at}: \`flow\` is a path of at least two node ids`);
      p.forEach((id) => known(id, at));
      for (let i = 1; i < p.length; i++) {
        if (!linked(p[i - 1], p[i])) throw new Error(`${at}: \`flow\` goes from "${p[i - 1]}" to "${p[i]}" but no edge joins them`);
      }
    }
  }

  let ranks;
  if (scene.layout) {
    ranks = scene.layout.map((r) => list(r));
    const placed = ranks.flat();
    placed.forEach((id) => known(id, `${where} layout`));
    const missing = [...ids].filter((id) => !placed.includes(id));
    if (missing.length || placed.length !== ids.size) {
      throw new Error(`${where}: \`layout\` must place every node exactly once${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
    }
  } else {
    // Walk from the nodes in the order they were declared and drop any edge that closes a
    // cycle (a retry, a feedback loop), so the first node of a loop stays upstream of the rest.
    const state = new Map();
    const forward = [];
    const walk = (id) => {
      state.set(id, 'open');
      for (const e of edges.filter((x) => x.from === id)) {
        if (state.get(e.to) === 'open') continue;
        forward.push(e);
        if (!state.has(e.to)) walk(e.to);
      }
      state.set(id, 'done');
    };
    for (const n of scene.nodes) if (!state.has(n.id)) walk(n.id);
    const rank = new Map();
    const depth = (id) => {
      if (!rank.has(id)) rank.set(id, Math.max(-1, ...forward.filter((e) => e.to === id).map((e) => depth(e.from))) + 1);
      return rank.get(id);
    };
    ranks = [];
    for (const n of scene.nodes) (ranks[depth(n.id)] ??= []).push(n.id);
    ranks = ranks.filter(Boolean);
  }

  scene._edges = edges;
  scene._ranks = ranks;
  scene._reveal = scene.steps.some((s) => s.show != null); // otherwise the whole diagram is visible from the start
}

export const diagramStep = (step) => ({
  show: list(step.show),
  focus: list(step.focus),
  flow: flowPaths(step.flow),
});
