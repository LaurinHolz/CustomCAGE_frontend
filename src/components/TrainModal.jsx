import { useEffect, useState } from "react";
import FileBrowserModal from "./FileBrowserModal";
import CurriculumEditor, { describe, basename, deriveRun, DEFAULT_CURRICULUM } from "./CurriculumEditor";

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

export default function TrainModal({ onClose, onRun }) {
  const [curriculum, setCurriculum] = useState(DEFAULT_CURRICULUM);
  const [editorOpen, setEditorOpen] = useState(false);
  const members = deriveRun(curriculum).members;

  const [ckptDir, setCkptDir]                 = useState("meander_ppo");
  const [saveDirOverride, setSaveDirOverride] = useState("");

  const [maxEpisodes, setMaxEpisodes]   = useState(100000);
  const [maxTimesteps, setMaxTimesteps] = useState(100);
  const [makeVideo, setMakeVideo]       = useState(true);

  // File browser for the save directory: { target: "ckptDir" | "saveDir" }
  const [browser, setBrowser] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !editorOpen && !browser) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editorOpen, browser]);

  // ── Derive teams from members ──
  const blueMember = members.find((m) => m.team === "blue") || null;
  const redMembers = members.filter((m) => m.team === "red");
  const blueCkptPath = blueMember && blueMember.kind === "ppo" ? blueMember.ckpt : null;
  const redTeam = redMembers.map((m) =>
    m.kind === "ppo" ? { type: "ppo", ckpt: m.ckpt, dims: Number(m.dims) }
                     : { type: "scripted", key: m.key });

  const mode         = blueCkptPath ? "continue" : "scratch";
  const startEpisode = blueCkptPath ? (inferEpisode(basename(blueCkptPath)) ?? 1) : 1;
  const autoSaveDir  = dirOf(blueCkptPath);
  const saveDir      = mode === "scratch" ? ckptDir : (saveDirOverride.trim() || autoSaveDir);
  const maxEp        = Math.max(1, parseInt(maxEpisodes, 10) || 100000);
  const episodeValid = mode !== "continue" || maxEp > startEpisode;

  const teamsValid = redTeam.length >= 1;
  const dirValid   = mode === "scratch" ? ckptDir.trim() !== "" : saveDir !== "";
  const canRun     = teamsValid && episodeValid && dirValid;

  const handleApplyTeams = ({ curriculum: c }) => {
    setCurriculum(c);
    setEditorOpen(false);
  };

  const handleRun = () => {
    if (!canRun) return;
    onRun({
      ckptDir:      saveDir,
      ckptPath:     blueCkptPath,
      startEpisode: mode === "continue" ? startEpisode : 1,
      maxEpisodes:  maxEp,
      maxTimesteps: Math.max(1, parseInt(maxTimesteps, 10) || 100),
      makeVideo,
      redTeam,
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

          {/* ── Curriculum summary + editor launcher ── */}
          <div>
            <div style={styles.sectionLabel}>Curriculum · first-phase matchup</div>
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
                      {mode === "continue" && <span style={styles.chipTag(BLUE)}>ep {startEpisode}</span>}
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
                ? `${curriculum.phases.length} phases authored — training runs the first phase's matchup for now.`
                : redMembers.length > 1
                  ? "One attacker is drawn at random from the pool each episode."
                  : "Author phases and matchups in the editor."}
            </p>
          </div>

          {/* ── Save location ── */}
          {mode === "scratch" ? (
            <div>
              <div style={styles.sectionLabel}>Checkpoint directory</div>
              <div style={styles.inputRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="meander_ppo"
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
          onApply={handleApplyTeams}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {browser && (
        <FileBrowserModal
          mode="dir"
          initialPath={browser.target === "ckptDir" ? ckptDir : (saveDirOverride || autoSaveDir)}
          onSelect={(path) => {
            if (browser.target === "ckptDir") setCkptDir(path);
            else setSaveDirOverride(path);
            setBrowser(null);
          }}
          onClose={() => setBrowser(null)}
        />
      )}
    </div>
  );
}
