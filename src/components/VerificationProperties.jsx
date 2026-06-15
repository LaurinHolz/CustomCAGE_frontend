import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { PCTL_RULES } from "../data/pctl_rules";

const TEXT_PRIMARY = "var(--color-text-primary, #f5f5f5)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const CATEGORY_STYLE = {
  "Safety / Reachability": { color: "#E0A458", bg: "rgba(224,164,88,0.14)", border: "rgba(224,164,88,0.4)" },
  "Response / Robustness": { color: "#3FE0A8", bg: "rgba(29,158,117,0.14)", border: "rgba(29,158,117,0.4)" },
};

const styles = {
  page: { padding: 20, minHeight: "100%", color: TEXT_PRIMARY },
  header: { marginBottom: 18 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" },
  subtitle: { margin: "6px 0 0 0", fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5, maxWidth: 760 },
  card: {
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 16,
    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_SECONDARY,
    borderBottom: "1px solid rgba(255,255,255,0.09)", whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "top", lineHeight: 1.55, transition: "background .12s",
  },
  idxBadge: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 32, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
  },
  pctl: {
    display: "inline-block", fontSize: 15, color: TEXT_PRIMARY,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8, padding: "8px 12px",
  },
};

function Pctl({ tex }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: false }),
    [tex]
  );
  return <span style={styles.pctl} dangerouslySetInnerHTML={{ __html: html }} />;
}

function CategoryBadge({ category }) {
  const c = CATEGORY_STYLE[category] || { color: TEXT_SECONDARY, bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.16)" };
  return (
    <span style={{
      display: "inline-block", padding: "4px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      {category}
    </span>
  );
}

export default function VerificationProperties() {
  const rows = PCTL_RULES;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Formal Verification Properties</h2>
        <p style={styles.subtitle}>
          PCTL properties checked by the formal-verification pipeline against the
          policy-induced state tree — covering attacker reachability and the
          defender's response guarantees.
        </p>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Property</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>PCTL Logic</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.idx}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <td style={styles.td}><span style={styles.idxBadge}>{row.idx}</span></td>
                <td style={styles.td}>{row.property}</td>
                <td style={styles.td}><CategoryBadge category={row.category} /></td>
                <td style={styles.td}><Pctl tex={row.pctl} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
