import { useEffect, useRef, useState } from "react";
import FileBrowserModal from "./FileBrowserModal";

// Scripted red opponents. Keys must match train_no_vis.SCRIPTED_RED_AGENTS.
export const RED_AGENTS = [
  { key: "meander",  icon: "🌀", name: "Meander",  tag: "Cautious",   desc: "Methodical lateral movement" },
  { key: "bline",    icon: "🎯", name: "B-line",   tag: "Aggressive", desc: "Beelines to the ops server" },
  { key: "random",   icon: "🎲", name: "Random",   tag: "Baseline",   desc: "Valid actions at random" },
  { key: "slowburn", icon: "🐌", name: "SlowBurn", tag: "Stealthy",   desc: "Meander with idle dwell" },
];
const RED_BY_KEY = Object.fromEntries(RED_AGENTS.map((a) => [a.key, a]));

const BLUE = "#3B8BD4";
const RED  = "#E04B4A";
const PPO  = "#9B78F0";
const TEXT_PRIMARY   = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const NODE_W = 164;
const NODE_H = 72;

export function basename(p) {
  if (!p) return "";
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// Describe a member/node for its card: label, sublabel, tag {text,color}, icon.
export function describe(m) {
  if (m.kind === "ppo")
    return { icon: "🧠", label: m.ckpt ? basename(m.ckpt) : "Choose checkpoint…",
             sub: m.ckpt || "No checkpoint selected", tag: { text: "PPO", color: PPO } };
  if (m.kind === "scripted") {
    const a = RED_BY_KEY[m.key];
    return { icon: a?.icon || "⚙️", label: a?.name || m.key, sub: a?.desc || "",
             tag: { text: "Scripted", color: RED } };
  }
  if (m.kind === "scratch")
    return { icon: "✨", label: "Fresh defender", sub: "Trained from scratch",
             tag: { text: "Scratch", color: BLUE } };
  return { icon: "➕", label: "Unconfigured", sub: "Click to configure →",
           tag: { text: "Empty", color: "rgba(255,255,255,0.35)" } };
}

const isConfigured = (m) =>
  m.kind === "scripted" ? !!m.key
  : m.kind === "ppo"    ? (!!m.ckpt && Number(m.dims) > 0)
  : m.kind === "scratch";

const roleAccent = (role) => (role === "defender" ? BLUE : RED);

// team ("blue"/"red", used by TrainModal + backend) <-> role ("defender"/"attacker")
const teamToRole = (team) => (team === "blue" ? "defender" : "attacker");
const roleToTeam = (role) => (role === "defender" ? "blue" : "red");

// Lay imported members out into the two zones as canvas nodes (fractional pos).
function membersToNodes(members) {
  let d = 0, a = 0;
  return members.map((m, i) => {
    const role = teamToRole(m.team);
    const idx = role === "defender" ? d++ : a++;
    return {
      id: m.id ?? i + 1, role, kind: m.kind, key: m.key, ckpt: m.ckpt,
      dims: m.dims ?? 78,
      fx: role === "defender" ? 0.09 : 0.60,
      fy: 0.07 + idx * 0.19,
    };
  });
}

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(6,7,11,0.7)",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1050, padding: 20,
  },
  panel: {
    width: "min(1080px, 96vw)", height: "min(740px, 92vh)",
    display: "flex", flexDirection: "column",
    borderRadius: 20, border: "1px solid var(--modal-border)",
    background: "var(--modal-bg)", boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
    color: TEXT_PRIMARY, overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: 16, padding: "18px 22px 16px", borderBottom: "1px solid var(--modal-border)", flexShrink: 0,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" },
  subtitle: { margin: "5px 0 0 0", fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 },
  headActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  spawnBtn: {
    display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999,
    cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#fff",
    border: "none", background: "linear-gradient(180deg, #6D5AE0, #5A46C8)",
    boxShadow: "0 6px 18px rgba(90,70,200,0.35)",
  },
  closeBtn: {
    border: "none", background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY,
    width: 28, height: 28, borderRadius: 9, cursor: "pointer", fontSize: 16,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit",
  },
  main: { flex: 1, display: "flex", minHeight: 0 },

  canvasWrap: { flex: 1, position: "relative", overflow: "hidden", background: "var(--surface-muted)" },
  canvas: { position: "absolute", inset: 0, userSelect: "none", touchAction: "none" },
  zone: (side) => ({
    position: "absolute", top: 0, bottom: 0,
    left: side === "defender" ? 0 : "50%", width: "50%",
    background: side === "defender"
      ? "linear-gradient(180deg, rgba(59,139,212,0.09), rgba(59,139,212,0.03))"
      : "linear-gradient(180deg, rgba(224,75,74,0.09), rgba(224,75,74,0.03))",
    borderRight: side === "defender" ? "1px dashed rgba(255,255,255,0.12)" : "none",
    pointerEvents: "none",
  }),
  zoneLabel: (side) => ({
    position: "absolute", top: 14, left: side === "defender" ? 16 : "auto",
    right: side === "attacker" ? 16 : "auto",
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
    color: side === "defender" ? "#7FB8EC" : "#F09492", pointerEvents: "none",
  }),
  zoneDot: (c) => ({ width: 9, height: 9, borderRadius: 999, background: c }),
  zoneHint: {
    position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center",
    fontSize: 11, color: TEXT_SECONDARY, pointerEvents: "none",
  },

  node: (role, selected, dragging) => ({
    position: "absolute", width: NODE_W, minHeight: NODE_H, boxSizing: "border-box",
    display: "flex", alignItems: "center", gap: 10, padding: "10px 11px",
    borderRadius: 13, cursor: dragging ? "grabbing" : "grab",
    border: `1.5px solid ${selected ? roleAccent(role) : "var(--modal-border)"}`,
    background: "var(--modal-bg)",
    boxShadow: selected
      ? `0 10px 26px ${roleAccent(role)}44`
      : dragging ? "0 14px 30px rgba(0,0,0,0.45)" : "0 3px 10px rgba(0,0,0,0.25)",
    zIndex: dragging ? 30 : (selected ? 20 : 10),
    transition: dragging ? "none" : "box-shadow .12s, border-color .12s",
  }),
  nodeIcon: { fontSize: 19, lineHeight: 1, flexShrink: 0 },
  nodeMain: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  nodeLabel: { fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  nodeTag: (color) => ({
    fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
    padding: "1px 6px", borderRadius: 999, alignSelf: "flex-start",
    background: `${color}26`, color,
  }),
  nodeRemove: {
    position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: 999,
    border: "1px solid var(--modal-border)", background: "var(--modal-bg)", color: TEXT_SECONDARY,
    cursor: "pointer", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: "inherit",
  },

  // ── Inspector ──
  inspector: {
    width: 312, flexShrink: 0, borderLeft: "1px solid var(--modal-border)",
    background: "var(--modal-bg)", display: "flex", flexDirection: "column", overflowY: "auto",
  },
  inspEmpty: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 10, color: TEXT_SECONDARY, fontSize: 12.5, padding: 28, textAlign: "center", lineHeight: 1.5,
  },
  inspHead: { padding: "16px 18px 12px", borderBottom: "1px solid var(--modal-border)" },
  inspTitle: { fontSize: 13, fontWeight: 700 },
  inspSub: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 3 },
  inspBody: { padding: 18, display: "flex", flexDirection: "column", gap: 16 },
  label: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: TEXT_SECONDARY, marginBottom: 8 },
  segment: { display: "flex", padding: 4, borderRadius: 11, background: "var(--surface-muted)", border: "1px solid var(--modal-border)" },
  segBtn: (accent, active) => ({
    flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
    background: active ? accent : "transparent", color: active ? "#fff" : TEXT_SECONDARY,
    transition: "all .13s",
  }),
  optGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  opt: (accent, selected) => ({
    display: "flex", flexDirection: "column", gap: 4, textAlign: "left",
    padding: "10px 11px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", color: TEXT_PRIMARY,
    border: `1px solid ${selected ? accent : "var(--modal-border)"}`,
    background: selected ? `${accent}1f` : "var(--input-bg)", transition: "all .12s",
  }),
  optTop: { display: "flex", alignItems: "center", gap: 8 },
  optName: { fontSize: 12.5, fontWeight: 700 },
  optDesc: { fontSize: 10.5, color: TEXT_SECONDARY, lineHeight: 1.4 },
  divider: { display: "flex", alignItems: "center", gap: 10, margin: "2px 0" },
  divLine: { flex: 1, height: 1, background: "var(--color-border-secondary)" },
  divText: { fontSize: 10, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  ckptBox: (selected) => ({
    display: "flex", flexDirection: "column", gap: 9, padding: 12, borderRadius: 12,
    border: `1px solid ${selected ? PPO : "var(--modal-border)"}`,
    background: selected ? `${PPO}14` : "var(--input-bg)",
  }),
  ckptPath: { fontSize: 11.5, fontFamily: "var(--font-mono, ui-monospace, monospace)", wordBreak: "break-all", lineHeight: 1.4 },
  ckptPlaceholder: { fontSize: 11.5, color: TEXT_SECONDARY },
  browseBtn: {
    padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${PPO}66`, background: `${PPO}1f`, color: TEXT_PRIMARY, fontSize: 12, fontWeight: 700,
  },
  dimsRow: { display: "flex", alignItems: "center", gap: 8 },
  dimsLabel: { fontSize: 11.5, color: TEXT_SECONDARY },
  dimsInput: {
    width: 84, boxSizing: "border-box", fontSize: 12.5, padding: "7px 9px", borderRadius: 8,
    border: "1px solid var(--modal-border)", background: "var(--modal-bg)", color: TEXT_PRIMARY,
    outline: "none", fontFamily: "inherit",
  },

  footer: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 22px", borderTop: "1px solid var(--modal-border)",
    background: "var(--surface-muted)", flexShrink: 0,
  },
  footHint: { flex: 1, fontSize: 11.5, color: TEXT_SECONDARY },
  cancelBtn: {
    padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)", color: TEXT_PRIMARY,
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  applyBtn: (disabled) => ({
    padding: "9px 20px", borderRadius: 999, border: "none",
    background: disabled ? "rgba(29,158,117,0.25)" : "linear-gradient(180deg, #21B989, #1D9E75)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#fff",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 22px rgba(29,158,117,0.35)",
  }),
};

export default function TeamEditor({ initialMembers, onApply, onClose }) {
  const [nodes, setNodes] = useState(() =>
    membersToNodes(initialMembers && initialMembers.length ? initialMembers : [
      { id: 1, team: "blue", kind: "scratch" },
      { id: 2, team: "red",  kind: "scripted", key: "meander" },
    ])
  );
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [browsing, setBrowsing]     = useState(false);
  const canvasRef = useRef(null);
  const dragRef   = useRef(null);   // { id, offX, offY, startX, startY, moved }
  const uid       = useRef(1000);

  // Drag handling via window listeners while a node is being dragged.
  useEffect(() => {
    if (draggingId == null) return;
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
      const left = clamp(e.clientX - rect.left - d.offX, 0, rect.width - NODE_W);
      const top  = clamp(e.clientY - rect.top  - d.offY, 0, rect.height - NODE_H);
      setNodes((ns) => ns.map((n) => n.id === d.id ? { ...n, fx: left / rect.width, fy: top / rect.height } : n));
    };
    const onUp = (e) => {
      const d = dragRef.current;
      if (d) {
        if (!d.moved) {
          setSelectedId(d.id);
        } else {
          const rect = canvasRef.current.getBoundingClientRect();
          const left = clamp(e.clientX - rect.left - d.offX, 0, rect.width - NODE_W);
          const role = (left + NODE_W / 2) / rect.width < 0.5 ? "defender" : "attacker";
          setNodes((ns) => ns.map((n) => n.id === d.id ? applyRole(n, role) : n));
        }
      }
      dragRef.current = null;
      setDraggingId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !browsing) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, browsing]);

  const selected = nodes.find((n) => n.id === selectedId) || null;
  const patch = (id, fields) => setNodes((ns) => ns.map((n) => n.id === id ? { ...n, ...fields } : n));

  // Coerce a node's kind to something valid for its (new) role.
  function applyRole(n, role) {
    if (n.role === role) return n;
    let kind = n.kind;
    if (role === "defender" && kind === "scripted") kind = "scratch";
    if (role === "attacker" && kind === "scratch")  kind = "unconfigured";
    return { ...n, role, kind, key: kind === "scripted" ? n.key : undefined };
  }

  const setRole = (role) => {
    if (!selected) return;
    setNodes((ns) => ns.map((n) =>
      n.id === selected.id ? { ...applyRole(n, role), fx: role === "defender" ? 0.12 : 0.60 } : n));
  };

  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      id: node.id,
      offX: e.clientX - rect.left - node.fx * rect.width,
      offY: e.clientY - rect.top  - node.fy * rect.height,
      startX: e.clientX, startY: e.clientY, moved: false,
    };
    setDraggingId(node.id);
  };

  const spawn = () => {
    const id = uid.current++;
    setNodes((ns) => [...ns, { id, role: "attacker", kind: "unconfigured", dims: 78, fx: 0.56, fy: 0.42 }]);
    setSelectedId(id);
  };

  const removeNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const defenders = nodes.filter((n) => n.role === "defender");
  const attackers = nodes.filter((n) => n.role === "attacker");
  const allConfigured = nodes.every(isConfigured);
  const canApply = defenders.length >= 1 && attackers.length >= 1 && allConfigured;

  const handleApply = () => {
    if (!canApply) return;
    const members = nodes.map((n) => ({
      id: n.id, team: roleToTeam(n.role), kind: n.kind,
      key: n.key, ckpt: n.ckpt, dims: n.dims,
    }));
    onApply({ members });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>

        <div style={S.header}>
          <div>
            <h3 style={S.title}>Team editor</h3>
            <p style={S.subtitle}>
              Spawn nodes and drag them into the Defenders or Attackers zone. Click a node to set its
              role and configure it as a scripted agent or a checkpoint.
            </p>
          </div>
          <div style={S.headActions}>
            <button style={S.spawnBtn} onClick={spawn}>＋ Spawn node</button>
            <button style={S.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        <div style={S.main}>
          {/* ── Canvas ── */}
          <div style={S.canvasWrap}>
            <div style={S.zone("defender")} />
            <div style={S.zone("attacker")} />
            <div style={S.zoneLabel("defender")}><span style={S.zoneDot(BLUE)} />Defenders</div>
            <div style={S.zoneLabel("attacker")}>Attackers<span style={S.zoneDot(RED)} /></div>
            {nodes.length === 0 && (
              <div style={S.zoneHint}>Nothing here yet — hit “Spawn node” to add one.</div>
            )}

            <div ref={canvasRef} style={S.canvas} onPointerDown={() => setSelectedId(null)}>
              {nodes.map((n) => {
                const d = describe(n);
                const accent = roleAccent(n.role);
                return (
                  <div
                    key={n.id}
                    style={{ ...S.node(n.role, selectedId === n.id, draggingId === n.id),
                             left: `${n.fx * 100}%`, top: `${n.fy * 100}%` }}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                    title={d.sub}
                  >
                    <span style={S.nodeIcon}>{d.icon}</span>
                    <div style={S.nodeMain}>
                      <span style={S.nodeLabel}>{d.label}</span>
                      <span style={S.nodeTag(d.tag.color)}>{d.tag.text}</span>
                    </div>
                    <button
                      style={S.nodeRemove} title="Remove"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); removeNode(n.id); }}
                    >×</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Inspector ── */}
          <div style={S.inspector}>
            {!selected ? (
              <div style={S.inspEmpty}>
                <span style={{ fontSize: 26 }}>🎛️</span>
                <span>Select a node to configure its role and type.</span>
              </div>
            ) : (
              <>
                <div style={S.inspHead}>
                  <div style={S.inspTitle}>{selected.role === "defender" ? "Defender node" : "Attacker node"}</div>
                  <div style={S.inspSub}>
                    {selected.role === "defender" ? "The blue PPO agent being trained." : "A red opponent in the pool."}
                  </div>
                </div>
                <div style={S.inspBody}>

                  {/* Role */}
                  <div>
                    <div style={S.label}>Role</div>
                    <div style={S.segment}>
                      <button style={S.segBtn(BLUE, selected.role === "defender")} onClick={() => setRole("defender")}>🛡️ Defender</button>
                      <button style={S.segBtn(RED,  selected.role === "attacker")} onClick={() => setRole("attacker")}>⚔️ Attacker</button>
                    </div>
                  </div>

                  {/* Type */}
                  {selected.role === "defender" ? (
                    <div>
                      <div style={S.label}>Weights</div>
                      <div style={S.optGrid}>
                        <button style={S.opt(BLUE, selected.kind === "scratch")}
                          onClick={() => patch(selected.id, { kind: "scratch", ckpt: undefined, key: undefined })}>
                          <div style={S.optTop}><span>✨</span><span style={S.optName}>From scratch</span></div>
                          <span style={S.optDesc}>Random init</span>
                        </button>
                        <button style={S.opt(PPO, selected.kind === "ppo")}
                          onClick={() => patch(selected.id, { kind: "ppo", key: undefined })}>
                          <div style={S.optTop}><span>🧠</span><span style={S.optName}>Checkpoint</span></div>
                          <span style={S.optDesc}>Resume .pth</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={S.label}>Scripted agent</div>
                      <div style={S.optGrid}>
                        {RED_AGENTS.map((a) => {
                          const sel = selected.kind === "scripted" && selected.key === a.key;
                          return (
                            <button key={a.key} style={S.opt(RED, sel)}
                              onClick={() => patch(selected.id, { kind: "scripted", key: a.key, ckpt: undefined })}>
                              <div style={S.optTop}><span>{a.icon}</span><span style={S.optName}>{a.name}</span></div>
                              <span style={S.optDesc}>{a.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selected.role === "attacker" && (
                    <div style={S.divider}>
                      <span style={S.divLine} /><span style={S.divText}>or</span><span style={S.divLine} />
                    </div>
                  )}

                  {/* Checkpoint picker — for attacker, or a defender that chose Checkpoint */}
                  {(selected.role === "attacker" || selected.kind === "ppo") && (
                    <div>
                      {selected.role === "attacker" && <div style={S.label}>PPO checkpoint</div>}
                      <div style={S.ckptBox(selected.kind === "ppo" && !!selected.ckpt)}>
                        {selected.kind === "ppo" && selected.ckpt
                          ? <span style={S.ckptPath}>{selected.ckpt}</span>
                          : <span style={S.ckptPlaceholder}>
                              {selected.role === "attacker"
                                ? "Selecting a checkpoint tags this attacker as PPO."
                                : "No checkpoint selected."}
                            </span>}
                        <button style={S.browseBtn} onClick={() => setBrowsing(true)}>
                          {selected.kind === "ppo" && selected.ckpt ? "Change checkpoint…" : "Browse for checkpoint…"}
                        </button>
                        {selected.role === "attacker" && selected.kind === "ppo" && (
                          <div style={S.dimsRow}>
                            <span style={S.dimsLabel}>Input dims</span>
                            <input style={S.dimsInput} type="number" min="1" step="1"
                              value={selected.dims ?? ""}
                              onChange={(e) => patch(selected.id, { dims: e.target.value })}
                              title="Observation dimensions the checkpoint expects" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={S.footer}>
          <span style={S.footHint}>
            {canApply ? "Ready — every node is configured."
              : defenders.length === 0 ? "Add at least one defender."
              : attackers.length === 0 ? "Add at least one attacker."
              : "Finish configuring every node (missing checkpoint or dims)."}
          </span>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.applyBtn(!canApply)} onClick={handleApply} disabled={!canApply}>Apply teams</button>
        </div>
      </div>

      {browsing && selected && (
        <FileBrowserModal
          mode="file"
          initialPath={selected.ckpt || ""}
          onSelect={(path) => {
            patch(selected.id, { kind: "ppo", key: undefined, ckpt: path, dims: selected.dims ?? 78 });
            setBrowsing(false);
          }}
          onClose={() => setBrowsing(false)}
        />
      )}
    </div>
  );
}
