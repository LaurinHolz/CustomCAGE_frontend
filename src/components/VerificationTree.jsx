// ─── Verification Tree ──────────────────────────────────────────────────────
// Renders the policy-induced state tree produced (here, simulated) by
// mini_CAGE/verificator/FV_pipeline.py. Each node is a PRISM "true state";
// each edge is one Blue+Red step carrying its transition probability.
//
// The tree is laid out top-to-bottom (depth -> y) and can be panned by dragging
// the background and zoomed via the on-canvas controls or the mouse wheel. The
// "Verify" button in the header triggers an animated build, revealing one depth
// level every 0.7s from the root downward.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VERIFICATION_TREE,
  TREE_META,
  treeStats,
} from "../data/verificationTreeMock";

const TEXT_PRIMARY = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const STATS = treeStats(VERIFICATION_TREE);
const BUILD_STEP_MS = 700; // delay between revealed depth levels.

// Status -> colour. Drives node fill/stroke and the legend.
const STATUS_STYLE = {
  root: { stroke: "#C879E0", fill: "rgba(200,121,224,0.16)", label: "Initial state" },
  progress: { stroke: "#E0A458", fill: "rgba(224,164,88,0.14)", label: "Red active" },
  impacted: { stroke: "#E24B4A", fill: "rgba(226,75,74,0.18)", label: "Target impacted" },
  safe: { stroke: "#1D9E75", fill: "rgba(29,158,117,0.16)", label: "Red eradicated" },
};

const BLUE_KIND_COLOR = {
  restore: "#3B8BD4",
  remove: "#4EC3C9",
  analyse: "#C879E0",
  decoy: "#E0A458",
  sleep: "#8A8A93",
};

// Layout constants (vertical tree: depth -> y, leaf order -> x).
const X_GAP = 178; // horizontal spacing between leaves
const Y_GAP = 110; // vertical spacing between depth levels
const NODE_W = 150;
const NODE_H = 42;
const PAD_X = 40;
const PAD_Y = 30;
const CANVAS_H = 620;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const styles = {
  page: { padding: 20, minHeight: "100%", color: TEXT_PRIMARY },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" },
  subtitle: { margin: "6px 0 0 0", fontSize: 13, color: TEXT_SECONDARY },
  controls: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  pill: { borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY, border: "1px solid rgba(255,255,255,0.1)" },
  body: { display: "flex", gap: 16, alignItems: "stretch" },
  canvasWrap: { flex: 1, minWidth: 0, position: "relative", height: CANVAS_H, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))", overflow: "hidden" },
  legend: { display: "flex", gap: 14, flexWrap: "wrap", margin: "0 0 12px 0", fontSize: 12, color: TEXT_SECONDARY },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3, display: "inline-block", border: "1px solid rgba(0,0,0,0.4)" },
  zoomBar: { position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 5 },
  zoomBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(20,20,26,0.75)", color: TEXT_PRIMARY, fontSize: 17, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", lineHeight: 1, userSelect: "none" },
  zoomLabel: { textAlign: "center", fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY, fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  building: { position: "absolute", top: 12, left: 12, zIndex: 5, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: "rgba(29,158,117,0.18)", color: "#3FE0A8", border: "1px solid rgba(29,158,117,0.4)" },
  side: { width: 300, minWidth: 300, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))", padding: 18, maxHeight: CANVAS_H, overflowY: "auto" },
  sideTitle: { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY },
  kv: { display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 },
  kvKey: { color: TEXT_SECONDARY },
  kvVal: { fontWeight: 700, fontFamily: "var(--font-mono, ui-monospace, monospace)", textAlign: "right" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 },
  tag: { fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  hint: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 1.5 },
};

// First pass: assign each node an (x = in-order leaf index, y = depth) slot,
// then convert to pixels. A parent sits at the horizontal midpoint of its kids.
function layout(root) {
  const positioned = [];
  const edges = [];
  let leafCursor = 0;

  function assign(node, parent) {
    let x;
    if (!node.children.length) {
      x = leafCursor;
      leafCursor += 1;
    } else {
      const xs = node.children.map((c) => assign(c, node));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    node._px = PAD_X + x * X_GAP;
    node._py = PAD_Y + node.depth * Y_GAP;
    positioned.push(node);
    if (parent) edges.push({ from: parent, to: node });
    return x;
  }
  assign(root, null);
  return { positioned, edges, leaves: leafCursor };
}

function nodeStatus(node) {
  return node.depth === 0 ? "root" : node.status;
}

function shortLabel(node) {
  if (node.depth === 0) return "init";
  const b = node.blueAction;
  if (!b || b.kind === "sleep") return "sleep";
  return b.host ? `${b.kind} ${b.host.replace(/^Op_/, "")}` : b.kind;
}

function fmtProb(p) {
  if (p == null) return "—";
  if (p >= 0.1) return p.toFixed(2);
  return p.toFixed(3);
}

export default function VerificationTree({ startSignal = 0 }) {
  const wrapRef = useRef(null);
  const [selectedId, setSelectedId] = useState(VERIFICATION_TREE.id);
  const [revealedDepth, setRevealedDepth] = useState(STATS.maxDepth);
  const [building, setBuilding] = useState(false);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 24 });

  const { positioned, edges, byId, pathProb } = useMemo(() => {
    const { positioned, edges } = layout(VERIFICATION_TREE);
    const byId = new Map(positioned.map((n) => [n.id, n]));
    const pathProb = new Map();
    const walk = (node, acc) => {
      const p = acc * (node.prob ?? 1);
      pathProb.set(node.id, p);
      node.children.forEach((c) => walk(c, p));
    };
    walk(VERIFICATION_TREE, 1);
    return { positioned, edges, byId, pathProb };
  }, []);

  // Center the root horizontally near the top of the viewport.
  const centerView = useCallback(() => {
    const w = wrapRef.current?.clientWidth || 900;
    const rootCx = VERIFICATION_TREE._px + NODE_W / 2;
    setView({ k: 1, tx: w / 2 - rootCx, ty: 24 });
  }, []);

  // Center once, as soon as the canvas has a real width.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let done = false;
    const ro = new ResizeObserver(() => {
      if (!done && el.clientWidth > 0) {
        done = true;
        centerView();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerView]);

  // ── Animated build (triggered by the Verify button) ───────────────────────
  const timerRef = useRef(null);
  const startBuild = useCallback(() => {
    centerView();
    setSelectedId(VERIFICATION_TREE.id);
    setBuilding(true);
    setRevealedDepth(0);
    if (timerRef.current) clearInterval(timerRef.current);
    let d = 0;
    timerRef.current = setInterval(() => {
      d += 1;
      setRevealedDepth(d);
      if (d >= STATS.maxDepth) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setBuilding(false);
      }
    }, BUILD_STEP_MS);
  }, [centerView]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  useEffect(() => {
    if (startSignal > 0) startBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  // ── Pan: drag the background ───────────────────────────────────────────────
  const dragRef = useRef(null);
  const onBgDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onBgMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setView((v) => ({ ...v, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) }));
  };
  const endDrag = () => { dragRef.current = null; };

  // ── Zoom: wheel (native, non-passive) + on-canvas buttons ──────────────────
  const zoomAt = useCallback((factor, cx, cy) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const wx = (cx - v.tx) / v.k;
      const wy = (cy - v.ty) / v.k;
      return { k, tx: cx - wx * k, ty: cy - wy * k };
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const zoomButton = (factor) => {
    const el = wrapRef.current;
    if (!el) return;
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  const selected = byId.get(selectedId) || VERIFICATION_TREE;
  const visNodes = positioned.filter((n) => n.depth <= revealedDepth);
  const visEdges = edges.filter((e) => e.to.depth <= revealedDepth);

  return (
    <div style={styles.page}>
      <style>{`@keyframes vtFade { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Verification Tree</h2>
          <p style={styles.subtitle}>
            Policy-induced state tree from the formal-verification pipeline
            (simulated). Attacker <b>{TREE_META.attacker}</b>, target{" "}
            <b>{TREE_META.target}</b>.
          </p>
        </div>
        <div style={styles.controls}>
          <span style={styles.pill}>{STATS.nodes} states</span>
          <span style={styles.pill}>{STATS.leaves} leaves</span>
          <span style={styles.pill}>depth {STATS.maxDepth}</span>
          <span style={{ ...styles.pill, color: "#F2837F" }}>
            {STATS.impacted} impact{STATS.impacted === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div style={styles.legend}>
        {Object.entries(STATUS_STYLE).map(([k, s]) => (
          <span key={k} style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: s.fill, borderColor: s.stroke }} />
            {s.label}
          </span>
        ))}
        <span style={styles.legendItem}>· drag background to pan · scroll / ± to zoom</span>
      </div>

      <div style={styles.body}>
        <div
          ref={wrapRef}
          style={{ ...styles.canvasWrap, cursor: dragRef.current ? "grabbing" : "grab" }}
          onMouseDown={onBgDown}
          onMouseMove={onBgMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {building && <div style={styles.building}>Building tree… depth {revealedDepth}/{STATS.maxDepth}</div>}

          <div style={styles.zoomBar}>
            <button style={styles.zoomBtn} onMouseDown={(e) => e.stopPropagation()} onClick={() => zoomButton(1.2)}>+</button>
            <div style={styles.zoomLabel}>{Math.round(view.k * 100)}%</div>
            <button style={styles.zoomBtn} onMouseDown={(e) => e.stopPropagation()} onClick={() => zoomButton(1 / 1.2)}>−</button>
            <button style={{ ...styles.zoomBtn, fontSize: 13 }} title="Reset view" onMouseDown={(e) => e.stopPropagation()} onClick={centerView}>⟲</button>
          </div>

          <svg width="100%" height="100%" style={{ display: "block" }}>
            <defs>
              <marker id="vt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
              {/* Edges (vertical curves) with per-step probability labels. */}
              {visEdges.map(({ from, to }, i) => {
                const x1 = from._px + NODE_W / 2;
                const y1 = from._py + NODE_H;
                const x2 = to._px + NODE_W / 2;
                const y2 = to._py;
                const my = (y1 + y2) / 2;
                const blueCol = BLUE_KIND_COLOR[to.blueAction?.kind] || "rgba(255,255,255,0.3)";
                return (
                  <g key={i}>
                    <path
                      d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                      fill="none"
                      stroke={blueCol}
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                      markerEnd="url(#vt-arrow)"
                    />
                    <text x={(x1 + x2) / 2 + 5} y={my} fontSize="9" fill={TEXT_SECONDARY} fontFamily="var(--font-mono, ui-monospace, monospace)">
                      {fmtProb(to.prob)}
                    </text>
                  </g>
                );
              })}

              {/* Nodes. */}
              {visNodes.map((node) => {
                const st = STATUS_STYLE[nodeStatus(node)];
                const isSel = node.id === selectedId;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node._px},${node._py})`}
                    style={{ cursor: "pointer", animation: `vtFade ${BUILD_STEP_MS / 2}ms ease` }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx="8"
                      fill={st.fill}
                      stroke={isSel ? "#FFD700" : st.stroke}
                      strokeWidth={isSel ? 2.5 : 1.4}
                    />
                    <text x={10} y={17} fontSize="11" fontWeight="600" fill={TEXT_PRIMARY} fontFamily="inherit">
                      {shortLabel(node)}
                    </text>
                    <text x={10} y={31} fontSize="9" fill={TEXT_SECONDARY} fontFamily="var(--font-mono, ui-monospace, monospace)">
                      d{node.depth} · {node.labels.length} held
                    </text>
                    <text x={NODE_W - 8} y={17} textAnchor="end" fontSize="9" fill={st.stroke} fontFamily="var(--font-mono, ui-monospace, monospace)">
                      {fmtProb(pathProb.get(node.id))}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Detail panel for the selected state. */}
        <div style={styles.side}>
          <h3 style={styles.sideTitle}>Selected state</h3>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Status</span>
            <span style={{ ...styles.kvVal, color: STATUS_STYLE[nodeStatus(selected)].stroke }}>
              {STATUS_STYLE[nodeStatus(selected)].label}
            </span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Depth (k-step)</span>
            <span style={styles.kvVal}>{selected.depth}</span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Step prob</span>
            <span style={styles.kvVal}>{fmtProb(selected.prob)}</span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Path prob</span>
            <span style={styles.kvVal}>{fmtProb(pathProb.get(selected.id))}</span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Blue action</span>
            <span style={styles.kvVal}>
              {selected.blueAction
                ? `${selected.blueAction.kind}${selected.blueAction.host ? " " + selected.blueAction.host : ""}`
                : "—"}
            </span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Red outcome</span>
            <span style={styles.kvVal}>{selected.redOutcome || "—"}</span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Restores (total)</span>
            <span style={styles.kvVal}>{selected.restoreStats.total}</span>
          </div>
          <div style={styles.kv}>
            <span style={styles.kvKey}>Children</span>
            <span style={styles.kvVal}>{selected.children.length}</span>
          </div>

          <h3 style={{ ...styles.sideTitle, marginTop: 16 }}>Active labels</h3>
          {selected.labels.length === 0 ? (
            <p style={styles.hint}>No host compromised above scan level.</p>
          ) : (
            <div style={styles.tagRow}>
              {selected.labels.map((l) => (
                <span key={l} style={styles.tag}>{l}</span>
              ))}
            </div>
          )}

          <p style={styles.hint}>
            Press <b>Verify</b> to rebuild the tree top-to-bottom. Click any node
            to inspect its PRISM labels and the Blue/Red step that produced it.
          </p>
        </div>
      </div>
    </div>
  );
}
