import { useCallback, useEffect, useState } from "react";
import FileBrowserModal from "./FileBrowserModal";

const CHECKPOINTS_URL = "http://127.0.0.1:9999/checkpoints";

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
    width: "min(580px, 100%)", maxHeight: "min(820px, 90vh)",
    display: "flex", flexDirection: "column",
    borderRadius: 18, border: "1px solid rgba(255,255,255,0.09)",
    background: "linear-gradient(165deg, rgba(38,40,48,0.98), rgba(17,18,23,0.99))",
    boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
    color: TEXT_PRIMARY, overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: 16, padding: "20px 24px 16px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" },
  subtitle: { margin: "6px 0 0 0", fontSize: 12.5, color: TEXT_SECONDARY, lineHeight: 1.5 },
  closeBtn: {
    border: "none", background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY,
    width: 28, height: 28, borderRadius: 9, cursor: "pointer", fontSize: 16,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    fontFamily: "inherit", transition: "background .15s, color .15s",
  },
  body: { padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 },
  sectionLabel: {
    margin: "0 0 10px 0", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY,
  },
  segment: {
    display: "flex", padding: 4, borderRadius: 12,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
  },
  segmentBtn: (active) => ({
    flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.01em",
    background: active ? "linear-gradient(180deg, #4AA0E6, #3B8BD4)" : "transparent",
    color: active ? "#fff" : TEXT_SECONDARY,
    boxShadow: active ? "0 6px 16px rgba(59,139,212,0.35)" : "none",
    transition: "all .15s",
  }),
  input: {
    width: "100%", boxSizing: "border-box", fontSize: 13, padding: "10px 12px",
    borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.25)", color: TEXT_PRIMARY,
    outline: "none", fontFamily: "inherit",
  },
  hint: { margin: "6px 0 0 0", fontSize: 11.5, color: TEXT_SECONDARY },
  browseBtn: {
    flexShrink: 0, padding: "0 13px", height: 42, borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
    color: TEXT_PRIMARY, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background .15s",
  },
  inputRow: { display: "flex", gap: 8, alignItems: "stretch" },
  emptyState: {
    padding: "16px 14px", borderRadius: 12, background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.06)", color: TEXT_SECONDARY,
    fontSize: 12.5, textAlign: "center",
  },
  list: {
    maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column",
    gap: 4, padding: 4, borderRadius: 12,
    background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)",
  },
  listItem: (selected, hovered) => ({
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 9, cursor: "pointer",
    border: `1px solid ${selected ? "rgba(59,139,212,0.5)" : "transparent"}`,
    background: selected ? "rgba(59,139,212,0.12)" : (hovered ? "rgba(255,255,255,0.05)" : "transparent"),
    transition: "all .12s",
  }),
  itemMain: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemPath: { fontSize: 11, color: TEXT_SECONDARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemMeta: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  itemBadge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: TEXT_SECONDARY },
  itemTime: { fontSize: 11, color: TEXT_SECONDARY, whiteSpace: "nowrap" },
  dividerRow: { display: "flex", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, background: "rgba(255,255,255,0.08)" },
  dividerText: { fontSize: 11, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  numbersRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  numberField: { display: "flex", flexDirection: "column", gap: 6 },
  numberLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: TEXT_SECONDARY },
  footer: {
    display: "flex", justifyContent: "flex-end", gap: 10,
    padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.15)",
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
    transition: "all .15s",
  }),
};

function basename(p) {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function dirOf(p) {
  if (!p) return "";
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx > 0 ? p.slice(0, idx) : "";
}

function inferEpisode(name) {
  const m = name.match(/^(\d+)\.pth$/);
  return m ? parseInt(m[1], 10) : null;
}

function fmtAgo(mtime) {
  if (!Number.isFinite(mtime)) return "";
  const diff = Date.now() / 1000 - mtime;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TrainModal({ onClose, onRun }) {
  const [mode, setMode] = useState("scratch");

  // Scratch mode
  const [ckptDir, setCkptDir] = useState("meander_ppo");

  // Continue mode
  const [data, setData]           = useState({ checkpoints: [], latest: null });
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch]       = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [customPath, setCustomPath]     = useState("");
  const [hoveredPath, setHoveredPath]   = useState(null);
  const [saveDirOverride, setSaveDirOverride] = useState("");

  // Shared
  const [maxEpisodes, setMaxEpisodes]   = useState(100000);
  const [maxTimesteps, setMaxTimesteps] = useState(100);
  const [makeVideo, setMakeVideo]       = useState(true);

  // File browser: { mode: "dir"|"file", target: "ckptDir"|"ckptFile"|"saveDir" } | null
  const [browser, setBrowser] = useState(null);

  const handleBrowseSelect = (path) => {
    if (browser?.target === "ckptDir")  setCkptDir(path);
    if (browser?.target === "ckptFile") { setCustomPath(path); setSelectedPath(""); setSaveDirOverride(""); }
    if (browser?.target === "saveDir")  setSaveDirOverride(path);
    setBrowser(null);
  };

  const load = useCallback(() => {
    fetch(CHECKPOINTS_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setFetchError(null); })
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = data.checkpoints.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.relPath.toLowerCase().includes(q);
  });

  const chosenCkptPath = customPath.trim() || selectedPath;
  const startEpisode   = chosenCkptPath ? (inferEpisode(basename(chosenCkptPath)) ?? 1) : 1;
  const autoSaveDir    = dirOf(chosenCkptPath);
  const saveDir        = mode === "scratch" ? ckptDir : (saveDirOverride.trim() || autoSaveDir);
  const maxEp          = Math.max(1, parseInt(maxEpisodes, 10) || 100000);
  const episodeValid   = mode !== "continue" || maxEp > startEpisode;
  const canRun         = (mode === "scratch" ? ckptDir.trim() !== "" : chosenCkptPath !== "") && episodeValid;

  const handleRun = () => {
    if (!canRun) return;
    onRun({
      ckptDir:      saveDir,
      ckptPath:     mode === "continue" ? chosenCkptPath : null,
      startEpisode: mode === "continue" ? startEpisode : 1,
      maxEpisodes:  maxEp,
      maxTimesteps: Math.max(1, parseInt(maxTimesteps, 10) || 100),
      makeVideo,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Configure training</h3>
            <p style={styles.subtitle}>Start a new run from scratch, or resume from an existing checkpoint.</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>

          {/* ── Mode toggle ── */}
          <div>
            <div style={styles.sectionLabel}>Training mode</div>
            <div style={styles.segment}>
              <button style={styles.segmentBtn(mode === "scratch")}   onClick={() => setMode("scratch")}>From scratch</button>
              <button style={styles.segmentBtn(mode === "continue")}  onClick={() => setMode("continue")}>Continue from checkpoint</button>
            </div>
          </div>

          {/* ── Scratch: dir input ── */}
          {mode === "scratch" && (
            <div>
              <div style={styles.sectionLabel}>Checkpoint directory</div>
              <div style={styles.inputRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="meander_ppo"
                  value={ckptDir}
                  onChange={(e) => setCkptDir(e.target.value)}
                />
                <button style={styles.browseBtn} title="Browse…" onClick={() => setBrowser({ mode: "dir", target: "ckptDir" })}>
                  ⋯
                </button>
              </div>
              <p style={styles.hint}>Directory will be created automatically if it does not exist.</p>
            </div>
          )}

          {/* ── Continue: checkpoint picker ── */}
          {mode === "continue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={styles.sectionLabel}>Checkpoint to resume</div>
              <input
                style={styles.input}
                placeholder="Search checkpoints by name or path…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div style={styles.list}>
                {loading ? (
                  <div style={styles.emptyState}>Scanning project for .pth files…</div>
                ) : filtered.length === 0 ? (
                  <div style={styles.emptyState}>
                    {fetchError ? `Could not reach the backend: ${fetchError}` : "No checkpoint files found."}
                  </div>
                ) : filtered.map((c) => {
                  const selected = !customPath.trim() && selectedPath === c.path;
                  const hovered  = hoveredPath === c.path;
                  const ep       = inferEpisode(c.name);
                  return (
                    <div
                      key={c.path}
                      style={styles.listItem(selected, hovered)}
                      onClick={() => { setSelectedPath(c.path); setCustomPath(""); setSaveDirOverride(""); }}
                      onMouseEnter={() => setHoveredPath(c.path)}
                      onMouseLeave={() => setHoveredPath(null)}
                      title={c.path}
                    >
                      <div style={styles.itemMain}>
                        <span style={styles.itemName}>{c.name}</span>
                        <span style={styles.itemPath}>{c.relPath}</span>
                      </div>
                      <div style={styles.itemMeta}>
                        {ep !== null && <span style={styles.itemBadge}>ep {ep}</span>}
                        <span style={styles.itemTime}>{fmtAgo(c.mtime)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={styles.dividerRow}>
                <span style={styles.dividerLine}/>
                <span style={styles.dividerText}>or enter a path</span>
                <span style={styles.dividerLine}/>
              </div>
              <div style={styles.inputRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="/absolute/path/to/checkpoint.pth"
                  value={customPath}
                  onChange={(e) => {
                    setCustomPath(e.target.value);
                    if (e.target.value.trim()) { setSelectedPath(""); setSaveDirOverride(""); }
                  }}
                />
                <button style={styles.browseBtn} title="Browse…" onClick={() => setBrowser({ mode: "file", target: "ckptFile" })}>
                  ⋯
                </button>
              </div>

              {/* Inferred episode info card */}
              {chosenCkptPath && (
                <div style={{
                  padding: "12px 14px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 5,
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
              )}

              {/* Save dir override */}
              <div>
                <div style={styles.sectionLabel}>Save checkpoints to</div>
                <div style={styles.inputRow}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    placeholder={autoSaveDir || "same directory as checkpoint"}
                    value={saveDirOverride}
                    onChange={(e) => setSaveDirOverride(e.target.value)}
                  />
                  <button style={styles.browseBtn} title="Browse…" onClick={() => setBrowser({ mode: "dir", target: "saveDir" })}>
                    ⋯
                  </button>
                </div>
                <p style={styles.hint}>Leave blank to save alongside the loaded checkpoint.</p>
              </div>
            </div>
          )}

          {/* ── Shared training parameters (always visible) ── */}
          <div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 20 }}/>
            <div style={styles.sectionLabel}>Training parameters</div>
            <div style={styles.numbersRow}>
              <div style={styles.numberField}>
                <label style={styles.numberLabel}>Steps per episode</label>
                <input
                  style={styles.input} type="number" min="1" step="1"
                  value={maxTimesteps}
                  onChange={(e) => setMaxTimesteps(e.target.value)}
                />
              </div>
              <div style={styles.numberField}>
                <label style={styles.numberLabel}>Max episodes</label>
                <input
                  style={styles.input} type="number" min="1" step="1"
                  value={maxEpisodes}
                  onChange={(e) => setMaxEpisodes(e.target.value)}
                />
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
                background: makeVideo ? "#1D9E75" : "rgba(255,255,255,0.12)",
                transition: "background .2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: makeVideo ? 22 : 2,
                width: 20, height: 20, borderRadius: "50%",
                background: "#fff", transition: "left .2s",
              }}/>
            </button>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.runBtn(!canRun)} onClick={handleRun} disabled={!canRun}>
            Start training
          </button>
        </div>

      </div>

      {browser && (
        <FileBrowserModal
          mode={browser.mode}
          initialPath={
            browser.target === "ckptDir"  ? ckptDir :
            browser.target === "ckptFile" ? autoSaveDir :
            saveDirOverride || autoSaveDir
          }
          onSelect={handleBrowseSelect}
          onClose={() => setBrowser(null)}
        />
      )}
    </div>
  );
}
