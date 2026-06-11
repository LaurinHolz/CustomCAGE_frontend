// ─────────────────────────────────────────────────────────────────────────────
// Mock data for the Verification Tree view.
//
// This SIMULATES the output of mini_CAGE/verificator/FV_pipeline.py. That
// pipeline performs a BFS over the policy-induced state space and accumulates an
// `induced_chain`, a mapping
//
//     tuple(true_state)  ->  [ (tuple(child_true_state), prob, restore_stats, 1), ... ]
//
// where every node is a PRISM "true state" (a set of active labels such as
// "phase_0" and "{host}_state{n}") and every edge corresponds to one full step
// (a candidate Blue action followed by the Red response), with
// prob = p_blue * p_red.
//
// The real pipeline is not yet producing a correct tree; this module hand-builds
// a representative tree with the SAME semantics so the frontend can render and
// display it. Replace `VERIFICATION_TREE` with live pipeline output when ready.
// ─────────────────────────────────────────────────────────────────────────────

export const TREE_META = {
  attacker: "meander",
  target: "Op_Server0",
  entryPoint: "User0",
  partialObs: false,
  kActions: 2, // top-k Blue actions branched at each decision point
  maxDepth: 4,
  subnets: {
    User: ["User0", "User1", "User2", "User3", "User4"],
    Enterprise: ["Enterprise0", "Enterprise1", "Enterprise2"],
    Operational: ["Op_Server0", "Op_Host0", "Op_Host1", "Op_Host2"],
  },
};

// Host -> subnet lookup, derived from the topology above.
const HOST_TO_SUBNET = Object.entries(TREE_META.subnets).reduce(
  (acc, [subnet, hosts]) => {
    hosts.forEach((h) => (acc[h] = subnet));
    return acc;
  },
  {}
);

// Compromise level legend (mirrors PRISM "{host}_state{n}" labels):
//   0 = clean, 2 = scanned, 4 = user access (exploited), 6 = root / impacted.
const STATE6 = 6; // target impact level -> Red "wins" this branch.

// ── Deterministic pseudo-random generator ──────────────────────────────────
// Keeps the mock tree stable across reloads while still looking like BFS output.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let _autoId = 0;
const nextId = () => `n${_autoId++}`;

// Pretty short summary of which hosts Red currently holds, for node labels.
function compromiseLabels(compromised) {
  return Object.entries(compromised)
    .filter(([, lvl]) => lvl >= 2)
    .map(([host, lvl]) => `${host}_state${lvl}`);
}

function emptyRestoreStats() {
  const subnets = {};
  Object.keys(TREE_META.subnets).forEach((s) => (subnets[s] = 0));
  const hosts = {};
  Object.values(TREE_META.subnets)
    .flat()
    .forEach((h) => (hosts[h] = 0));
  return { total: 0, subnets, hosts };
}

// Candidate Blue actions the policy might take given the current compromise map.
// Returns up to k actions, each with a synthetic policy probability p_blue.
function candidateBlueActions(compromised, rng, k) {
  const held = Object.entries(compromised)
    .filter(([, lvl]) => lvl >= 4)
    .map(([host]) => host);

  const actions = [];
  // Restore / Remove the most-compromised hosts first (highest policy mass).
  held
    .sort((a, b) => compromised[b] - compromised[a])
    .forEach((host) => {
      const kind = compromised[host] >= STATE6 ? "restore" : "remove";
      actions.push({ kind, host });
    });
  // Always consider an Analyse and a Decoy as plausible alternatives.
  const scanned = Object.entries(compromised)
    .filter(([, lvl]) => lvl === 2)
    .map(([host]) => host);
  if (scanned.length) actions.push({ kind: "analyse", host: scanned[0] });
  actions.push({ kind: "decoy", host: "Enterprise1" });
  if (actions.length === 0) actions.push({ kind: "sleep", host: null });

  // Assign a softmax-ish probability mass, normalise over the top-k.
  const top = actions.slice(0, k);
  const weights = top.map((_, i) => Math.pow(0.6, i) * (0.8 + 0.4 * rng()));
  const z = weights.reduce((a, b) => a + b, 0);
  return top.map((a, i) => ({ ...a, p: weights[i] / z }));
}

// Apply a Blue action to the compromise map, returning a NEW map + restore stats.
function applyBlue(compromised, action) {
  const next = { ...compromised };
  const stats = emptyRestoreStats();
  if (action.kind === "restore" && action.host) {
    next[action.host] = 0;
    stats.total = 1;
    stats.hosts[action.host] = 1;
    stats.subnets[HOST_TO_SUBNET[action.host]] = 1;
  } else if (action.kind === "remove" && action.host) {
    // Remove knocks user-level access back to "scanned", not fully clean.
    next[action.host] = Math.min(next[action.host], 2);
  }
  return { next, stats };
}

// Red response: with some probability Red advances the frontier toward the
// target; otherwise it consolidates. Returns 1-2 outcome branches with p_red.
function redResponses(compromised, rng) {
  const target = TREE_META.target;
  const allHosts = Object.values(TREE_META.subnets).flat();

  // Find Red's frontier: clean/scanned hosts adjacent (by subnet order) to held.
  const frontier = allHosts.filter((h) => (compromised[h] ?? 0) < 4);

  const outcomes = [];

  // Primary branch: Red escalates on the highest-value reachable host.
  const escalateTarget =
    frontier.find((h) => h === target && compromised[h] >= 4) ||
    frontier.find((h) => compromised[h] >= 2) ||
    frontier[0];

  if (escalateTarget) {
    const adv = { ...compromised };
    const cur = adv[escalateTarget] ?? 0;
    adv[escalateTarget] =
      escalateTarget === target && cur >= 4 ? STATE6 : Math.min(cur + 2, STATE6);
    outcomes.push({ next: adv, p: 0.65 + 0.2 * rng(), kind: "escalate" });
  }

  // Secondary branch: Red scans a fresh host (lateral movement).
  const fresh = frontier.find((h) => (compromised[h] ?? 0) === 0);
  if (fresh) {
    const scan = { ...compromised };
    scan[fresh] = 2;
    outcomes.push({ next: scan, p: 0.35, kind: "scan" });
  }

  if (outcomes.length === 0) {
    outcomes.push({ next: { ...compromised }, p: 1, kind: "sleep" });
  }
  // Normalise p_red over the branches.
  const z = outcomes.reduce((a, o) => a + o.p, 0);
  return outcomes.map((o) => ({ ...o, p: o.p / z }));
}

function classify(compromised) {
  if ((compromised[TREE_META.target] ?? 0) >= STATE6) return "impacted";
  const anyHeld = Object.entries(compromised).some(
    ([h, lvl]) => h !== TREE_META.entryPoint && lvl >= 4
  );
  return anyHeld ? "progress" : "safe";
}

// Recursively build the induced tree.
function buildNode({ compromised, depth, edge, rng }) {
  const status = classify(compromised);
  const node = {
    id: nextId(),
    depth,
    status,
    compromised,
    labels: compromiseLabels(compromised),
    // Edge metadata: how we got here from the parent.
    prob: edge?.prob ?? 1,
    blueAction: edge?.blueAction ?? null,
    redOutcome: edge?.redOutcome ?? null,
    restoreStats: edge?.restoreStats ?? emptyRestoreStats(),
    children: [],
  };

  const terminal = depth >= TREE_META.maxDepth || status === "impacted";
  if (terminal) return node;

  const blueActions = candidateBlueActions(compromised, rng, TREE_META.kActions);
  for (const blue of blueActions) {
    const { next: afterBlue, stats } = applyBlue(compromised, blue);
    const reds = redResponses(afterBlue, rng);
    for (const red of reds) {
      const prob = blue.p * red.p;
      if (prob < 0.02) continue; // BFS-style pruning of negligible branches.
      node.children.push(
        buildNode({
          compromised: red.next,
          depth: depth + 1,
          rng,
          edge: {
            prob,
            blueAction: blue,
            redOutcome: red.kind,
            restoreStats: stats,
          },
        })
      );
    }
  }
  return node;
}

function buildTree() {
  _autoId = 0;
  const rng = makeRng(0xc0ffee);
  // Initial state: Red has user-level access on the entry host only.
  const initial = {};
  Object.values(TREE_META.subnets)
    .flat()
    .forEach((h) => (initial[h] = 0));
  initial[TREE_META.entryPoint] = 4;
  return buildNode({ compromised: initial, depth: 0, edge: null, rng });
}

export const VERIFICATION_TREE = buildTree();

// Convenience: flat stats about the generated tree (shown in the header).
export function treeStats(root = VERIFICATION_TREE) {
  let nodes = 0;
  let leaves = 0;
  let impacted = 0;
  let maxDepth = 0;
  const walk = (n) => {
    nodes += 1;
    maxDepth = Math.max(maxDepth, n.depth);
    if (n.status === "impacted") impacted += 1;
    if (!n.children.length) leaves += 1;
    n.children.forEach(walk);
  };
  walk(root);
  return { nodes, leaves, impacted, maxDepth };
}
