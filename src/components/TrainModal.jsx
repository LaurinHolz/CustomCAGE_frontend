import { useEffect, useState } from "react";
import FileBrowserModal from "./FileBrowserModal";
import CurriculumEditor, {
  describe, basename, deriveRun, DEFAULT_CURRICULUM, RED_AGENTS, recommendedDims,
} from "./CurriculumEditor";

const TEXT_PRIMARY   = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(8,9,14,0.6)",
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    width: "min(560px, 100%)", maxHeight: "min(860px, 92vh)",
    display: "flex", flexDirection: "column",
    borderRadius: 18, border: "1px solid var(--modal-border)",
    background: "var(--modal-bg)", boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
    color: TEXT_PRIMARY, overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: 16, padding: "20px 24px 16px 24px", borderBottom: "1px solid var(--modal-border)",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" },
  subtitle: { margin: "6px 0 0 0", fontSize: 12.5, color: TEXT_SECONDARY, lineHeight: 1.5 },
  closeBtn: {
    border: "none", background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY,
    width: 28, height: 28, borderRadius: 9, cursor: "pointer", fontSize: 16,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit",
  },
  body: { padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 },
  sectionLabel: {
    margin: "0 0 10px 0", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY,
  },
  input: {
    width: "100%", boxSizing: "border-box", fontSize: 13, padding: "10px 12px",
    borderRadius: 10, border: "1px solid var(--modal-border)",
    background: "var(--input-bg)", color: TEXT_PRIMARY, outline: "none", fontFamily: "inherit",
  },
  hint: { margin: "6px 0 0 0", fontSize: 11.5, color: TEXT_SECONDARY },
  browseBtn: {
    flexShrink: 0, padding: "0 13px", height: 42, borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
    color: TEXT_PRIMARY, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  inputRow: { display: "flex", gap: 8, alignItems: "stretch" },

  // ── Teams summary ──
  teamsCard: {
    display: "flex", flexDirection: "column", gap: 12,
    padding: 16, borderRadius: 14,
    border: "1px solid var(--modal-border)", background: "var(--surface-muted)",
  },
  teamRow: { display: "flex", flexDirection: "column", gap: 8 },
  teamRowHead: { display: "flex", alignItems: "center", gap: 8 },
  teamDot: (c) => ({ width: 9, height: 9, borderRadius: 999, background: c }),
  teamRowLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: TEXT_SECONDARY },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: (color) => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "5px 10px", borderRadius: 999,
    border: `1px solid ${color}44`, background: `${color}14`,
    fontSize: 12, fontWeight: 600, maxWidth: "100%",
  }),
  chipLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 },
  chipTag: (color) => ({ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color }),
  editBtn: {
    marginTop: 2, padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
    border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)",
    color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  },

  // ── Curriculum-editing toggle + simple training-setup picker ──
  toggleRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px", borderRadius: 12,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
  },
  toggleBtn: (on) => ({
    position: "relative", width: 44, height: 24, borderRadius: 999,
    border: "none", cursor: "pointer", flexShrink: 0,
    background: on ? "#6D5AE0" : "rgba(255,255,255,0.12)", transition: "background .2s",
  }),
  toggleKnob: (on) => ({
    position: "absolute", top: 2, left: on ? 22 : 2,
    width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s",
  }),
  sideSegment: {
    display: "flex", padding: 4, borderRadius: 11, gap: 4,
    background: "var(--input-bg)", border: "1px solid var(--modal-border)",
  },
  sideSegBtn: (accent, active) => ({
    flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
    background: active ? accent : "transparent", color: active ? "#fff" : TEXT_SECONDARY,
  }),
  oppGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  oppOpt: (accent, selected) => ({
    display: "flex", flexDirection: "column", gap: 4, textAlign: "left",
    padding: "9px 10px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", color: TEXT_PRIMARY,
    border: `1px solid ${selected ? accent : "var(--modal-border)"}`, background: selected ? `${accent}1f` : "var(--input-bg)",
  }),
  oppOptTop: { display: "flex", alignItems: "center", gap: 7 },
  oppOptName: { fontSize: 12, fontWeight: 700 },
  oppOptDesc: { fontSize: 10, color: TEXT_SECONDARY, lineHeight: 1.35 },
  oppDivider: { display: "flex", alignItems: "center", gap: 10, margin: "10px 0" },
  oppDivLine: { flex: 1, height: 1, background: "var(--color-border-secondary, rgba(255,255,255,0.12))" },
  oppDivText: { fontSize: 10, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  ckptBox: (selected) => ({
    display: "flex", flexDirection: "column", gap: 9, padding: 12, borderRadius: 12,
    border: `1px solid ${selected ? "#9B78F0" : "var(--modal-border)"}`, background: selected ? "rgba(155,120,240,0.08)" : "var(--input-bg)",
  }),
  ckptPath: { fontSize: 11.5, fontFamily: "var(--font-mono, ui-monospace, monospace)", wordBreak: "break-all", lineHeight: 1.4 },
  ckptPlaceholder: { fontSize: 11.5, color: TEXT_SECONDARY },
  ckptBrowseBtn: {
    padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
    border: "1px solid rgba(155,120,240,0.4)", background: "rgba(155,120,240,0.12)", color: TEXT_PRIMARY,
    fontSize: 12, fontWeight: 700, alignSelf: "flex-start",
  },
  dimsRow: { display: "flex", alignItems: "center", gap: 8 },
  dimsLabel: { fontSize: 11.5, color: TEXT_SECONDARY },
  dimsInput: {
    width: 84, boxSizing: "border-box", fontSize: 12.5, padding: "7px 9px", borderRadius: 8,
    border: "1px solid var(--modal-border)", background: "var(--modal-bg)", color: TEXT_PRIMARY, outline: "none", fontFamily: "inherit",
  },

  numbersRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  numberField: { display: "flex", flexDirection: "column", gap: 6 },
  numberLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: TEXT_SECONDARY },
  footer: {
    display: "flex", justifyContent: "flex-end", gap: 10,
    padding: "16px 24px", borderTop: "1px solid var(--modal-border)", background: "var(--surface-muted)",
  },
  cancelBtn: {
    padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)", color: TEXT_PRIMARY,
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  runBtn: (disabled) => ({
    padding: "9px 18px", borderRadius: 999, border: "none",
    background: disabled ? "rgba(29,158,117,0.25)" : "linear-gradient(180deg, #21B989, #1D9E75)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#fff",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 22px rgba(29,158,117,0.35)",
  }),
};

const BLUE = "#3B8BD4";
const RED  = "#E04B4A";

function dirOf(p) {
  if (!p) return "";
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : "";
}

function inferEpisode(name) {
  const m = name.match(/^(\d+)\.pth$/);
  return m ? parseInt(m[1], 10) : null;
}

export default function TrainModal({ onClose, onRun, hostCount }) {
  const [curriculum, setCurriculum] = useState(DEFAULT_CURRICULUM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [curriculumEditingEnabled, setCurriculumEditingEnabled] = useState(false);
  const members = deriveRun(curriculum).members;

  const [ckptDir, setCkptDir]                 = useState("output");
  const [saveDirOverride, setSaveDirOverride] = useState("");

  const [maxEpisodes, setMaxEpisodes]   = useState(100000);
  const [maxTimesteps, setMaxTimesteps] = useState(100);
  const [makeVideo, setMakeVideo]       = useState(true);

  // File browser: { target: "ckptDir" | "saveDir" | "oppCkpt", role? }
  const [browser, setBrowser] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !editorOpen && !browser) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editorOpen, browser]);

  // ── Derive teams from members ──
  const blueMember = members.find((m) => m.team === "blue") || null;
  const redMembers = members.filter((m) => m.team === "red");
  const redTeam = redMembers.map((m) =>
    m.kind === "ppo" ? { type: "ppo", ckpt: m.ckpt, dims: Number(m.dims) }
                     : { type: "scripted", key: m.key });

  // ── Simple-mode single-matchup helpers (curriculum editing disabled) ──
  const phase0       = curriculum.phases[0];
  const trainingSide = phase0?.trainingSide || "defender";
  const defNode = curriculum.nodes.find((n) => n.phaseId === phase0?.id && n.role === "defender");
  const atkNode = curriculum.nodes.find((n) => n.phaseId === phase0?.id && n.role === "attacker");
  const recDims = (role) => recommendedDims(role, hostCount);

  const setSimpleSide = (side) => {
    setCurriculum((c) => {
      const phase = { ...c.phases[0], trainingSide: side };
      const nodes = c.nodes.map((n) => {
        if (n.phaseId !== phase.id) return n;
        if (n.role === side) // now the trained side — always starts from scratch
          return n.kind === "scratch" ? n : { ...n, kind: "scratch", ckpt: undefined, key: undefined, refNodeId: undefined };
        if (n.role === "defender") // now the fixed opponent — defender can't be scripted
          return n.kind === "ppo" ? n : { ...n, kind: "ppo", key: undefined, refNodeId: undefined, dims: n.dims ?? recDims("defender") };
        return (n.kind === "scripted" || n.kind === "ppo") ? n : { ...n, kind: "scripted", key: "meander", ckpt: undefined, refNodeId: undefined };
      });
      return { ...c, phases: [phase], nodes };
    });
  };
  const setSimpleScripted = (key) => {
    setCurriculum((c) => ({
      ...c,
      nodes: c.nodes.map((n) => n.role === "attacker" ? { ...n, kind: "scripted", key, ckpt: undefined, refNodeId: undefined } : n),
    }));
  };
  const setSimpleCheckpoint = (role, path) => {
    setCurriculum((c) => ({
      ...c,
      nodes: c.nodes.map((n) => n.role === role
        ? { ...n, kind: "ppo", ckpt: path, dims: n.dims ?? recDims(role), key: undefined, refNodeId: undefined }
        : n),
    }));
  };
  const setSimpleDims = (role, dims) => {
    setCurriculum((c) => ({ ...c, nodes: c.nodes.map((n) => n.role === role ? { ...n, dims } : n) }));
  };

  // Which side is actually training this run — determines whose checkpoint
  // (if any) is being *continued* vs. which side is just a fixed opponent.
  const trainedMember   = trainingSide === "defender" ? blueMember : (redMembers[0] || null);
  const trainedCkptPath = trainedMember && trainedMember.kind === "ppo" ? trainedMember.ckpt : null;

  const mode         = trainedCkptPath ? "continue" : "scratch";
  const startEpisode = trainedCkptPath ? (inferEpisode(basename(trainedCkptPath)) ?? 1) : 1;
  const autoSaveDir  = dirOf(trainedCkptPath);
  const saveDir      = mode === "scratch" ? ckptDir : (saveDirOverride.trim() || autoSaveDir);
  const maxEp        = Math.max(1, parseInt(maxEpisodes, 10) || 100000);
  const episodeValid = mode !== "continue" || maxEp > startEpisode;

  const teamsValid = trainingSide === "defender"
    ? redTeam.length >= 1
    : !!(blueMember && blueMember.kind === "ppo" && blueMember.ckpt);
  const dirValid   = mode === "scratch" ? ckptDir.trim() !== "" : saveDir !== "";
  const canRun     = teamsValid && episodeValid && dirValid;

  const handleApplyTeams = ({ curriculum: c }) => {
    setCurriculum(c);
    setEditorOpen(false);
  };

  const handleRun = () => {
    if (!canRun) return;
    onRun({
      curriculum,
      ckptDir:      saveDir,
      maxEpisodes:  maxEp,
      maxTimesteps: Math.max(1, parseInt(maxTimesteps, 10) || 100),
      makeVideo,
    });
  };

  const blueDesc = blueMember ? describe(blueMember) : null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Configure training</h3>
            <p style={styles.subtitle}>Assemble the blue and red teams, then set the run parameters.</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>

          {/* ── Curriculum-editing toggle ── */}
          <div style={styles.toggleRow}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Curriculum editing</span>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                Author multi-phase matchups and chained checkpoints
              </span>
            </div>
            <button
              onClick={() => setCurriculumEditingEnabled((v) => !v)}
              style={styles.toggleBtn(curriculumEditingEnabled)}
            >
              <span style={styles.toggleKnob(curriculumEditingEnabled)} />
            </button>
          </div>

          {curriculumEditingEnabled ? (
            /* ── Curriculum summary + editor launcher ── */
            <div>
              <div style={styles.sectionLabel}>Curriculum · first matchup preview</div>
              <div style={styles.teamsCard}>
                {/* Blue */}
                <div style={styles.teamRow}>
                  <div style={styles.teamRowHead}>
                    <span style={styles.teamDot(BLUE)} />
                    <span style={styles.teamRowLabel}>Blue · defender</span>
                  </div>
                  <div style={styles.chipWrap}>
                    {blueDesc ? (
                      <span style={styles.chip(BLUE)} title={blueDesc.sub}>
                        <span>{blueDesc.icon}</span>
                        <span style={styles.chipLabel}>{blueDesc.label}</span>
                        {mode === "continue" && trainingSide === "defender" && <span style={styles.chipTag(BLUE)}>ep {startEpisode}</span>}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>No defender — add one in the editor.</span>
                    )}
                  </div>
                </div>

                {/* Red */}
                <div style={styles.teamRow}>
                  <div style={styles.teamRowHead}>
                    <span style={styles.teamDot(RED)} />
                    <span style={styles.teamRowLabel}>Red · attacker pool ({redMembers.length})</span>
                  </div>
                  <div style={styles.chipWrap}>
                    {redMembers.length === 0 ? (
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Empty — add attackers in the editor.</span>
                    ) : redMembers.map((m) => {
                      const d = describe(m);
                      return (
                        <span key={m.id} style={styles.chip(d.tag.color)} title={d.sub}>
                          <span>{d.icon}</span>
                          <span style={styles.chipLabel}>{d.label}</span>
                          <span style={styles.chipTag(d.tag.color)}>{d.tag.text}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button style={styles.editBtn} onClick={() => setEditorOpen(true)}>
                  ✎ Edit curriculum
                </button>
              </div>
              <p style={styles.hint}>
                {curriculum.phases.length > 1
                  ? `${curriculum.phases.length} phases — trained in chain order, each checkpoint fed to its downstream matchups.`
                  : redMembers.length > 1
                    ? "One attacker is drawn at random from the pool each episode."
                    : "Author phases and matchups in the editor."}
              </p>
            </div>
          ) : (
            /* ── Simple training setup: side to train + a single opponent ── */
            <div>
              <div style={styles.sectionLabel}>Training setup</div>
              <div style={styles.teamsCard}>
                <div>
                  <div style={styles.teamRowLabel}>Side to train</div>
                  <div style={styles.sideSegment}>
                    <button style={styles.sideSegBtn(BLUE, trainingSide === "defender")} onClick={() => setSimpleSide("defender")}>
                      🛡️ Defender
                    </button>
                    <button style={styles.sideSegBtn(RED, trainingSide === "attacker")} onClick={() => setSimpleSide("attacker")}>
                      ⚔️ Attacker
                    </button>
                  </div>
                </div>

                {trainingSide === "defender" ? (
                  <div>
                    <div style={{ ...styles.teamRowLabel, marginBottom: 8 }}>Opponent</div>
                    <div style={styles.oppGrid}>
                      {RED_AGENTS.map((a) => {
                        const sel = atkNode?.kind === "scripted" && atkNode.key === a.key;
                        return (
                          <button key={a.key} style={styles.oppOpt(RED, sel)} onClick={() => setSimpleScripted(a.key)}>
                            <span style={styles.oppOptTop}><span>{a.icon}</span><span style={styles.oppOptName}>{a.name}</span></span>
                            <span style={styles.oppOptDesc}>{a.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={styles.oppDivider}>
                      <span style={styles.oppDivLine} /><span style={styles.oppDivText}>or a checkpoint</span><span style={styles.oppDivLine} />
                    </div>
                    <div style={styles.ckptBox(atkNode?.kind === "ppo" && !!atkNode?.ckpt)}>
                      {atkNode?.kind === "ppo" && atkNode.ckpt
                        ? <span style={styles.ckptPath}>{atkNode.ckpt}</span>
                        : <span style={styles.ckptPlaceholder}>No checkpoint selected.</span>}
                      <button style={styles.ckptBrowseBtn} onClick={() => setBrowser({ target: "oppCkpt", role: "attacker" })}>
                        {atkNode?.kind === "ppo" && atkNode.ckpt ? "Change checkpoint…" : "Browse for checkpoint…"}
                      </button>
                      {atkNode?.kind === "ppo" && (
                        <div style={styles.dimsRow}>
                          <span style={styles.dimsLabel}>Input dims</span>
                          <input style={styles.dimsInput} type="number" min="1" step="1" value={atkNode.dims ?? ""}
                            onChange={(e) => setSimpleDims("attacker", e.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ ...styles.teamRowLabel, marginBottom: 8 }}>Opponent checkpoint (blue defender)</div>
                    <div style={styles.ckptBox(!!defNode?.ckpt)}>
                      {defNode?.ckpt
                        ? <span style={styles.ckptPath}>{defNode.ckpt}</span>
                        : <span style={styles.ckptPlaceholder}>No checkpoint selected — required to train an attacker.</span>}
                      <button style={styles.ckptBrowseBtn} onClick={() => setBrowser({ target: "oppCkpt", role: "defender" })}>
                        {defNode?.ckpt ? "Change checkpoint…" : "Browse for checkpoint…"}
                      </button>
                      <div style={styles.dimsRow}>
                        <span style={styles.dimsLabel}>Input dims</span>
                        <input style={styles.dimsInput} type="number" min="1" step="1" value={defNode?.dims ?? ""}
                          onChange={(e) => setSimpleDims("defender", e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Save location ── */}
          {mode === "scratch" ? (
            <div>
              <div style={styles.sectionLabel}>Checkpoint directory</div>
              <div style={styles.inputRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="output"
                  value={ckptDir}
                  onChange={(e) => setCkptDir(e.target.value)}
                />
                <button style={styles.browseBtn} title="Browse…" onClick={() => setBrowser({ target: "ckptDir" })}>⋯</button>
              </div>
              <p style={styles.hint}>Directory will be created automatically if it does not exist.</p>
            </div>
          ) : (
            <div>
              <div style={{
                padding: "12px 14px", borderRadius: 12, marginBottom: 14, display: "flex", flexDirection: "column", gap: 5,
                background: episodeValid ? "rgba(29,158,117,0.08)" : "rgba(224,75,74,0.08)",
                border: `1px solid ${episodeValid ? "rgba(29,158,117,0.25)" : "rgba(224,75,74,0.3)"}`,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: episodeValid ? "#3FE0A8" : "#E24B4A" }}>
                  {episodeValid ? "Resuming" : "Invalid range"}
                </span>
                {episodeValid ? (
                  <span style={{ fontSize: 12.5 }}>
                    Inferred start: episode <strong>{startEpisode}</strong>
                    {maxEp > startEpisode && <> → trains until episode <strong>{maxEp}</strong> ({maxEp - startEpisode} new episodes)</>}
                  </span>
                ) : (
                  <span style={{ fontSize: 12.5, color: "#E24B4A" }}>
                    Max episodes ({maxEp}) must exceed checkpoint episode ({startEpisode}).
                  </span>
                )}
              </div>
              <div style={styles.sectionLabel}>Save checkpoints to</div>
              <div style={styles.inputRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder={autoSaveDir || "same directory as checkpoint"}
                  value={saveDirOverride}
                  onChange={(e) => setSaveDirOverride(e.target.value)}
                />
                <button style={styles.browseBtn} title="Browse…" onClick={() => setBrowser({ target: "saveDir" })}>⋯</button>
              </div>
              <p style={styles.hint}>Leave blank to save alongside the loaded checkpoint.</p>
            </div>
          )}

          {/* ── Training parameters ── */}
          <div>
            <div style={styles.sectionLabel}>Training parameters</div>
            <div style={styles.numbersRow}>
              <div style={styles.numberField}>
                <label style={styles.numberLabel}>Steps per episode</label>
                <input style={styles.input} type="number" min="1" step="1"
                  value={maxTimesteps} onChange={(e) => setMaxTimesteps(e.target.value)} />
              </div>
              <div style={styles.numberField}>
                <label style={styles.numberLabel}>Max episodes</label>
                <input style={styles.input} type="number" min="1" step="1"
                  value={maxEpisodes} onChange={(e) => setMaxEpisodes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Make Video toggle ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Make video</span>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                Capture screenshots and compile a video after training ends
              </span>
            </div>
            <button
              onClick={() => setMakeVideo(v => !v)}
              style={{
                position: "relative", width: 44, height: 24, borderRadius: 999,
                border: "none", cursor: "pointer", flexShrink: 0,
                background: makeVideo ? "#1D9E75" : "rgba(255,255,255,0.12)", transition: "background .2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: makeVideo ? 22 : 2,
                width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s",
              }}/>
            </button>
          </div>

        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.runBtn(!canRun)} onClick={handleRun} disabled={!canRun}>
            Start training
          </button>
        </div>
      </div>

      {editorOpen && (
        <CurriculumEditor
          initialCurriculum={curriculum}
          hostCount={hostCount}
          onApply={handleApplyTeams}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {browser && (
        <FileBrowserModal
          mode={browser.target === "oppCkpt" ? "file" : "dir"}
          initialPath={
            browser.target === "ckptDir" ? ckptDir
            : browser.target === "oppCkpt" ? ((browser.role === "defender" ? defNode : atkNode)?.ckpt || "")
            : (saveDirOverride || autoSaveDir)
          }
          onSelect={(path) => {
            if (browser.target === "ckptDir") setCkptDir(path);
            else if (browser.target === "oppCkpt") setSimpleCheckpoint(browser.role, path);
            else setSaveDirOverride(path);
            setBrowser(null);
          }}
          onClose={() => setBrowser(null)}
        />
      )}
    </div>
  );
}
