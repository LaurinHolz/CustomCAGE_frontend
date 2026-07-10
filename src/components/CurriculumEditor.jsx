import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import FileBrowserModal from "./FileBrowserModal";

// Scripted red opponents. Keys must match train_no_vis.SCRIPTED_RED_AGENTS.
export const RED_AGENTS = [
  { key: "meander",  icon: "🌀", name: "Meander",  desc: "Methodical lateral movement" },
  { key: "bline",    icon: "🎯", name: "B-line",   desc: "Beelines to the ops server" },
  { key: "random",   icon: "🎲", name: "Random",   desc: "Valid actions at random" },
  { key: "slowburn", icon: "🐌", name: "SlowBurn", desc: "Meander with idle dwell" },
];
const RED_BY_KEY = Object.fromEntries(RED_AGENTS.map((a) => [a.key, a]));

const BLUE = "#3B8BD4";
const RED  = "#E04B4A";
const PPO  = "#9B78F0";
const REF  = "#2FB8A8";   // reference to a checkpoint trained by an earlier phase
const WARN = "#F5A623";   // "needs attention" amber for the connect-me pulses
const TEXT_PRIMARY   = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

// Canvas + phase geometry (px).
const CANVAS_W = 2400, CANVAS_H = 1600;
const PHASE_W = 360, MIN_W = 280, MIN_H = 150;
const PAD = 12, LANE_GAP = 44;
const HEADER_H = 42, LANE_HEADER_H = 28, NODE_H = 52, NODE_GAP = 8, PAD_BOTTOM = 14;

export function basename(p) {
  if (!p) return "";
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// Short, ctx-free descriptor of a node's source (used inside trained labels).
function shortKind(n) {
  return n.kind === "scratch"  ? "from scratch"
    : n.kind === "scripted"    ? (RED_BY_KEY[n.key]?.name || n.key)
    : n.kind === "ppo"         ? (basename(n.ckpt) || "checkpoint")
    : n.kind === "ref"         ? "continued"
    : "unconfigured";
}

export function describe(m, ctx) {
  const d = _describeKind(m, ctx);
  const custom = (m.name || "").trim();
  return custom ? { ...d, label: custom } : d;
}

function _describeKind(m, ctx) {
  if (m.kind === "ref") {
    const info = ctx?.trainedLabelById?.[m.refNodeId];
    return { icon: "🎓", label: info?.label || "Trained output",
             sub: info ? `Trained · ${info.sub}` : "Checkpoint from an earlier phase",
             tag: { text: "Trained", color: REF } };
  }
  if (m.kind === "ppo")
    return { icon: "🧠", label: m.ckpt ? basename(m.ckpt) : "Choose checkpoint…",
             sub: m.ckpt || "No checkpoint selected", tag: { text: "PPO", color: PPO } };
  if (m.kind === "scripted") {
    const a = RED_BY_KEY[m.key];
    return { icon: a?.icon || "⚙️", label: a?.name || m.key, sub: a?.desc || "",
             tag: { text: "Scripted", color: RED } };
  }
  if (m.kind === "scratch")
    return { icon: "✨", label: "From scratch", sub: "Random init", tag: { text: "Scratch", color: "#8A93A6" } };
  return { icon: "➕", label: "Unconfigured", sub: "Click to configure", tag: { text: "Empty", color: "rgba(255,255,255,0.35)" } };
}
const isConfigured = (m) =>
  m.kind === "scripted" ? !!m.key
  : m.kind === "ppo"    ? (!!m.ckpt && Number(m.dims) > 0)
  : m.kind === "ref"    ? !!m.refNodeId
  : m.kind === "scratch";

// Phases reachable as ancestors of `phaseId` through the chain edges.
function ancestorsOf(phaseId, phaseEdges) {
  const parents = {};
  phaseEdges.forEach((e) => { (parents[e.to] ||= []).push(e.from); });
  const seen = new Set();
  const stack = [...(parents[phaseId] || [])];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    (parents[p] || []).forEach((x) => stack.push(x));
  }
  return seen;
}

// Short display name of the agent a node represents — a custom name wins, a
// "ref" inherits the label of the trained agent it continues (mirrors the
// backend's curriculum_runner._node_label so previews match reality).
export function nodeLabel(n, byId, seen) {
  if (!n) return "agent";
  const custom = (n.name || "").trim();
  if (custom) return custom;
  if (n.kind === "scripted") return RED_BY_KEY[n.key]?.name || n.key || "scripted";
  if (n.kind === "ppo") return basename(n.ckpt) || "checkpoint";
  if (n.kind === "ref") {
    const s = seen || new Set();
    const r = byId?.[n.refNodeId];
    if (r && !s.has(n.refNodeId)) return nodeLabel(r, byId, new Set([...s, n.refNodeId]));
    return "trained";
  }
  if (n.kind === "scratch") return "from scratch";
  return "unconfigured";
}

// Opposite-role nodes linked to `nid` by a matchup arrow (either direction).
function opponentsOf(nid, byId, edges) {
  const linked = new Set();
  edges.forEach((e) => { if (e.from === nid) linked.add(e.to); else if (e.to === nid) linked.add(e.from); });
  const node = byId[nid];
  return [...linked].map((i) => byId[i]).filter((o) => o && o.role !== node?.role);
}

// Phases in chain order (Kahn); leftovers/cycles keep input order.
function phaseTopoOrder(phases, phaseEdges) {
  const ids = phases.map((p) => p.id);
  const idset = new Set(ids);
  const indeg = {}, adj = {};
  ids.forEach((i) => { indeg[i] = 0; adj[i] = []; });
  phaseEdges.forEach((e) => {
    if (idset.has(e.from) && idset.has(e.to)) { adj[e.from].push(e.to); indeg[e.to]++; }
  });
  const q = ids.filter((i) => indeg[i] === 0), order = [], seen = new Set();
  while (q.length) {
    const i = q.shift(); order.push(i); seen.add(i);
    adj[i].forEach((j) => { if (--indeg[j] === 0) q.push(j); });
  }
  ids.forEach((i) => { if (!seen.has(i)) order.push(i); });
  const byId = Object.fromEntries(phases.map((p) => [p.id, p]));
  return order.map((i) => byId[i]);
}

/**
 * Preview of how the curriculum's training jobs distribute across GPUs — the
 * plan the backend scheduler realizes when Train is clicked: independent jobs
 * run concurrently (one per free GPU) and dependents queue behind them.
 *
 * `gpuIds` is the snapshot of free GPU indices ([] → one sequential CPU lane).
 * Jobs are walked in phase-chain order (a valid topological order, since a node
 * only ever references a trained agent from an ancestor phase) and each is
 * placed on the least-loaded lane, so the first N independent jobs land on N
 * distinct GPUs. Returns { jobs, byNode } where each job carries its gpu, its
 * 0-based queue position on that gpu, and the agents it depends on.
 */
export function planSchedule(cur, gpuIds) {
  const { phases = [], nodes = [], edges = [], phaseEdges = [] } = cur || {};
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const order = phaseTopoOrder(phases, phaseEdges);

  const jobs = [];
  order.forEach((ph) => {
    nodes.filter((n) => n.phaseId === ph.id && n.role === ph.trainingSide)
      .forEach((n) => jobs.push({ nodeId: n.id, phaseId: ph.id, phaseName: ph.name, role: n.role, node: n }));
  });
  const jobByNode = {};
  jobs.forEach((j, i) => { jobByNode[j.nodeId] = i; });

  jobs.forEach((j) => {
    const refs = [];
    if (j.node.kind === "ref") refs.push(j.node.refNodeId);
    opponentsOf(j.nodeId, byId, edges).forEach((o) => { if (o.kind === "ref") refs.push(o.refNodeId); });
    j.depNodeIds = refs.filter((r) => jobByNode[r] !== undefined && r !== j.nodeId);
  });

  const lanes = (gpuIds && gpuIds.length) ? gpuIds.map((g) => ({ gpu: g, count: 0 }))
                                          : [{ gpu: null, count: 0 }];
  jobs.forEach((j) => {
    let li = 0;
    for (let k = 1; k < lanes.length; k++) if (lanes[k].count < lanes[li].count) li = k;
    j.laneIdx = li;
    j.gpuId = lanes[li].gpu;
    j.gpuLabel = lanes[li].gpu == null ? "CPU (sequential)" : `GPU ${lanes[li].gpu}`;
    j.queuePos = lanes[li].count;
    lanes[li].count++;
  });

  const out = jobs.map((j) => ({
    nodeId: j.nodeId, phaseId: j.phaseId, phaseName: j.phaseName, role: j.role,
    label: nodeLabel(j.node, byId),
    depNodeIds: j.depNodeIds,
    depLabels: j.depNodeIds.map((r) => nodeLabel(byId[r], byId)),
    gpuId: j.gpuId, gpuLabel: j.gpuLabel, queuePos: j.queuePos, laneIdx: j.laneIdx,
  }));
  return { jobs: out, byNode: Object.fromEntries(out.map((j) => [j.nodeId, j])) };
}

// Fetch the live free-GPU snapshot the plan is built against.
export async function fetchGpuInfo() {
  try {
    const res = await fetch("http://127.0.0.1:9999/gpu-info");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { cuda: false, count: 0, free: [] };
  }
}

let _autoId = 1;
const nid = () => `n${Date.now().toString(36)}${_autoId++}`;
const pid = () => `p${Date.now().toString(36)}${_autoId++}`;

export const DEFAULT_CURRICULUM = {
  phases: [{ id: "p1", name: "PHASE_1", x: 80, y: 80, trainingSide: "defender" }],
  nodes: [
    { id: "d1", phaseId: "p1", role: "defender", kind: "scratch",  dims: 78 },
    { id: "a1", phaseId: "p1", role: "attacker", kind: "scripted", key: "meander", dims: 78 },
  ],
  edges: [{ id: "e1", from: "d1", to: "a1" }],
  phaseEdges: [],
};

// Recommended PPO input-dims for a given topology, per role:
//   blue observation = 6 × hosts   (activity+safety per host, scan, decoy)
//   red observation  = 1 + 3 × hosts (red_success + per-host state)
export function recommendedDims(role, hostCount) {
  const h = hostCount || 0;
  if (h < 1) return role === "defender" ? 78 : 40;
  return role === "defender" ? 6 * h : 1 + 3 * h;
}

// Derive a runnable single-matchup team list from the first (root) phase.
export function deriveRun(cur) {
  const { phases, nodes, edges, phaseEdges } = cur;
  if (!phases.length) return { members: [] };
  const incoming = new Set(phaseEdges.map((e) => e.to));
  const root = phases.find((p) => !incoming.has(p.id)) || phases[0];
  const pn = nodes.filter((n) => n.phaseId === root.id);
  const blue = pn.find((n) => n.role === "defender");
  const attackers = pn.filter((n) => n.role === "attacker");
  let pool = attackers;
  if (blue) {
    const targets = edges.filter((e) => e.from === blue.id).map((e) => e.to);
    const arrowed = attackers.filter((a) => targets.includes(a.id));
    if (arrowed.length) pool = arrowed;
  }
  const members = [];
  if (blue) members.push({ id: blue.id, team: "blue", kind: blue.kind, key: blue.key, ckpt: blue.ckpt, dims: blue.dims });
  // The single-phase runner can only use fixed opponents (scripted or a real
  // checkpoint) — except when red is itself the training side, where a
  // from-scratch (or resuming) red is the trainee, not a fixed opponent.
  const trainsAttacker = root.trainingSide === "attacker";
  pool.filter((a) => a.kind === "scripted" || a.kind === "ppo" || (trainsAttacker && a.kind === "scratch"))
      .forEach((a) => members.push({ id: a.id, team: "red", kind: a.kind, key: a.key, ckpt: a.ckpt, dims: a.dims }));
  return { members };
}

function laneLists(nodes, phaseId) {
  const pn = nodes.filter((n) => n.phaseId === phaseId);
  return { defenders: pn.filter((n) => n.role === "defender"), attackers: pn.filter((n) => n.role === "attacker") };
}
function contentHeight(nodes, phaseId) {
  const { defenders, attackers } = laneLists(nodes, phaseId);
  const rows = Math.max(1, defenders.length, attackers.length);
  return HEADER_H + PAD + LANE_HEADER_H + NODE_GAP + rows * (NODE_H + NODE_GAP) + PAD_BOTTOM;
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(6,7,11,0.72)",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050, padding: 16 },
  panel: { width: "min(1200px, 97vw)", height: "min(780px, 94vh)", display: "flex", flexDirection: "column",
    borderRadius: 20, border: "1px solid var(--modal-border)", background: "var(--modal-bg)",
    boxShadow: "0 40px 120px rgba(0,0,0,0.55)", color: TEXT_PRIMARY, overflow: "hidden" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
    padding: "16px 20px 14px", borderBottom: "1px solid var(--modal-border)", flexShrink: 0 },
  title: { margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" },
  subtitle: { margin: "5px 0 0 0", fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5, maxWidth: 660 },
  headActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  addPhaseBtn: { display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999,
    cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#fff", border: "none",
    background: "linear-gradient(180deg, #6D5AE0, #5A46C8)", boxShadow: "0 6px 18px rgba(90,70,200,0.35)" },
  closeBtn: { border: "none", background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY, width: 28, height: 28,
    borderRadius: 9, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, fontFamily: "inherit" },
  main: { flex: 1, display: "flex", minHeight: 0 },

  scroll: { flex: 1, overflow: "auto", position: "relative",
    background: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0) 0 0/22px 22px" },
  canvas: { position: "relative", width: CANVAS_W, height: CANVAS_H },
  svg: { position: "absolute", inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: "none" },

  phase: { position: "absolute", borderRadius: 16, boxSizing: "border-box",
    border: "1.5px solid var(--modal-border)",
    background: "color-mix(in srgb, var(--modal-bg) 90%, transparent)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" },
  phaseHead: { height: HEADER_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 10px",
    borderBottom: "1px solid var(--modal-border)", cursor: "grab",
    background: "linear-gradient(180deg, rgba(155,120,240,0.16), rgba(155,120,240,0.05))",
    borderRadius: "14px 14px 0 0" },
  phaseName: { flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
    color: TEXT_PRIMARY, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.03em" },
  sideToggle: { display: "flex", padding: 2, borderRadius: 8, background: "rgba(0,0,0,0.25)", gap: 2 },
  sideBtn: (accent, active) => ({ border: "none", cursor: "pointer", fontFamily: "inherit",
    fontSize: 11, lineHeight: 1, padding: "4px 6px", borderRadius: 6,
    background: active ? accent : "transparent", color: active ? "#fff" : TEXT_SECONDARY }),
  phaseDel: { border: "none", background: "transparent", color: TEXT_SECONDARY, cursor: "pointer",
    fontSize: 15, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  lanes: { flex: 1, display: "flex", gap: LANE_GAP, padding: PAD, paddingBottom: PAD_BOTTOM, minHeight: 0 },
  lane: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: NODE_GAP },
  laneHead: { height: LANE_HEADER_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 },
  laneTitle: (accent) => ({ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: accent }),
  trainBadge: { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
    padding: "1px 5px", borderRadius: 999, background: "rgba(33,185,137,0.2)", color: "#3FE0A8" },
  laneAdd: { marginLeft: "auto", border: "none", background: "rgba(255,255,255,0.08)", color: TEXT_PRIMARY,
    width: 18, height: 18, borderRadius: 6, cursor: "pointer", fontSize: 13, lineHeight: 1, fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center" },

  node: (accent, selected) => ({ position: "relative", height: NODE_H, flexShrink: 0, boxSizing: "border-box",
    display: "flex", alignItems: "center", gap: 8, padding: "0 9px", borderRadius: 10, cursor: "pointer",
    border: `1px solid ${selected ? accent : "var(--modal-border)"}`,
    background: selected ? `${accent}1f` : "var(--surface-muted)",
    boxShadow: selected ? `0 4px 14px ${accent}33` : "none" }),
  nodeIcon: { fontSize: 16, lineHeight: 1, flexShrink: 0 },
  nodeMain: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 },
  nodeLabel: { fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  nodeTag: (c) => ({ fontSize: 8, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: c }),
  laneEmpty: { height: NODE_H, flexShrink: 0, borderRadius: 10, border: "1px dashed var(--modal-border)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, color: TEXT_SECONDARY },
  // Connection circle on the inward side: defenders → right, attackers → left.
  port: (accent, side) => ({ position: "absolute", [side]: -7, top: NODE_H / 2 - 7, width: 14, height: 14, borderRadius: 999,
    border: `2px solid ${accent}`, background: "var(--modal-bg)", cursor: "crosshair", zIndex: 5,
    boxShadow: `0 0 0 3px ${accent}22` }),
  phasePort: (side) => ({ position: "absolute", [side]: -8, top: HEADER_H / 2 - 8, width: 16, height: 16, borderRadius: 999,
    border: `2px solid ${PPO}`, background: "var(--modal-bg)", cursor: "crosshair", zIndex: 6 }),
  resizeGrip: { position: "absolute", right: 3, bottom: 3, width: 16, height: 16, cursor: "nwse-resize",
    zIndex: 6, color: TEXT_SECONDARY, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" },

  inspector: { width: 300, flexShrink: 0, borderLeft: "1px solid var(--modal-border)",
    background: "var(--modal-bg)", display: "flex", flexDirection: "column", overflowY: "auto" },
  inspEmpty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 10, color: TEXT_SECONDARY, fontSize: 12.5, padding: 26, textAlign: "center", lineHeight: 1.5 },
  inspHead: { padding: "15px 16px 11px", borderBottom: "1px solid var(--modal-border)" },
  inspTitle: { fontSize: 13, fontWeight: 700 },
  inspSub: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 3 },
  inspBody: { padding: 16, display: "flex", flexDirection: "column", gap: 15 },
  label: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: TEXT_SECONDARY, marginBottom: 8 },
  segment: { display: "flex", padding: 4, borderRadius: 11, background: "var(--surface-muted)", border: "1px solid var(--modal-border)" },
  segBtn: (accent, active) => ({ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit", background: active ? accent : "transparent",
    color: active ? "#fff" : TEXT_SECONDARY }),
  optGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  opt: (accent, selected) => ({ display: "flex", flexDirection: "column", gap: 4, textAlign: "left",
    padding: "9px 10px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", color: TEXT_PRIMARY,
    border: `1px solid ${selected ? accent : "var(--modal-border)"}`, background: selected ? `${accent}1f` : "var(--input-bg)" }),
  optTop: { display: "flex", alignItems: "center", gap: 7 },
  optName: { fontSize: 12, fontWeight: 700 },
  optDesc: { fontSize: 10, color: TEXT_SECONDARY, lineHeight: 1.35 },
  divider: { display: "flex", alignItems: "center", gap: 10, margin: "2px 0" },
  divLine: { flex: 1, height: 1, background: "var(--color-border-secondary)" },
  divText: { fontSize: 10, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  ckptBox: (selected) => ({ display: "flex", flexDirection: "column", gap: 9, padding: 12, borderRadius: 12,
    border: `1px solid ${selected ? PPO : "var(--modal-border)"}`, background: selected ? `${PPO}14` : "var(--input-bg)" }),
  ckptPath: { fontSize: 11.5, fontFamily: "var(--font-mono, ui-monospace, monospace)", wordBreak: "break-all", lineHeight: 1.4 },
  ckptPlaceholder: { fontSize: 11.5, color: TEXT_SECONDARY },
  browseBtn: { padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${PPO}66`, background: `${PPO}1f`, color: TEXT_PRIMARY, fontSize: 12, fontWeight: 700 },
  dimsRow: { display: "flex", alignItems: "center", gap: 8 },
  dimsLabel: { fontSize: 11.5, color: TEXT_SECONDARY },
  dimsInput: { width: 84, boxSizing: "border-box", fontSize: 12.5, padding: "7px 9px", borderRadius: 8,
    border: "1px solid var(--modal-border)", background: "var(--modal-bg)", color: TEXT_PRIMARY, outline: "none", fontFamily: "inherit" },
  delNodeBtn: { padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
    border: "1px solid rgba(224,75,74,0.4)", background: "rgba(224,75,74,0.12)", color: "#F08886" },

  footer: { display: "flex", alignItems: "center", gap: 12, padding: "13px 20px",
    borderTop: "1px solid var(--modal-border)", background: "var(--surface-muted)", flexShrink: 0 },
  footHint: { flex: 1, fontSize: 11.5, color: TEXT_SECONDARY },
  cancelBtn: { padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)", color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  applyBtn: (disabled) => ({ padding: "9px 20px", borderRadius: 999, border: "none",
    background: disabled ? "rgba(29,158,117,0.25)" : "linear-gradient(180deg, #21B989, #1D9E75)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 8px 22px rgba(29,158,117,0.35)" }),
};

// ds/dt are the directions the source/target ports face (+1 right, -1 left) so
// the curve always leaves and enters on the correct side of each node.
function edgePath(sx, sy, ds, tx, ty, dt) {
  const dx = Math.max(30, Math.abs(tx - sx) / 2);
  return `M ${sx} ${sy} C ${sx + ds * dx} ${sy}, ${tx + dt * dx} ${ty}, ${tx} ${ty}`;
}

export default function CurriculumEditor({ initialCurriculum, hostCount, onApply, onClose }) {
  const recFor = (role) => recommendedDims(role, hostCount);
  const init = initialCurriculum && initialCurriculum.phases?.length ? initialCurriculum : DEFAULT_CURRICULUM;
  const [phases, setPhases]         = useState(init.phases);
  const [nodes, setNodes]           = useState(init.nodes);
  const [edges, setEdges]           = useState(init.edges);
  const [phaseEdges, setPhaseEdges] = useState(init.phaseEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [browsing, setBrowsing]     = useState(false);
  const [ghost, setGhost]           = useState(null);   // live endpoint while linking
  const [active, setActive]         = useState(null);   // triggers window listeners
  const [anchors, setAnchors]       = useState({});     // DOM-measured port centers

  const canvasRef    = useRef(null);
  const inter        = useRef(null);   // interaction details
  const nodePortRef  = useRef({});     // nodeId -> port element
  const phasePortRef = useRef({});     // `${phaseId}:in|out` -> element

  const cur = useMemo(() => ({ phases, nodes, edges, phaseEdges }), [phases, nodes, edges, phaseEdges]);
  const phasesById = useMemo(() => Object.fromEntries(phases.map((p) => [p.id, p])), [phases]);
  const nodesById  = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  // Direction a node's port faces: defenders (right) +1, attackers (left) -1.
  const dirOf = (id) => (nodesById[id]?.role === "attacker" ? -1 : 1);
  const selected = nodes.find((n) => n.id === selectedNodeId) || null;
  const patch = (id, f) => setNodes((ns) => ns.map((n) => n.id === id ? { ...n, ...f } : n));
  // Is the selected node the one being trained in its phase? Only then may it
  // start "from scratch"; otherwise it's a fixed opponent (checkpoint / reuse).
  const selTrains = !!selected && phasesById[selected.phaseId]?.trainingSide === selected.role;
  // Opponents linked to the selected node — opponent-sampling only matters when
  // the trained agent faces a *pool* (more than one) to choose between.
  const selOpponents = selected ? opponentsOf(selected.id, nodesById, edges) : [];

  // ── "Needs attention" detection — drives the amber connect-me pulses ──
  // A node pulses if it isn't fully configured yet, or has no opposite-role
  // opponent to train against. Each reason becomes a line in its tooltip.
  const nodeIssues = useMemo(() => {
    const m = {};
    nodes.forEach((n) => {
      const reasons = [];
      if (!isConfigured(n)) reasons.push("Not configured yet — pick its weights / opponent in the inspector.");
      if (opponentsOf(n.id, nodesById, edges).length === 0)
        reasons.push("No matchup — drag its ● port to an agent on the other side, or it will never be trained.");
      if (reasons.length) m[n.id] = reasons;
    });
    return m;
  }, [nodes, nodesById, edges]);
  // A phase pulses if it holds no agents, or (with siblings) isn't chained in.
  const phaseIssues = useMemo(() => {
    const m = {};
    const multi = phases.length > 1;
    const chained = new Set();
    phaseEdges.forEach((e) => { chained.add(e.from); chained.add(e.to); });
    phases.forEach((p) => {
      const roles = new Set(nodes.filter((n) => n.phaseId === p.id).map((n) => n.role));
      const reasons = [];
      if (roles.size === 0) reasons.push("Empty phase — add a defender and an attacker.");
      else {
        if (!roles.has("defender")) reasons.push("No defender — add one so this phase can form a matchup.");
        if (!roles.has("attacker")) reasons.push("No attacker — add one so this phase can form a matchup.");
      }
      if (multi && !chained.has(p.id)) reasons.push("Not chained — drag its ▸ port to another phase to set training order.");
      if (reasons.length) m[p.id] = reasons;
    });
    return m;
  }, [phases, nodes, phaseEdges]);
  // Matchup arrows that link two same-side agents can never be a real matchup
  // (opponents are always opposite-role) — the "wrong way around" case.
  const badEdgeIds = useMemo(() => {
    const s = new Set();
    edges.forEach((e) => {
      const a = nodesById[e.from], b = nodesById[e.to];
      if (a && b && a.role === b.role) s.add(e.id);
    });
    return s;
  }, [edges, nodesById]);
  // Phase arrows pointing "backwards": the target can already reach the source,
  // so the arrow closes a loop and the chain order can't be honoured.
  const badPhaseEdgeIds = useMemo(() => {
    const s = new Set();
    phaseEdges.forEach((e) => { if (ancestorsOf(e.from, phaseEdges).has(e.to)) s.add(e.id); });
    return s;
  }, [phaseEdges]);

  const nodeIssueCount  = Object.keys(nodeIssues).length;
  const phaseIssueCount = Object.keys(phaseIssues).length;
  const badArrowCount   = badEdgeIds.size + badPhaseEdgeIds.size;
  const hasPulses = nodeIssueCount > 0 || phaseIssueCount > 0 || badArrowCount > 0;
  // Amber ring that grows outward (spread) while fading (alpha), both driven by
  // the shared --cur-pulse clock so every ring is identical frame-for-frame.
  const PULSE_NODE  = "0 0 0 calc(var(--cur-pulse) * 7px) rgba(245, 166, 35, calc(0.7 * (1 - var(--cur-pulse))))";
  const PULSE_PHASE = "0 0 0 calc(var(--cur-pulse) * 11px) rgba(245, 166, 35, calc(0.55 * (1 - var(--cur-pulse)))), 0 8px 22px rgba(0,0,0,0.35)";
  // Amber highlight over a bad arrow — fades out on the same clock (no snap-back).
  const PULSE_EDGE_OPACITY = "calc(0.5 * (1 - var(--cur-pulse)))";

  // Live free-GPU snapshot → a preview of how the jobs would be distributed.
  const [gpuInfo, setGpuInfo] = useState(null);
  useEffect(() => { fetchGpuInfo().then(setGpuInfo); }, []);
  const schedulePlan = useMemo(() => planSchedule(cur, gpuInfo?.free || []), [cur, gpuInfo]);
  const selJob = selected ? schedulePlan.byNode[selected.id] : null;

  // Every trained agent = a node sitting on its phase's training side. Each one
  // produces a distinct checkpoint downstream, so each gets a unique label.
  const trainedLabelById = useMemo(() => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const map = {};
    phases.forEach((ph) => {
      const list = nodes.filter((n) => n.phaseId === ph.id && n.role === ph.trainingSide);
      list.forEach((n, i) => {
        const roleCap = n.role === "defender" ? "Defender" : "Attacker";
        const neigh = edges.filter((e) => e.from === n.id).map((e) => byId[e.to])
          .concat(edges.filter((e) => e.to === n.id).map((e) => byId[e.from])).filter(Boolean);
        const opp = neigh.length ? shortKind(neigh[0]) : null;
        const custom = (n.name || "").trim();
        map[n.id] = {
          // A custom name flows downstream: a later ref to this agent shows it.
          label: custom || `${ph.name} · ${roleCap} ${i + 1}`,
          sub: `${ph.name} · ${shortKind(n)}${opp ? ` → ${opp}` : ""}`,
          role: n.role, phaseId: ph.id,
        };
      });
    });
    return map;
  }, [phases, nodes, edges]);

  // Trained agents the selected node may reuse: same role, from an ancestor phase.
  const refOptions = useMemo(() => {
    if (!selected) return [];
    const anc = ancestorsOf(selected.phaseId, phaseEdges);
    return Object.entries(trainedLabelById)
      .filter(([id, info]) => info.role === selected.role && anc.has(info.phaseId) && id !== selected.id)
      .map(([id, info]) => ({ id, ...info }));
  }, [selected, phaseEdges, trainedLabelById]);

  const toCanvas = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Measure every port's centre in canvas-content coordinates after each layout.
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const next = {};
    const measure = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    };
    for (const [id, el] of Object.entries(nodePortRef.current)) if (el) next[id] = measure(el);
    for (const [k, el]  of Object.entries(phasePortRef.current)) if (el) next[`P:${k}`] = measure(el);
    setAnchors(next);
  }, [phases, nodes]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !browsing) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, browsing]);

  useEffect(() => {
    if (!active) return;
    const onMove = (e) => {
      const it = inter.current;
      if (!it) return;
      const p = toCanvas(e);
      if (it.kind === "phase") {
        const x = clamp(p.x - it.offX, 0, CANVAS_W - (it.w || PHASE_W));
        const y = clamp(p.y - it.offY, 0, CANVAS_H - 60);
        setPhases((ps) => ps.map((ph) => ph.id === it.id ? { ...ph, x, y } : ph));
      } else if (it.kind === "resize") {
        const w = clamp(it.w0 + (p.x - it.x0), MIN_W, 760);
        const h = clamp(it.h0 + (p.y - it.y0), MIN_H, 1300);
        setPhases((ps) => ps.map((ph) => ph.id === it.id ? { ...ph, w, h } : ph));
      } else {
        setGhost(p);
      }
    };
    const onUp = (e) => {
      const it = inter.current;
      if (it && (it.kind === "edge" || it.kind === "phaseEdge")) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (it.kind === "edge") {
          const target = el?.closest?.("[data-node-id]")?.getAttribute("data-node-id");
          if (target && target !== it.from)
            setEdges((es) => es.some((x) => x.from === it.from && x.to === target) ? es : [...es, { id: nid(), from: it.from, to: target }]);
        } else {
          const target = el?.closest?.("[data-phase-id]")?.getAttribute("data-phase-id");
          if (target && target !== it.from)
            setPhaseEdges((es) => es.some((x) => x.from === it.from && x.to === target) ? es : [...es, { id: nid(), from: it.from, to: target }]);
        }
      }
      inter.current = null; setGhost(null); setActive(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [active]);

  // ── Mutations ──
  const addPhase = () => {
    const n = phases.length + 1;
    const base = phases[phases.length - 1];
    setPhases((ps) => [...ps, { id: pid(), name: `PHASE_${n}`,
      x: base ? clamp(base.x + (base.w || PHASE_W) + 80, 0, CANVAS_W - PHASE_W) : 80,
      y: base ? base.y : 80, trainingSide: "defender" }]);
  };
  const removePhase = (id) => {
    const kill = new Set(nodes.filter((x) => x.phaseId === id).map((x) => x.id));
    setNodes((ns) => ns
      .filter((x) => x.phaseId !== id)
      // Drop any reference to a (now gone) trained output from this phase.
      .map((x) => x.kind === "ref" && kill.has(x.refNodeId) ? { ...x, kind: "unconfigured", refNodeId: undefined } : x));
    setEdges((es) => es.filter((e) => !kill.has(e.from) && !kill.has(e.to)));
    setPhaseEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
    setPhases((ps) => ps.filter((p) => p.id !== id));
  };
  const addNode = (phaseId, role) => {
    const id = nid();
    // The trained side defaults to "from scratch"; a fixed opponent starts blank.
    const trains = phasesById[phaseId]?.trainingSide === role;
    setNodes((ns) => [...ns, { id, phaseId, role, kind: trains ? "scratch" : "unconfigured", dims: recFor(role) }]);
    setSelectedNodeId(id);
  };
  const removeNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id)
      .map((n) => n.kind === "ref" && n.refNodeId === id ? { ...n, kind: "unconfigured", refNodeId: undefined } : n));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };
  const setTrainingSide = (phaseId, side) => {
    setPhases((ps) => ps.map((p) => p.id === phaseId ? { ...p, trainingSide: side } : p));
    // Only the training side can be "from scratch"; a scratch node that is now
    // the fixed opponent side is no longer valid — force it to be re-picked.
    setNodes((ns) => ns.map((n) =>
      n.phaseId === phaseId && n.kind === "scratch" && n.role !== side
        ? { ...n, kind: "unconfigured" } : n));
  };
  const setRole = (role) => {
    if (!selected) return;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== selected.id || n.role === role) return n;
      let kind = n.kind;
      // Only defenders can't be scripted; scratch/ppo/ref are valid for both.
      if (role === "defender" && kind === "scripted") kind = "scratch";
      return { ...n, role, kind, key: kind === "scripted" ? n.key : undefined };
    }));
  };

  const startPhaseDrag = (e, ph) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = toCanvas(e);
    inter.current = { kind: "phase", id: ph.id, offX: p.x - ph.x, offY: p.y - ph.y, w: ph.w || PHASE_W };
    setActive({ kind: "phase" });
  };
  const startResize = (e, ph) => {
    e.stopPropagation();
    const p = toCanvas(e);
    inter.current = { kind: "resize", id: ph.id, x0: p.x, y0: p.y,
      w0: ph.w || PHASE_W, h0: ph.h || contentHeight(nodes, ph.id) };
    setActive({ kind: "resize" });
  };
  const startLink = (e, fromId, kind) => {
    e.stopPropagation();
    inter.current = { kind, from: fromId };
    setGhost(toCanvas(e));
    setActive({ kind });
  };

  // ── Validation ──
  const allConfigured = nodes.every(isConfigured);
  const run = deriveRun(cur);
  const runnable = run.members.some((m) => m.team === "blue") && run.members.some((m) => m.team === "red");
  const canApply = phases.length >= 1 && allConfigured && runnable;
  // Training jobs = each node sitting on its phase's training side.
  const trainJobs = nodes.filter((n) => phasesById[n.phaseId]?.trainingSide === n.role);
  const defenderJobs = trainJobs.filter((n) => n.role === "defender").length;
  const attackerJobs = trainJobs.length - defenderJobs;
  const handleApply = () => { if (canApply) onApply({ members: run.members, curriculum: cur }); };

  const ghostFrom = ghost && inter.current
    ? (inter.current.kind === "edge" ? anchors[inter.current.from]
      : inter.current.kind === "phaseEdge" ? anchors[`P:${inter.current.from}:out`] : null)
    : null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.panel, ...(hasPulses ? { animation: "cur-pulse-drive 2.4s ease-out infinite" } : {}) }}
        onClick={(e) => e.stopPropagation()}>

        {/* Pulsing "connect me" glow for agents/phases that aren't wired into
            anything yet. A single animated custom property (--cur-pulse, driven
            once on the panel) is inherited by every pulsing element, so all the
            rings stay perfectly in sync. It ramps 0→1 each cycle, and the ring
            expands + fades out from the element — one-directional, no breathe-back. */}
        <style>{`
          @property --cur-pulse {
            syntax: '<number>';
            inherits: true;
            initial-value: 0;
          }
          @keyframes cur-pulse-drive {
            from { --cur-pulse: 0; }
            to   { --cur-pulse: 1; }
          }
        `}</style>

        <div style={S.header}>
          <div>
            <h3 style={S.title}>Curriculum editor</h3>
            <p style={S.subtitle}>
              Drag phases to arrange them and resize from the bottom-right corner. Drag from a node’s ● port
              to another node to set a matchup, or from a phase’s ▸ port to chain phases.
            </p>
          </div>
          <div style={S.headActions}>
            <button style={S.addPhaseBtn} onClick={addPhase}>＋ Add phase</button>
            <button style={S.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        <div style={S.main}>
          <div style={S.scroll}>
            <div style={S.canvas} ref={canvasRef} onPointerDown={() => setSelectedNodeId(null)}>

              {/* Edges */}
              <svg style={S.svg}>
                <defs>
                  <marker id="arrowP" markerWidth="10" markerHeight="10" refX="8" refY="3.2" orient="auto">
                    <path d="M0,0 L8,3.2 L0,6.4 Z" fill={PPO} />
                  </marker>
                  <marker id="arrowW" markerWidth="10" markerHeight="10" refX="8" refY="3.2" orient="auto">
                    <path d="M0,0 L8,3.2 L0,6.4 Z" fill={WARN} />
                  </marker>
                </defs>
                {phaseEdges.map((e) => {
                  const a = anchors[`P:${e.from}:out`], b = anchors[`P:${e.to}:in`];
                  if (!a || !b) return null;
                  const d = edgePath(a.x, a.y, 1, b.x, b.y, -1);
                  const bad = badPhaseEdgeIds.has(e.id);
                  return (
                    <g key={e.id} style={{ pointerEvents: "stroke", cursor: "pointer" }}
                       onClick={() => setPhaseEdges((es) => es.filter((x) => x.id !== e.id))}>
                      {bad && <title>Backwards phase link — it loops the chain back on itself. Delete it and chain the phases the other way.</title>}
                      <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
                      {bad && <path d={d} stroke={WARN} strokeWidth={7} fill="none" strokeLinecap="round" style={{ opacity: PULSE_EDGE_OPACITY }} />}
                      <path d={d} stroke={bad ? WARN : PPO} strokeWidth={2.5} fill="none" strokeDasharray="7 5" markerEnd={bad ? "url(#arrowW)" : "url(#arrowP)"} />
                    </g>
                  );
                })}
                {edges.map((e) => {
                  const a = anchors[e.from], b = anchors[e.to];
                  if (!a || !b) return null;
                  const d = edgePath(a.x, a.y, dirOf(e.from), b.x, b.y, dirOf(e.to));
                  const bad = badEdgeIds.has(e.id);
                  return (
                    <g key={e.id} style={{ pointerEvents: "stroke", cursor: "pointer" }}
                       onClick={() => setEdges((es) => es.filter((x) => x.id !== e.id))}>
                      {bad && <title>Same-side matchup — this links two agents on the same team. A matchup must join a defender and an attacker.</title>}
                      <path d={d} stroke="transparent" strokeWidth={12} fill="none" />
                      {bad && <path d={d} stroke={WARN} strokeWidth={6} fill="none" strokeLinecap="round" style={{ opacity: PULSE_EDGE_OPACITY }} />}
                      {/* No arrowhead: matchups are undirected — the backend links
                          a defender↔attacker regardless of which way it was drawn. */}
                      <path d={d} stroke={bad ? WARN : RED} strokeWidth={2} fill="none" />
                    </g>
                  );
                })}
                {ghostFrom && ghost && (() => {
                  const ds = inter.current.kind === "edge" ? dirOf(inter.current.from) : 1;
                  const dt = ghost.x >= ghostFrom.x ? -1 : 1;
                  return (
                    <path d={edgePath(ghostFrom.x, ghostFrom.y, ds, ghost.x, ghost.y, dt)}
                          stroke={inter.current.kind === "edge" ? RED : PPO} strokeWidth={2}
                          strokeDasharray="5 5" fill="none" opacity={0.7} />
                  );
                })()}
              </svg>

              {/* Phases */}
              {phases.map((ph) => {
                const { defenders, attackers } = laneLists(nodes, ph.id);
                const h = Math.max(ph.h || 0, contentHeight(nodes, ph.id));
                const w = ph.w || PHASE_W;
                const lane = (role, list, accent) => (
                  <div style={S.lane}>
                    <div style={S.laneHead}>
                      <span style={S.laneTitle(accent)}>{role === "defender" ? "Defenders" : "Attackers"}</span>
                      {ph.trainingSide === role && <span style={S.trainBadge}>training</span>}
                      <button style={S.laneAdd} title="Add" onClick={(e) => { e.stopPropagation(); addNode(ph.id, role); }}
                        onPointerDown={(e) => e.stopPropagation()}>＋</button>
                    </div>
                    {list.length === 0
                      ? <div style={{ ...S.laneEmpty, borderColor: WARN, color: WARN, boxShadow: PULSE_NODE }}
                          title={`Add a ${role === "defender" ? "defender" : "attacker"} so this phase can form a matchup.`}>empty</div>
                      : list.map((n) => {
                          const d = describe(n, { trainedLabelById, phasesById });
                          const side = role === "defender" ? "right" : "left";
                          const issues = nodeIssues[n.id];
                          return (
                            <div key={n.id} data-node-id={n.id}
                              style={{ ...S.node(accent, selectedNodeId === n.id),
                                ...(issues ? { boxShadow: PULSE_NODE } : {}) }}
                              title={issues ? issues.join("\n") : undefined}
                              onPointerDown={(e) => { e.stopPropagation(); setSelectedNodeId(n.id); }}>
                              <span style={S.nodeIcon}>{d.icon}</span>
                              <div style={S.nodeMain}>
                                <span style={S.nodeLabel}>{d.label}</span>
                                <span style={S.nodeTag(d.tag.color)}>{d.tag.text}</span>
                              </div>
                              <div style={S.port(accent, side)} title="Drag to a node to set a matchup"
                                ref={(el) => { if (el) nodePortRef.current[n.id] = el; else delete nodePortRef.current[n.id]; }}
                                onPointerDown={(e) => startLink(e, n.id, "edge")} />
                            </div>
                          );
                        })}
                  </div>
                );
                const pIssues = phaseIssues[ph.id];
                return (
                  <div key={ph.id} data-phase-id={ph.id}
                    title={pIssues ? pIssues.join("\n") : undefined}
                    style={{ ...S.phase, left: ph.x, top: ph.y, width: w, height: h,
                      ...(pIssues ? { boxShadow: PULSE_PHASE } : {}) }}>
                    <div style={S.phaseHead} onPointerDown={(e) => startPhaseDrag(e, ph)}>
                      <input style={S.phaseName} value={ph.name} onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => setPhases((ps) => ps.map((p) => p.id === ph.id ? { ...p, name: e.target.value } : p))} />
                      <div style={S.sideToggle} onPointerDown={(e) => e.stopPropagation()} title="Which side is being trained">
                        <button style={S.sideBtn(BLUE, ph.trainingSide === "defender")}
                          onClick={() => setTrainingSide(ph.id, "defender")}>🛡️</button>
                        <button style={S.sideBtn(RED, ph.trainingSide === "attacker")}
                          onClick={() => setTrainingSide(ph.id, "attacker")}>⚔️</button>
                      </div>
                      <button style={S.phaseDel} title="Delete phase" onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => removePhase(ph.id)}>×</button>
                    </div>
                    <div style={S.phasePort("left")}  ref={(el) => { if (el) phasePortRef.current[`${ph.id}:in`]  = el; else delete phasePortRef.current[`${ph.id}:in`]; }} />
                    <div style={S.phasePort("right")} title="Drag to another phase to chain"
                      ref={(el) => { if (el) phasePortRef.current[`${ph.id}:out`] = el; else delete phasePortRef.current[`${ph.id}:out`]; }}
                      onPointerDown={(e) => startLink(e, ph.id, "phaseEdge")} />
                    <div style={S.lanes}>
                      {lane("defender", defenders, BLUE)}
                      {lane("attacker", attackers, RED)}
                    </div>
                    <div style={S.resizeGrip} onPointerDown={(e) => startResize(e, ph)} title="Resize">
                      <svg width="12" height="12" viewBox="0 0 12 12"><path d="M11 4 L4 11 M11 8 L8 11" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inspector */}
          <div style={S.inspector}>
            {!selected ? (
              <div style={S.inspEmpty}>
                <span style={{ fontSize: 26 }}>🎛️</span>
                <span>Select a node to configure it.</span>
              </div>
            ) : (
              <>
                <div style={S.inspHead}>
                  <div style={S.inspTitle}>{selected.role === "defender" ? "Defender node" : "Attacker node"}</div>
                  <div style={S.inspSub}>{selected.role === "defender" ? "A blue PPO defender." : "A red opponent."}</div>
                </div>
                <div style={S.inspBody}>
                  <div>
                    <div style={S.label}>Name</div>
                    <input
                      style={{ ...S.dimsInput, width: "100%" }}
                      placeholder={describe({ ...selected, name: "" }, { trainedLabelById, phasesById }).label}
                      value={selected.name || ""}
                      onChange={(e) => patch(selected.id, { name: e.target.value })}
                    />
                    <p style={{ margin: "6px 0 0 0", fontSize: 10.5, color: TEXT_SECONDARY }}>
                      Names its folder &amp; checkpoint. Leave blank to auto-name from its source.
                    </p>
                  </div>

                  {selTrains && selJob && (
                    <div>
                      <div style={S.label}>Scheduling</div>
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 8, padding: 12,
                        borderRadius: 12, border: "1px solid var(--modal-border)", background: "var(--surface-muted)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>Deploys on</span>
                          <span style={{
                            fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                            border: `1px solid ${selJob.gpuId == null ? "rgba(255,255,255,0.2)" : `${PPO}55`}`,
                            background: selJob.gpuId == null ? "rgba(255,255,255,0.06)" : `${PPO}1f`,
                            color: selJob.gpuId == null ? TEXT_SECONDARY : PPO,
                          }}>{selJob.gpuLabel}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>Queue position</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                            {selJob.queuePos === 0 ? "Runs first" : `#${selJob.queuePos + 1} in queue`}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ fontSize: 11, color: TEXT_SECONDARY, flexShrink: 0 }}>Depends on</span>
                          {selJob.depLabels.length === 0 ? (
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#3FE0A8" }}>None</span>
                          ) : (
                            <span style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                              {selJob.depLabels.map((d, i) => (
                                <span key={i} style={{
                                  fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                                  border: `1px solid ${REF}55`, background: `${REF}1f`, color: REF,
                                }}>🎓 {d}</span>
                              ))}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "2px 0 0 0", fontSize: 10, color: TEXT_SECONDARY, lineHeight: 1.45 }}>
                          {gpuInfo == null ? "Checking available GPUs…"
                            : (gpuInfo.free?.length
                                ? `Snapshot: ${gpuInfo.free.length} free GPU(s) · independent jobs run in parallel.`
                                : "No free GPU detected — jobs run sequentially on CPU.")}
                          {" "}Recomputed at a fresh snapshot when you start training.
                        </p>
                      </div>
                    </div>
                  )}

                  {selTrains && selOpponents.length > 1 && (
                    <div>
                      <div style={S.label}>Opponent sampling</div>
                      <div style={S.segment}>
                        <button style={S.segBtn(PPO, (selected.sampling || "random") === "random")}
                          onClick={() => patch(selected.id, { sampling: "random" })}>🎲 Random</button>
                        <button style={S.segBtn(PPO, selected.sampling === "weighted")}
                          onClick={() => patch(selected.id, { sampling: "weighted" })}>📈 Weighted</button>
                      </div>
                      <p style={{ margin: "6px 0 0 0", fontSize: 10.5, color: TEXT_SECONDARY }}>
                        Draws one of the {selOpponents.length} opponents per episode.
                        <strong> Random</strong> is uniform; <strong>weighted</strong> favours the
                        opponents this agent does worst against (a moving average of its reward,
                        log-compressed).
                      </p>
                    </div>
                  )}

                  <div>
                    <div style={S.label}>Role</div>
                    <div style={S.segment}>
                      <button style={S.segBtn(BLUE, selected.role === "defender")} onClick={() => setRole("defender")}>🛡️ Defender</button>
                      <button style={S.segBtn(RED,  selected.role === "attacker")} onClick={() => setRole("attacker")}>⚔️ Attacker</button>
                    </div>
                  </div>

                  {selected.role === "defender" ? (
                    <div>
                      <div style={S.label}>Weights</div>
                      {selTrains ? (
                        <div style={S.optGrid}>
                          <button style={S.opt(BLUE, selected.kind === "scratch")}
                            onClick={() => patch(selected.id, { kind: "scratch", ckpt: undefined, key: undefined, refNodeId: undefined })}>
                            <div style={S.optTop}><span>✨</span><span style={S.optName}>Scratch</span></div>
                            <span style={S.optDesc}>Random init</span>
                          </button>
                          <button style={S.opt(PPO, selected.kind === "ppo")}
                            onClick={() => patch(selected.id, { kind: "ppo", key: undefined })}>
                            <div style={S.optTop}><span>🧠</span><span style={S.optName}>Checkpoint</span></div>
                            <span style={S.optDesc}>Resume .pth</span>
                          </button>
                        </div>
                      ) : (
                        <button style={{ ...S.opt(PPO, selected.kind === "ppo"), width: "100%" }}
                          onClick={() => patch(selected.id, { kind: "ppo", key: undefined })}>
                          <div style={S.optTop}><span>🧠</span><span style={S.optName}>Checkpoint</span></div>
                          <span style={S.optDesc}>Fixed defender checkpoint (.pth)</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {selTrains && (
                        <div>
                          <div style={S.label}>Train from scratch</div>
                          <button style={{ ...S.opt(RED, selected.kind === "scratch"), width: "100%" }}
                            onClick={() => patch(selected.id, { kind: "scratch", key: undefined, ckpt: undefined, refNodeId: undefined })}>
                            <div style={S.optTop}><span>✨</span><span style={S.optName}>From scratch</span></div>
                            <span style={S.optDesc}>Train a red PPO agent from random init</span>
                          </button>
                        </div>
                      )}
                      <div>
                        <div style={S.label}>{selTrains ? "or a scripted agent" : "Scripted agent"}</div>
                        <div style={S.optGrid}>
                          {RED_AGENTS.map((a) => {
                            const sel = selected.kind === "scripted" && selected.key === a.key;
                            return (
                              <button key={a.key} style={S.opt(RED, sel)}
                                onClick={() => patch(selected.id, { kind: "scripted", key: a.key, ckpt: undefined, refNodeId: undefined })}>
                                <div style={S.optTop}><span>{a.icon}</span><span style={S.optName}>{a.name}</span></div>
                                <span style={S.optDesc}>{a.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {selected.role === "attacker" && (
                    <div style={S.divider}><span style={S.divLine} /><span style={S.divText}>or</span><span style={S.divLine} /></div>
                  )}

                  {(selected.role === "attacker" || selected.kind === "ppo") && (
                    <div>
                      {(selected.role === "attacker" || selected.kind === "ppo") &&
                        <div style={S.label}>{selected.role === "attacker" ? "PPO checkpoint" : "Checkpoint"}</div>}
                      <div style={S.ckptBox(selected.kind === "ppo" && !!selected.ckpt)}>
                        {selected.kind === "ppo" && selected.ckpt
                          ? <span style={S.ckptPath}>{selected.ckpt}</span>
                          : <span style={S.ckptPlaceholder}>
                              {selected.role === "attacker" ? "A checkpoint tags this attacker as PPO." : "No checkpoint selected."}
                            </span>}
                        <button style={S.browseBtn} onClick={() => setBrowsing(true)}>
                          {selected.kind === "ppo" && selected.ckpt ? "Change checkpoint…" : "Browse for checkpoint…"}
                        </button>
                        {selected.kind === "ppo" && (
                          <div>
                            <div style={S.dimsRow}>
                              <span style={S.dimsLabel}>Input dims</span>
                              <input style={S.dimsInput} type="number" min="1" step="1" value={selected.dims ?? ""}
                                onChange={(e) => patch(selected.id, { dims: e.target.value })}
                                title="Observation dimensions the checkpoint expects" />
                              {Number(selected.dims) !== recFor(selected.role) && (
                                <button
                                  style={{ ...S.dimsLabel, cursor: "pointer", border: `1px solid ${REF}55`,
                                           background: `${REF}1f`, color: REF, borderRadius: 8, padding: "6px 9px",
                                           fontFamily: "inherit", fontWeight: 700 }}
                                  onClick={() => patch(selected.id, { dims: recFor(selected.role) })}
                                  title="Set to the recommended value for this topology">
                                  use {recFor(selected.role)}
                                </button>
                              )}
                            </div>
                            <p style={{ margin: "6px 0 0 0", fontSize: 10.5, color: TEXT_SECONDARY }}>
                              Recommended for this topology: <strong>{recFor(selected.role)}</strong>{" "}
                              ({selected.role === "defender" ? "6 × hosts" : "1 + 3 × hosts"}). Override for a
                              checkpoint trained on a different observation size.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {refOptions.length > 0 && (
                    <div>
                      <div style={S.divider}><span style={S.divLine} /><span style={S.divText}>reuse a trained {selected.role}</span><span style={S.divLine} /></div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {refOptions.map((o) => {
                          const sel = selected.kind === "ref" && selected.refNodeId === o.id;
                          return (
                            <button key={o.id} style={S.opt(REF, sel)}
                              onClick={() => patch(selected.id, { kind: "ref", refNodeId: o.id, key: undefined, ckpt: undefined })}>
                              <div style={S.optTop}><span>🎓</span><span style={S.optName}>{o.label}</span></div>
                              <span style={S.optDesc}>{o.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button style={S.delNodeBtn} onClick={() => removeNode(selected.id)}>Delete node</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={S.footer}>
          <span style={S.footHint}>
            {hasPulses ? (
              <span style={{ color: WARN, fontWeight: 600 }}>
                {"⚠︎ "}{[
                  nodeIssueCount > 0 && `${nodeIssueCount} agent(s) need setup`,
                  phaseIssueCount > 0 && `${phaseIssueCount} phase(s) incomplete`,
                  badArrowCount > 0 && `${badArrowCount} bad arrow(s)`,
                ].filter(Boolean).join(" · ")} — fix the pulsing items.
              </span>
            ) : canApply
              ? `Ready — ${trainJobs.length} matchup(s) train in chain order (${defenderJobs} defender, ${attackerJobs} attacker).`
              : !allConfigured ? "Finish configuring every node (missing checkpoint or dims)."
              : "The first phase needs at least one defender and one attacker to run."}
          </span>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.applyBtn(!canApply)} onClick={handleApply} disabled={!canApply}>Apply curriculum</button>
        </div>
      </div>

      {browsing && selected && (
        <FileBrowserModal mode="file" initialPath={selected.ckpt || ""}
          onSelect={(path) => { patch(selected.id, { kind: "ppo", key: undefined, ckpt: path, dims: selected.dims ?? recFor(selected.role) }); setBrowsing(false); }}
          onClose={() => setBrowsing(false)} />
      )}
    </div>
  );
}
