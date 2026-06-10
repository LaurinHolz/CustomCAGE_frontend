import { useCallback, useEffect, useState } from "react";
import { WATCHDOG_BOUNDS } from "../constants/watchdogBounds";

const AVERAGES_URL = "http://127.0.0.1:9999/watchdog-averages";
const POLL_MS = 10000;

// Fields are grouped for readability; anything returned by the backend that
// isn't listed here still shows up, under "Other metrics" — so new watchdog
// fields are never silently dropped.
const FIELD_GROUPS = [
  {
    title: "Core metrics",
    fields: ["reward", "restore", "compromised", "impacts_on_target", "remove_efficiency", "total_restores", "red_success", "blue_success"],
  },
  {
    title: "Red action distribution",
    prefix: "red_action_frac_",
    fields: ["red_action_frac_sleep", "red_action_frac_remote", "red_action_frac_network", "red_action_frac_exploit", "red_action_frac_escalate", "red_action_frac_impact"],
  },
  {
    title: "Blue action distribution",
    prefix: "blue_action_frac_",
    fields: ["blue_action_frac_sleep", "blue_action_frac_analyse", "blue_action_frac_decoy", "blue_action_frac_remove", "blue_action_frac_restore"],
  },
  {
    title: "First exploit / entry per subnet",
    fields: ["first_exploit_V1", "first_entry_V1", "first_exploit_V2", "first_entry_V2", "first_exploit_V3", "first_entry_V3"],
  },
  {
    title: "Restore decomposition",
    prefix: "restore_",
    fields: ["restore_V1", "restore_V2", "restore_V3", "restore_unknown"],
  },
];

// Fields that are identifiers/metadata rather than metrics worth averaging.
const HIDDEN_FIELDS = new Set(["step"]);

const styles = {
  page: { padding: 20, minHeight: "100%", color: "var(--color-text-primary, #f5f5f5)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary, #f5f5f5)", letterSpacing: "-0.3px" },
  subtitle: { margin: "6px 0 0 0", fontSize: 13, color: "var(--color-text-secondary, rgba(255,255,255,0.55))" },
  controls: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  pill: { borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.06)", color: "var(--color-text-secondary, rgba(255,255,255,0.65))", border: "1px solid rgba(255,255,255,0.1)" },
  button: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.055)", color: "var(--color-text-primary, #f5f5f5)", borderRadius: 9, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background .15s, border-color .15s" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, alignItems: "start" },
  card: { border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))", boxShadow: "0 18px 50px rgba(0,0,0,0.22)", overflow: "hidden" },
  cardTitle: { margin: 0, padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary, rgba(255,255,255,0.5))", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  td: { padding: "10px 18px", color: "var(--color-text-primary, #f5f5f5)", transition: "background .12s" },
  tdLabel: { fontWeight: 500, color: "var(--color-text-secondary, rgba(255,255,255,0.78))" },
  tdNum: { textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 14, fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  tdStatus: { width: 0, textAlign: "right", whiteSpace: "nowrap" },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" },
  dot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  emptyState: { gridColumn: "1 / -1", height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary, rgba(255,255,255,0.45))", fontSize: 13, borderRadius: 16, background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", padding: 20 },
};

const STATUS_OK = { background: "rgba(29,158,117,0.16)", color: "#3FE0A8", dot: "#1D9E75" };
const STATUS_BAD = { background: "rgba(226,75,74,0.16)", color: "#F2837F", dot: "#E24B4A" };

const ROW_BASE = "transparent";
const ROW_ALT = "rgba(255,255,255,0.025)";
const ROW_HOVER = "rgba(255,255,255,0.06)";

function formatValue(v) {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(2);
}

function fieldLabel(key, prefix) {
  const stripped = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return stripped
    .split("_")
    .map((w) => (/^v\d+$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function StatusBadge({ field, value }) {
  const bound = WATCHDOG_BOUNDS[field];
  if (!bound || !Number.isFinite(value)) return null;
  const ok = value >= bound.min && value <= bound.max;
  const status = ok ? STATUS_OK : STATUS_BAD;
  return (
    <span style={{ ...styles.badge, background: status.background, color: status.color }}>
      <span style={{ ...styles.dot, background: status.dot }} />
      {ok ? "In range" : "Out of range"}
    </span>
  );
}

function MetricRow({ rowKey, label, value, field, hovered, onHover, idx }) {
  const bg = hovered ? ROW_HOVER : (idx % 2 === 1 ? ROW_ALT : ROW_BASE);
  return (
    <tr
      onMouseEnter={() => onHover(rowKey)}
      onMouseLeave={() => onHover(null)}
    >
      <td style={{ ...styles.td, ...styles.tdLabel, background: bg }}>{label}</td>
      <td style={{ ...styles.td, ...styles.tdNum, background: bg }}>{formatValue(value)}</td>
      <td style={{ ...styles.td, ...styles.tdStatus, background: bg }}>
        <StatusBadge field={field} value={value} />
      </td>
    </tr>
  );
}

export default function WatchdogAveragesTable() {
  const [averages, setAverages] = useState(null);
  const [fileCount, setFileCount] = useState(0);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [hovered, setHovered] = useState(null);

  const load = useCallback(() => {
    fetch(AVERAGES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAverages(data.averages);
        setFileCount(data.fileCount);
        setUpdatedAt(new Date());
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const groups = [];
  if (averages) {
    const seen = new Set(HIDDEN_FIELDS);
    for (const group of FIELD_GROUPS) {
      const rows = group.fields.filter((f) => f in averages);
      rows.forEach((f) => seen.add(f));
      if (rows.length > 0) groups.push({ title: group.title, prefix: group.prefix, fields: rows });
    }
    const leftover = Object.keys(averages).filter((k) => !seen.has(k));
    if (leftover.length > 0) groups.push({ title: "Other metrics", fields: leftover });
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Evaluation averages</h2>
          <p style={styles.subtitle}>Mean of each field across every snapshot in data/evaluation/</p>
        </div>
        <div style={styles.controls}>
          <span style={styles.pill}>{fileCount} file{fileCount === 1 ? "" : "s"}</span>
          {updatedAt && (
            <span style={styles.pill}>Updated {updatedAt.toLocaleTimeString()}</span>
          )}
          <button style={styles.button} onClick={load}>Refresh</button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={styles.emptyState}>
          {error
            ? `Could not reach the backend server (http://127.0.0.1:9999): ${error}`
            : "No data yet."}
        </div>
      ) : (
        <div style={styles.grid}>
          {groups.map((group) => (
            <div key={group.title} style={styles.card}>
              <h3 style={styles.cardTitle}>{group.title}</h3>
              <table style={styles.table}>
                <tbody>
                  {group.fields.map((field, idx) => {
                    const rowKey = `${group.title}:${field}`;
                    return (
                      <MetricRow
                        key={field}
                        rowKey={rowKey}
                        idx={idx}
                        field={field}
                        label={fieldLabel(field, group.prefix)}
                        value={averages[field]}
                        hovered={hovered === rowKey}
                        onHover={setHovered}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
