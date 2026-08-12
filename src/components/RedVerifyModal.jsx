import { useCallback, useEffect, useState } from "react";
import FileBrowserModal from "./FileBrowserModal";

const CHECKPOINTS_URL = "http://127.0.0.1:9999/checkpoints";
const RUNS_URL         = "http://127.0.0.1:9999/red-verification-runs";
const RESULT_URL       = "http://127.0.0.1:9999/red-verification-result";
const SSE_URL           = "http://127.0.0.1:9999/stream";

const TEXT_PRIMARY   = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";
const BLUE = "#3B8BD4";
const RED  = "#E04B4A";
const GREEN = "#1D9E75";

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(8,9,14,0.6)",
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    width: "min(760px, 100%)", maxHeight: "min(900px, 92vh)",
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
  tabRow: { display: "flex", gap: 4, padding: "12px 24px 0 24px" },
  tabBtn: (active) => ({
    padding: "9px 14px", borderRadius: "10px 10px 0 0", border: "none", cursor: "pointer",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    background: active ? "var(--surface-muted)" : "transparent",
    color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
    borderBottom: active ? "2px solid #9B78F0" : "2px solid transparent",
  }),
  body: { padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, flex: 1 },
  sectionLabel: { margin: "0 0 10px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY },
  pickerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  pickerCol: { display: "flex", flexDirection: "column", gap: 8 },
  pickerHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700 },
  input: {
    width: "100%", boxSizing: "border-box", fontSize: 12.5, padding: "9px 11px",
    borderRadius: 9, border: "1px solid var(--modal-border)",
    background: "var(--input-bg)", color: TEXT_PRIMARY, outline: "none", fontFamily: "inherit",
  },
  inputRow: { display: "flex", gap: 6, alignItems: "stretch" },
  browseBtn: {
    flexShrink: 0, padding: "0 11px", borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
    color: TEXT_PRIMARY, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  list: { maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface-muted)", border: "1px solid var(--modal-border)" },
  listItem: (color, selected) => ({
    display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${selected ? `${color}88` : "transparent"}`,
    background: selected ? `${color}1f` : "transparent",
  }),
  itemName: { fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: TEXT_SECONDARY },
  badge: (on) => ({
    fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 999,
    background: on ? "rgba(29,158,117,0.18)" : "rgba(255,255,255,0.06)",
    color: on ? "#3FE0A8" : TEXT_SECONDARY,
  }),
  emptyState: { padding: "14px 10px", fontSize: 11.5, color: TEXT_SECONDARY, textAlign: "center" },
  selectedPath: { fontSize: 10.5, fontFamily: "var(--font-mono, ui-monospace, monospace)", color: TEXT_SECONDARY, wordBreak: "break-all" },
  paramsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  numberField: { display: "flex", flexDirection: "column", gap: 6 },
  numberLabel: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: TEXT_SECONDARY },
  segment: { display: "flex", padding: 3, borderRadius: 9, background: "var(--input-bg)", border: "1px solid var(--modal-border)" },
  segmentBtn: (active) => ({
    flex: 1, padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 11.5, fontWeight: 700, fontFamily: "inherit",
    background: active ? "#9B78F0" : "transparent", color: active ? "#fff" : TEXT_SECONDARY,
  }),
  hint: { margin: 0, fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5 },
  statusBox: (kind) => ({
    padding: "12px 14px", borderRadius: 12, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4,
    background: kind === "error" ? "rgba(224,75,74,0.08)" : kind === "done" ? "rgba(29,158,117,0.08)" : "rgba(155,120,240,0.08)",
    border: `1px solid ${kind === "error" ? "rgba(224,75,74,0.3)" : kind === "done" ? "rgba(29,158,117,0.3)" : "rgba(155,120,240,0.3)"}`,
    color: kind === "error" ? "#F0888A" : kind === "done" ? "#3FE0A8" : "#B79CF5",
  }),
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { textAlign: "left", padding: "6px 8px", color: TEXT_SECONDARY, fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--modal-border)" },
  td: { padding: "6px 8px", borderBottom: "1px solid var(--modal-border)" },
  runsList: { display: "flex", flexDirection: "column", gap: 8 },
  runCard: (open) => ({
    display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12,
    background: "var(--surface-muted)", border: `1px solid ${open ? "rgba(155,120,240,0.4)" : "var(--modal-border)"}`, cursor: "pointer",
  }),
  runHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  runTitle: { fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  runMeta: { fontSize: 10.5, color: TEXT_SECONDARY, display: "flex", gap: 8, flexWrap: "wrap" },
  footer: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--modal-border)", background: "var(--surface-muted)" },
  cancelBtn: { padding: "9px 16px", borderRadius: 999, border: "1px solid var(--modal-border)", background: "var(--surface-muted)", color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  runBtn: (disabled) => ({
    padding: "9px 18px", borderRadius: 999, border: "none",
    background: disabled ? "rgba(155,120,240,0.25)" : "linear-gradient(180deg, #B79CF5, #9B78F0)",
    color: disabled ? "rgba(255,255,255,0.4)" : "#fff",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 22px rgba(155,120,240,0.35)",
  }),
};

function basename(p) {
  if (!p) return "";
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(idx + 1) : p;
}
function fmtAgo(mtime) {
  if (!Number.isFinite(mtime)) return "";
  const diff = Date.now() / 1000 - mtime;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function fmtProb(p) {
  return typeof p === "number" ? p.toFixed(4) : String(p);
}

function CheckpointPicker({ team, color, selected, onSelect, search, onSearch, onBrowse }) {
  const [data, setData] = useState({ checkpoints: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${CHECKPOINTS_URL}?team=${team}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ checkpoints: [] }))
      .finally(() => setLoading(false));
  }, [team]);

  const filtered = data.checkpoints.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.relPath.toLowerCase().includes(q);
  });

  return (
    <div style={styles.pickerCol}>
      <div style={styles.pickerHead}>
        <span>{team === "blue" ? "🛡️" : "⚔️"}</span>
        <span style={{ color }}>{team === "blue" ? "Blue" : "Red"} checkpoint</span>
      </div>
      <div style={styles.inputRow}>
        <input
          style={{ ...styles.input, flex: 1 }}
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button style={styles.browseBtn} title="Browse for a checkpoint file…" onClick={onBrowse}>⋯</button>
      </div>
      <div style={styles.list}>
        {loading ? (
          <div style={styles.emptyState}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>No {team} checkpoints found.</div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.path}
              style={styles.listItem(color, selected?.path === c.path)}
              onClick={() => onSelect(c)}
              title={c.path}
            >
              <span style={styles.itemName}>{c.name}</span>
              <div style={styles.itemMeta}>
                <span>{basename(c.relPath.split("/trained/")[0] || c.relPath)}</span>
                <span>·</span>
                <span>{fmtAgo(c.mtime)}</span>
                <span style={styles.badge(c.actionMasking)}>
                  {c.actionMasking ? `masked · ${c.maskMode || "dead"}` : "unmasked"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      {selected && <div style={styles.selectedPath}>{selected.path}</div>}
    </div>
  );
}

function ResultView({ result }) {
  if (!result) return null;
  const exp = result.exploration || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={styles.paramsGrid}>
        {[
          ["States", exp.num_states], ["Transitions", exp.num_transitions],
          ["Collisions", exp.num_collisions], ["Max depth", exp.max_depth_reached],
          ["Truncated", exp.truncated ? "yes" : "no"], ["Wall clock", `${(exp.wall_clock_seconds || 0).toFixed(2)}s`],
        ].map(([label, val]) => (
          <div key={label} style={styles.numberField}>
            <span style={styles.numberLabel}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{String(val)}</span>
          </div>
        ))}
      </div>
      <table style={styles.table}>
        <thead>
          <tr><th style={styles.th}>Property</th><th style={styles.th}>Probability</th></tr>
        </thead>
        <tbody>
          {(result.properties || []).map((p) => (
            <tr key={p.name}>
              <td style={styles.td} title={p.formula}>{p.name}</td>
              <td style={styles.td}>{fmtProb(p.probability)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={styles.hint}>
        Raw data: <code>{result.output_dir}/result.json</code> (and <code>properties.csv</code> for a paper table).
      </p>
    </div>
  );
}

export default function RedVerifyModal({ onClose }) {
  const [tab, setTab] = useState("run"); // "run" | "history"

  const [blueSearch, setBlueSearch] = useState("");
  const [redSearch, setRedSearch]   = useState("");
  const [blueCkpt, setBlueCkpt]     = useState(null);
  const [redCkpt, setRedCkpt]       = useState(null);
  const [browseTeam, setBrowseTeam] = useState(null); // "blue" | "red" | null

  const [k, setK]               = useState(1);
  const [maxStates, setMaxStates] = useState(2000);
  const [maxDepth, setMaxDepth]   = useState("");
  const [strategy, setStrategy]   = useState("bfs");
  const [epsilon, setEpsilon]     = useState("");

  const [status, setStatus] = useState(null); // { kind: "running"|"done"|"error", message, result }

  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [openRunDir, setOpenRunDir] = useState(null);
  const [openRunResult, setOpenRunResult] = useState(null);

  const loadRuns = useCallback(() => {
    setRunsLoading(true);
    fetch(RUNS_URL).then((r) => r.json()).then((d) => setRuns(Array.isArray(d) ? d : []))
      .catch(() => setRuns([])).finally(() => setRunsLoading(false));
  }, []);

  useEffect(() => { if (tab === "history") loadRuns(); }, [tab, loadRuns]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !browseTeam) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, browseTeam]);

  // Live status via the same SSE stream training/curriculum use.
  useEffect(() => {
    const src = new EventSource(SSE_URL);
    src.onmessage = (e) => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === "red_verification_done") {
        setStatus({ kind: "done", message: "Verification finished.", result: d.result });
        if (tab === "history") loadRuns();
      } else if (d.type === "red_verification_error") {
        setStatus({ kind: "error", message: d.error || "Verification failed." });
      }
    };
    return () => src.close();
  }, [tab, loadRuns]);

  const maxStatesValue = maxStates === "" ? null : Math.max(1, parseInt(maxStates, 10) || 1);
  const maxDepthValue  = maxDepth === "" ? null : Math.max(1, parseInt(maxDepth, 10) || 1);
  const epsilonValue   = epsilon === "" ? null : Number(epsilon);
  const kValue         = Math.max(1, parseInt(k, 10) || 1);
  const canRun = !!blueCkpt && !!redCkpt && (status?.kind !== "running");

  const handleRun = async () => {
    if (!canRun) return;
    setStatus({ kind: "running", message: "Exploring the induced Markov chain…" });
    try {
      const res = await fetch("http://127.0.0.1:9999/verify-red", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueCkpt: blueCkpt.path, redCkpt: redCkpt.path,
          k: kValue, maxStates: maxStatesValue, maxDepth: maxDepthValue,
          strategy, epsilon: epsilonValue,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setStatus({ kind: "error", message: err.message });
    }
  };

  const openRun = (dir) => {
    if (openRunDir === dir) { setOpenRunDir(null); setOpenRunResult(null); return; }
    setOpenRunDir(dir);
    setOpenRunResult(null);
    fetch(`${RESULT_URL}?dir=${encodeURIComponent(dir)}`)
      .then((r) => r.json()).then(setOpenRunResult).catch(() => setOpenRunResult(null));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Red-verification</h3>
            <p style={styles.subtitle}>
              Verify a trained blue policy against a trained red policy over their induced Markov chain
              (this project's own pipeline — see RedVerification/, independent of the scripted-red FV pipeline).
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.tabRow}>
          <button style={styles.tabBtn(tab === "run")} onClick={() => setTab("run")}>Run</button>
          <button style={styles.tabBtn(tab === "history")} onClick={() => setTab("history")}>Past results</button>
        </div>

        <div style={styles.body}>
          {tab === "run" ? (
            <>
              <div>
                <div style={styles.sectionLabel}>Agents</div>
                <div style={styles.pickerGrid}>
                  <CheckpointPicker team="blue" color={BLUE} selected={blueCkpt} onSelect={setBlueCkpt}
                    search={blueSearch} onSearch={setBlueSearch} onBrowse={() => setBrowseTeam("blue")} />
                  <CheckpointPicker team="red" color={RED} selected={redCkpt} onSelect={setRedCkpt}
                    search={redSearch} onSearch={setRedSearch} onBrowse={() => setBrowseTeam("red")} />
                </div>
                <p style={styles.hint}>
                  Action masking is read from each checkpoint's own training record (badge above) unless overridden — not exposed here yet.
                </p>
              </div>

              <div>
                <div style={styles.sectionLabel}>Exploration parameters</div>
                <div style={styles.paramsGrid}>
                  <div style={styles.numberField}>
                    <label style={styles.numberLabel}>Top-k</label>
                    <input style={styles.input} type="number" min="1" step="1" value={k} onChange={(e) => setK(e.target.value)} />
                  </div>
                  <div style={styles.numberField}>
                    <label style={styles.numberLabel}>Max states</label>
                    <input style={styles.input} type="number" min="1" step="1" placeholder="unbounded"
                      value={maxStates} onChange={(e) => setMaxStates(e.target.value)} />
                  </div>
                  <div style={styles.numberField}>
                    <label style={styles.numberLabel}>Max depth</label>
                    <input style={styles.input} type="number" min="1" step="1" placeholder="unbounded"
                      value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} />
                  </div>
                  <div style={styles.numberField}>
                    <label style={styles.numberLabel}>Strategy</label>
                    <div style={styles.segment}>
                      <button style={styles.segmentBtn(strategy === "bfs")} onClick={() => setStrategy("bfs")}>bfs</button>
                      <button style={styles.segmentBtn(strategy === "probability")} onClick={() => setStrategy("probability")}>probability</button>
                    </div>
                  </div>
                  <div style={styles.numberField}>
                    <label style={styles.numberLabel}>Epsilon</label>
                    <input style={styles.input} type="number" min="0" step="any" placeholder="off"
                      value={epsilon} onChange={(e) => setEpsilon(e.target.value)} />
                  </div>
                </div>
                <p style={styles.hint}>
                  k=1 is the deterministic/greedy induced chain. "probability" ordering explores highest-cumulative-probability
                  states first — pair it with an epsilon cutoff to bound otherwise-intractable configurations
                  (redirects low-probability edges into a shared sink instead of expanding them).
                </p>
              </div>

              {status && (
                <div style={styles.statusBox(status.kind)}>
                  <strong>{status.kind === "running" ? "Running…" : status.kind === "done" ? "Done" : "Error"}</strong>
                  <span>{status.message}</span>
                </div>
              )}
              {status?.kind === "done" && <ResultView result={status.result} />}
            </>
          ) : (
            <div>
              <div style={styles.sectionLabel}>Past runs</div>
              {runsLoading ? (
                <div style={styles.emptyState}>Loading…</div>
              ) : runs.length === 0 ? (
                <div style={styles.emptyState}>No red-verification runs yet.</div>
              ) : (
                <div style={styles.runsList}>
                  {runs.map((r) => (
                    <div key={r.dir} style={styles.runCard(openRunDir === r.dir)} onClick={() => openRun(r.dir)}>
                      <div style={styles.runHead}>
                        <span style={styles.runTitle}>{basename(r.dir)}</span>
                        <span style={{ fontSize: 10.5, color: TEXT_SECONDARY, flexShrink: 0 }}>{fmtAgo(r.mtime)}</span>
                      </div>
                      <div style={styles.runMeta}>
                        <span>k={r.k}</span>
                        <span>·</span>
                        <span>{r.strategy}</span>
                        <span>·</span>
                        <span>{r.dtmcStates} states / {r.dtmcTransitions} transitions</span>
                        {r.exploration?.truncated && <span style={{ color: "#E88" }}>· truncated</span>}
                      </div>
                      {openRunDir === r.dir && (
                        <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--modal-border)" }}
                             onClick={(e) => e.stopPropagation()}>
                          {openRunResult ? <ResultView result={openRunResult} /> : <div style={styles.emptyState}>Loading…</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Close</button>
          {tab === "run" && (
            <button style={styles.runBtn(!canRun)} onClick={handleRun} disabled={!canRun}>
              {status?.kind === "running" ? "Running…" : "Run verification"}
            </button>
          )}
        </div>
      </div>

      {browseTeam && (
        <FileBrowserModal
          mode="file"
          initialPath={(browseTeam === "blue" ? blueCkpt : redCkpt)?.path || ""}
          onSelect={(path) => {
            const ckpt = { path, name: basename(path), relPath: path, mtime: null, actionMasking: null, maskMode: null };
            if (browseTeam === "blue") setBlueCkpt(ckpt); else setRedCkpt(ckpt);
            setBrowseTeam(null);
          }}
          onClose={() => setBrowseTeam(null)}
        />
      )}
    </div>
  );
}
