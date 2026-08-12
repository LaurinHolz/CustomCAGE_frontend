import { useState } from "react";
import FileBrowserModal from "./FileBrowserModal";

const TEXT_PRIMARY   = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const STATUS_STYLE = {
  done:    { bg: "rgba(29,158,117,0.12)",  border: "rgba(29,158,117,0.3)",  color: "#3FE0A8", label: "done" },
  resume:  { bg: "rgba(155,120,240,0.12)", border: "rgba(155,120,240,0.3)", color: "#B79CF5", label: "resume" },
  fresh:   { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", color: TEXT_SECONDARY, label: "not started" },
};

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(8,9,14,0.6)",
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    width: "min(600px, 100%)", maxHeight: "min(860px, 92vh)",
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
  body: { padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 },
  sectionLabel: {
    margin: "0 0 10px 0", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY,
  },
  input: {
    width: "100%", boxSizing: "border-box", fontSize: 13, padding: "10px 12px",
    borderRadius: 10, border: "1px solid var(--modal-border)",
    background: "var(--input-bg)", color: TEXT_PRIMARY, outline: "none", fontFamily: "inherit",
  },
  inputRow: { display: "flex", gap: 8, alignItems: "stretch" },
  browseBtn: {
    flexShrink: 0, padding: "0 13px", height: 42, borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
    color: TEXT_PRIMARY, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  hint: { margin: "6px 0 0 0", fontSize: 11.5, color: TEXT_SECONDARY },
  errorBox: {
    padding: "10px 12px", borderRadius: 10, fontSize: 12.5,
    background: "rgba(224,75,74,0.08)", border: "1px solid rgba(224,75,74,0.3)", color: "#E88",
  },
  jobList: {
    display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto",
    padding: 12, borderRadius: 14, border: "1px solid var(--modal-border)", background: "var(--surface-muted)",
  },
  jobRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  jobPhase: { color: TEXT_SECONDARY, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", width: 62, flexShrink: 0 },
  jobName: { flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  badge: (s) => ({
    flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
    background: s.bg, border: `1px solid ${s.border}`, color: s.color,
  }),
  summary: { fontSize: 12.5, color: TEXT_SECONDARY },
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
    background: disabled ? "rgba(155,120,240,0.25)" : "linear-gradient(180deg, #B79CF5, #9B78F0)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#fff",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 22px rgba(155,120,240,0.35)",
  }),
};

export default function ResumeModal({ onClose, onResume }) {
  const [runDir, setRunDir]   = useState("");
  const [browser, setBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [info, setInfo]       = useState(null); // { curriculum, maxEpisodes, maxTimesteps, jobs }

  const [maxEpisodes, setMaxEpisodes]   = useState("");
  const [maxTimesteps, setMaxTimesteps] = useState("");

  const load = async (dir) => {
    setRunDir(dir);
    setInfo(null);
    setError(null);
    if (!dir.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:9999/run-info?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setInfo(data);
      setMaxEpisodes(data.maxEpisodes != null ? String(data.maxEpisodes) : "");
      setMaxTimesteps(data.maxTimesteps != null ? String(data.maxTimesteps) : "100");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const maxEp = Math.max(1, parseInt(maxEpisodes, 10) || 0);
  const maxTs = Math.max(1, parseInt(maxTimesteps, 10) || 0);
  const canRun = !!info && !loading && maxEp > 0 && maxTs > 0;

  const doneCount   = info ? info.jobs.filter((j) => j.status === "done").length : 0;
  const resumeCount = info ? info.jobs.filter((j) => j.status === "resume").length : 0;
  const freshCount  = info ? info.jobs.filter((j) => j.status === "fresh").length : 0;

  const handleRun = () => {
    if (!canRun) return;
    onResume({ curriculum: info.curriculum, resumeDir: runDir, maxEpisodes: maxEp, maxTimesteps: maxTs });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Resume training</h3>
            <p style={styles.subtitle}>
              Continue an interrupted curriculum run — finished jobs are skipped,
              in-progress jobs pick up from their latest saved checkpoint.
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <div>
            <div style={styles.sectionLabel}>Run folder</div>
            <div style={styles.inputRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="output/training_run_2026-08-08_17-08-54"
                value={runDir}
                onChange={(e) => setRunDir(e.target.value)}
                onBlur={(e) => load(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") load(runDir); }}
              />
              <button style={styles.browseBtn} title="Browse…" onClick={() => setBrowser(true)}>⋯</button>
            </div>
            <p style={styles.hint}>The exact folder from the earlier attempt — must contain its curriculum.json.</p>
          </div>

          {loading && <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>Loading run status…</div>}
          {error && <div style={styles.errorBox}>{error}</div>}

          {info && (
            <>
              <div>
                <div style={styles.sectionLabel}>Job status ({info.jobs.length})</div>
                <div style={styles.jobList}>
                  {info.jobs.map((j) => {
                    const s = STATUS_STYLE[j.status] || STATUS_STYLE.fresh;
                    const label = j.status === "resume" ? `resume @ ${j.fromEpisode}` : s.label;
                    return (
                      <div key={j.job_name} style={styles.jobRow}>
                        <span style={styles.jobPhase}>{j.phase}</span>
                        <span style={styles.jobName} title={j.job_name}>{j.job_name}</span>
                        <span style={styles.badge(s)}>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <p style={styles.summary}>
                  {doneCount} done · {resumeCount} to resume · {freshCount} not started yet
                </p>
              </div>

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
                <p style={styles.hint}>
                  {info.maxEpisodes != null
                    ? "Read back from this run's own record — should normally match what it was started with."
                    : "Not recorded for this run (started before this feature existed) — inferred from its furthest saved checkpoint. Double-check before running."}
                </p>
              </div>
            </>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.runBtn(!canRun)} onClick={handleRun} disabled={!canRun}>
            Resume training
          </button>
        </div>
      </div>

      {browser && (
        <FileBrowserModal
          mode="dir"
          initialPath={runDir}
          onSelect={(path) => { setBrowser(false); load(path); }}
          onClose={() => setBrowser(false)}
        />
      )}
    </div>
  );
}
