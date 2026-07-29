import { useCallback, useEffect, useState } from "react";

const CHECKPOINTS_URL = "http://127.0.0.1:9999/checkpoints";

const HEURISTIC_AGENTS = [
  {
    value: "sleep-only",
    label: "Sleep Only",
    description: "Use only the Sleep action.",
  },
  {
    value: "decoy-only",
    label: "Decoy Only",
    description: "Use only decoy-placement actions.",
  },
  {
    value: "restore-only",
    label: "Restore Only",
    description: "Use only restore actions.",
  },
  {
    value: "startup-decoy-restore",
    label: "Startup Decoy Restore",
    description: "Place startup decoys, then react with Restore.",
  },
  {
    value: "decoy-restore",
    label: "Decoy Restore",
    description: "Use the combined Decoy and Restore heuristic.",
  },
];

const TEXT_PRIMARY = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(8,9,14,0.6)",
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    width: "min(540px, 100%)", maxHeight: "min(720px, 90vh)",
    display: "flex", flexDirection: "column",
    borderRadius: 18, border: "1px solid var(--modal-border)",
    background: "var(--modal-bg)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
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
    width: 28, height: 28, borderRadius: 9, cursor: "pointer", fontSize: 16, lineHeight: "28px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    fontFamily: "inherit", transition: "background .15s, color .15s",
  },
  body: { padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 },
  sectionLabel: { margin: "0 0 10px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY },
  segment: { display: "flex", padding: 4, borderRadius: 12, background: "var(--surface-muted)", border: "1px solid var(--modal-border)" },
  segmentBtn: (active) => ({
    flex: 1, minWidth: 0, minHeight: 38, padding: "8px 8px", borderRadius: 9, border: "none", cursor: "pointer",
    fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.01em", lineHeight: 1.2,
    background: active ? "linear-gradient(180deg, #4AA0E6, #3B8BD4)" : "transparent",
    color: active ? "#fff" : TEXT_SECONDARY,
    boxShadow: active ? "0 6px 16px rgba(59,139,212,0.35)" : "none",
    transition: "all .15s",
  }),
  input: {
    width: "100%", boxSizing: "border-box", fontSize: 13, padding: "10px 12px",
    borderRadius: 10, border: "1px solid var(--modal-border)",
    background: "var(--input-bg)", color: TEXT_PRIMARY,
    outline: "none", fontFamily: "inherit",
  },
  latestCard: { display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 12, background: "rgba(29,158,117,0.08)", border: "1px solid rgba(29,158,117,0.25)" },
  latestBadge: { alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, background: "rgba(29,158,117,0.2)", color: "#3FE0A8" },
  latestPath: { fontSize: 12, fontFamily: "var(--font-mono, ui-monospace, monospace)", color: TEXT_PRIMARY, wordBreak: "break-all" },
  emptyState: { padding: "16px 14px", borderRadius: 12, background: "var(--surface-muted)", border: "1px solid var(--modal-border)", color: TEXT_SECONDARY, fontSize: 12.5, textAlign: "center" },
  list: { maxHeight: 230, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface-muted)", border: "1px solid var(--modal-border)" },
  listItem: (selected, hovered) => ({
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 9, cursor: "pointer",
    border: `1px solid ${selected ? "rgba(59,139,212,0.5)" : "transparent"}`,
    background: selected ? "rgba(59,139,212,0.12)" : (hovered ? "var(--surface-hover)" : "transparent"),
    transition: "all .12s",
  }),
  itemMain: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemPath: { fontSize: 11, color: TEXT_SECONDARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemMeta: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  itemBadge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--surface-hover)", color: TEXT_SECONDARY },
  selectedBadge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(59,139,212,0.18)", color: "#63B3F3" },
  itemTime: { fontSize: 11, color: TEXT_SECONDARY, whiteSpace: "nowrap" },
  dividerRow: { display: "flex", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, background: "var(--color-border-secondary)" },
  dividerText: { fontSize: 11, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  numbersRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  numberField: { display: "flex", flexDirection: "column", gap: 6 },
  numberLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: TEXT_SECONDARY },
  footer: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--modal-border)", background: "var(--surface-muted)" },
  cancelBtn: { padding: "9px 16px", borderRadius: 999, border: "1px solid var(--modal-border)", background: "var(--surface-muted)", color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  runBtn: (disabled) => ({
    padding: "9px 18px", borderRadius: 9, border: "none",
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

function stepBadge(name) {
  const m = name.match(/^(\d+)\.pth$/);
  return m ? `step ${m[1]}` : null;
}

function fmtAgo(mtime) {
  if (!Number.isFinite(mtime)) return "";
  const diff = Date.now() / 1000 - mtime;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function EvaluateModal({ onClose, onRun }) {
  const [mode, setMode] = useState("latest");
  const [data, setData] = useState({ checkpoints: [], latest: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [hoveredPath, setHoveredPath] = useState(null);
  const [selectedHeuristic, setSelectedHeuristic] = useState("");
  const [hoveredHeuristic, setHoveredHeuristic] = useState(null);
  const [numEpisodes, setNumEpisodes] = useState(20);
  const [maxTimesteps, setMaxTimesteps] = useState(100);

  const load = useCallback(() => {
    fetch(CHECKPOINTS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = data.checkpoints.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.relPath.toLowerCase().includes(q);
  });

  const chosenPath = mode === "latest"
    ? data.latest
    : mode === "browse"
      ? (customPath.trim() || selectedPath)
      : null;

  const canRun = mode === "heuristic"
    ? !!selectedHeuristic
    : !loading && !!chosenPath;

  const handleRun = () => {
    if (!canRun) return;

    onRun({
      ckptPath: mode === "browse" ? chosenPath : null,
      heuristicAgent: mode === "heuristic" ? selectedHeuristic : null,
      numEpisodes: Math.max(1, parseInt(numEpisodes, 10) || 20),
      maxTimesteps: Math.max(1, parseInt(maxTimesteps, 10) || 100),
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Run evaluation</h3>
            <p style={styles.subtitle}>Select a trained checkpoint or a heuristic Blue agent and configure the episode budget.</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <div>
            <div style={styles.sectionLabel}>Blue agent</div>
            <div style={styles.segment}>
              <button style={styles.segmentBtn(mode === "latest")} onClick={() => setMode("latest")}>Latest</button>
              <button style={styles.segmentBtn(mode === "browse")} onClick={() => setMode("browse")}>Browse files</button>
              <button style={styles.segmentBtn(mode === "heuristic")} onClick={() => setMode("heuristic")}>Heuristic Blue Agents</button>
            </div>

            {mode === "latest" && (
              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <div style={styles.emptyState}>Looking for checkpoints…</div>
                ) : data.latest ? (
                  <div style={styles.latestCard}>
                    <span style={styles.latestBadge}>
                      Latest{stepBadge(basename(data.latest)) ? ` · ${stepBadge(basename(data.latest))}` : ""}
                    </span>
                    <div style={styles.latestPath} title={data.latest}>{data.latest}</div>
                  </div>
                ) : (
                  <div style={styles.emptyState}>
                    {error
                      ? `Could not reach the backend (http://127.0.0.1:9999): ${error}`
                      : "No checkpoints found in meander_ppo/. Train a model first, or browse for a file."}
                  </div>
                )}
              </div>
            )}

            {mode === "browse" && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
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
                      {error ? `Could not reach the backend: ${error}` : "No checkpoint files found."}
                    </div>
                  ) : (
                    filtered.map((c) => {
                      const selected = !customPath.trim() && selectedPath === c.path;
                      const hovered = hoveredPath === c.path;
                      const badge = stepBadge(c.name);
                      return (
                        <div
                          key={c.path}
                          style={styles.listItem(selected, hovered)}
                          onClick={() => { setSelectedPath(c.path); setCustomPath(""); }}
                          onMouseEnter={() => setHoveredPath(c.path)}
                          onMouseLeave={() => setHoveredPath(null)}
                          title={c.path}
                        >
                          <div style={styles.itemMain}>
                            <span style={styles.itemName}>{c.name}</span>
                            <span style={styles.itemPath}>{c.relPath}</span>
                          </div>
                          <div style={styles.itemMeta}>
                            {badge && <span style={styles.itemBadge}>{badge}</span>}
                            <span style={styles.itemTime}>{fmtAgo(c.mtime)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={styles.dividerRow}>
                  <span style={styles.dividerLine} />
                  <span style={styles.dividerText}>or enter a path</span>
                  <span style={styles.dividerLine} />
                </div>
                <input
                  style={styles.input}
                  placeholder="/absolute/path/to/checkpoint.pth"
                  value={customPath}
                  onChange={(e) => {
                    setCustomPath(e.target.value);
                    if (e.target.value.trim()) setSelectedPath("");
                  }}
                />
              </div>
            )}

            {mode === "heuristic" && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.list}>
                  {HEURISTIC_AGENTS.map((agent) => {
                    const selected = selectedHeuristic === agent.value;
                    const hovered = hoveredHeuristic === agent.value;
                    return (
                      <div
                        key={agent.value}
                        style={styles.listItem(selected, hovered)}
                        onClick={() => setSelectedHeuristic(agent.value)}
                        onMouseEnter={() => setHoveredHeuristic(agent.value)}
                        onMouseLeave={() => setHoveredHeuristic(null)}
                        title={agent.value}
                      >
                        <div style={styles.itemMain}>
                          <span style={styles.itemName}>{agent.label}</span>
                          <span style={styles.itemPath}>{agent.description}</span>
                        </div>
                        <div style={styles.itemMeta}>
                          <span style={selected ? styles.selectedBadge : styles.itemBadge}>
                            {selected ? "Selected" : "Heuristic"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={styles.sectionLabel}>Episode budget</div>
            <div style={styles.numbersRow}>
              <div style={styles.numberField}>
                <label style={styles.numberLabel}>Episodes</label>
                <input
                  style={styles.input} type="number" min="1" step="1"
                  value={numEpisodes}
                  onChange={(e) => setNumEpisodes(e.target.value)}
                />
              </div>
              <div style={styles.numberField}>
                <label style={styles.numberLabel}>Max steps / episode</label>
                <input
                  style={styles.input} type="number" min="1" step="1"
                  value={maxTimesteps}
                  onChange={(e) => setMaxTimesteps(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.runBtn(!canRun)} onClick={handleRun} disabled={!canRun}>Run evaluation</button>
        </div>
      </div>
    </div>
  );
}