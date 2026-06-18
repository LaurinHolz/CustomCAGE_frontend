import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { S } from "../styles/styles";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

const BASE = "http://127.0.0.1:9999";

// ── PRISM → LaTeX converter ────────────────────────────────────────────────────

function prismToLatex(formula) {
  let s = formula;
  // Quoted state labels → \texttt{...} with escaped underscores
  s = s.replace(/"([^"]*)"/g, (_, inner) =>
    `\\texttt{${inner.replace(/_/g, "\\_")}}`
  );
  // Bounded until
  s = s.replace(/U<=(\d+)/g, "\\mathbf{U}_{\\leq $1}");
  // P=?
  s = s.replace(/P=\?/g, "P_{=?}");
  // Temporal operators (after labels are already protected)
  s = s.replace(/\bF\b/g, "\\mathbf{F}\\,");
  s = s.replace(/\bG\b/g, "\\mathbf{G}\\,");
  s = s.replace(/\bX\b/g, "\\mathbf{X}\\,");
  // Logic
  s = s.replace(/!/g, "\\neg\\,");
  s = s.replace(/\s*&\s*/g, " \\wedge ");
  s = s.replace(/\s*\|\s*/g, " \\vee ");
  // Constants
  s = s.replace(/\btrue\b/g, "\\top");
  s = s.replace(/\bfalse\b/g, "\\bot");
  // Operator brackets
  s = s.replace(/\[/g, "\\left[");
  s = s.replace(/\]/g, "\\right]");
  s = s.replace(/\(/g, "\\left(");
  s = s.replace(/\)/g, "\\right)");
  return s;
}

function probColor(formula, prob) {
  if (/P=\?\s*\[\s*F\b/.test(formula))
    return prob < 0.05 ? "#1D9E75" : prob > 0.8 ? "#E24B4A" : "#E0A458";
  if (/P=\?\s*\[\s*G\b/.test(formula))
    return prob > 0.95 ? "#1D9E75" : prob < 0.3 ? "#E24B4A" : "#E0A458";
  return "#f5f5f5";
}

function parseProperty(line) {
  const arrowIdx = line.lastIndexOf(" -> ");
  if (arrowIdx === -1) return null;
  const left = line.slice(0, arrowIdx).trim();
  const probStr = line.slice(arrowIdx + 4).trim();
  const m = left.match(/^\((\d+)\)\s+(.+)$/);
  if (!m) return null;
  return { index: m[1], formula: m[2], prob: parseFloat(probStr), probStr };
}

const LONG_LIMIT = 80;

function collapsedLatex(formula) {
  const fM = formula.match(/^P=\?\s*\[\s*F\s*"([^"]+)"\s*\]$/);
  if (fM) return `P_{=?}\\left[\\mathbf{F}\\;\\texttt{${fM[1].replace(/_/g, "\\_")}}\\right]`;
  if (/^P=\?\s*\[\s*G\b/.test(formula)) return `P_{=?}\\left[\\mathbf{G}\\,\\left(\\cdots\\right)\\right]`;
  if (/^P=\?\s*\[\s*F\b/.test(formula)) return `P_{=?}\\left[\\mathbf{F}\\;\\cdots\\right]`;
  return `P_{=?}\\left[\\cdots\\right]`;
}

function formatFull(formula) {
  return formula
    .replace(/!/g, "¬")
    .replace(/\s*&\s*/g, " ∧ ")
    .replace(/\s*\|\s*/g, " ∨ ");
}

function PrismFormula({ formula }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = formula.length > LONG_LIMIT;

  const latex = useMemo(
    () => isLong && !expanded ? collapsedLatex(formula) : prismToLatex(formula),
    [formula, isLong, expanded]
  );
  const html = useMemo(
    () => katex.renderToString(latex, { throwOnError: false, displayMode: false }),
    [latex]
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {(!isLong || !expanded) && <span dangerouslySetInnerHTML={{ __html: html }} />}
        {isLong && (
          <button onClick={() => setExpanded(e => !e)} style={expandBtn}>
            {expanded ? "collapse" : "expand"}
          </button>
        )}
      </div>
      {isLong && expanded && (
        <pre style={fullFormulaPre}>{formatFull(formula)}</pre>
      )}
    </div>
  );
}

function PropertyList({ text }) {
  const props = text.split("\n").map(l => l.trim()).filter(Boolean).map(parseProperty).filter(Boolean);
  if (!props.length) return null;
  return (
    <div style={propCard}>
      <table style={propTable}>
        <thead>
          <tr>
            <th style={propTh}>#</th>
            <th style={propTh}>PCTL Formula</th>
            <th style={{ ...propTh, textAlign: "right" }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {props.map((p) => {
            const color = probColor(p.formula, p.prob);
            const probStr = isNaN(p.prob) ? p.probStr : p.prob.toFixed(4);
            return (
              <tr
                key={p.index}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <td style={{ ...propTd, width: 44 }}>
                  <span style={{ ...propIdxBadge, color, borderColor: color }}>
                    {p.index}
                  </span>
                </td>
                <td style={propTd}>
                  <PrismFormula formula={p.formula} />
                </td>
                <td style={{ ...propTd, textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{ color, fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    {probStr}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const colors = {
  total: "#4EC3C9",
  subnet1: "#E0A458",
  subnet2: "#3B8BD4",
  subnet3: "#E24B4A",
  server1: "#9B8AFB",
  server2: "#1D9E75",
  server3: "#F25C8A",
  server4: "#F97316",
};

function parseCsv(text, maxDepth = 100) {
  return text
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [iRaw, pRaw] = line.trim().split(/\s+/);
      const i = Number(iRaw);
      const probability = Number(pRaw);

      return {
        x: 1 - i / maxDepth,
        y: 1 - probability,
      };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

async function fetchCsv(url) {
  const txt = await fetch(url).then((r) => r.text());
  return parseCsv(txt);
}

function AvailabilityChart({ title, datasets }) {
  const chartData = useMemo(() => ({
    datasets: datasets.map((d) => ({
      label: d.label,
      data: d.data,
      tension: 0.28,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
      borderColor: d.color,
      backgroundColor: d.color,
      pointBackgroundColor: d.color,
      pointBorderColor: d.color,
    })),
  }), [datasets]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "rgba(255,255,255,0.62)",
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(20,20,24,0.95)",
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.82)",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        type: "linear",
        reverse: true,
        min: 0,
        max: 1,
        title: {
          display: true,
          text: "Service availability 1 - u/T",
          color: "rgba(255,255,255,0.62)",
        },
        ticks: {
          color: "rgba(255,255,255,0.62)",
          maxTicksLimit: 8,
        },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        min: 0,
        max: 1.05,
        title: {
          display: true,
          text: "P(U ≤ u)",
          color: "rgba(255,255,255,0.62)",
        },
        ticks: { color: "rgba(255,255,255,0.62)" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  }), []);

  return (
    <div style={card}>
      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</p>
      <div style={chartWrap}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default function VerificationResults() {
  const [results, setResults] = useState(null);
  const [propertiesText, setPropertiesText] = useState("");
  const [csv, setCsv] = useState({});

  useEffect(() => {
    fetch(`${BASE}/verification-results`)
      .then((res) => res.json())
      .then(async (data) => {
        setResults(data);

        if (data.properties?.url) {
          const txt = await fetch(`${BASE}${data.properties.url}`).then((r) => r.text());
          setPropertiesText(txt);
        }

        const loaded = {};

        for (const [key, item] of Object.entries(data)) {
          if (key.startsWith("csv") && item?.url) {
            loaded[key] = await fetchCsv(`${BASE}${item.url}`);
          }
        }

        setCsv(loaded);
      })
      .catch(() => {
        setResults(null);
        setCsv({});
      });
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <div style={S.panel}>
        <h3 style={sectionTitle}>Verification Results</h3>

        <div style={sectionHeader}>
          <span style={sectionLabel}>Safety / Reachability Properties</span>
        </div>
        {propertiesText ? (
          <PropertyList text={propertiesText} />
        ) : (
          <p style={emptyText}>No <code style={inlineCode}>safety_properties.txt</code> found — run Verify to generate results.</p>
        )}

        <div style={{ ...sectionHeader, marginTop: 20 }}>
          <span style={sectionLabel}>Availability Plots</span>
        </div>

        {csv.csvTotal && (
          <AvailabilityChart
            title="Total availability"
            datasets={[
              { label: "Total", data: csv.csvTotal, color: colors.total },
            ]}
          />
        )}

        {(csv.csvTotal || csv.csvSubnet1 || csv.csvSubnet2 || csv.csvSubnet3) && (
          <AvailabilityChart
            title="Total + Subnets"
            datasets={[
              ...(csv.csvTotal ? [{ label: "Total", data: csv.csvTotal, color: colors.total }] : []),
              ...(csv.csvSubnet1 ? [{ label: "Subnet 1", data: csv.csvSubnet1, color: colors.subnet1 }] : []),
              ...(csv.csvSubnet2 ? [{ label: "Subnet 2", data: csv.csvSubnet2, color: colors.subnet2 }] : []),
              ...(csv.csvSubnet3 ? [{ label: "Subnet 3", data: csv.csvSubnet3, color: colors.subnet3 }] : []),
            ]}
          />
        )}

        {csv.csvSubnet2 && (
          <AvailabilityChart
            title="Subnet 2 entities + Subnet 2 total"
            datasets={[
              { label: "Subnet 2 total", data: csv.csvSubnet2, color: colors.subnet2 },
              ...(csv.csvHostServer1 ? [{ label: "Server 1", data: csv.csvHostServer1, color: colors.server1 }] : []),
              ...(csv.csvHostServer2 ? [{ label: "Server 2", data: csv.csvHostServer2, color: colors.server2 }] : []),
              ...(csv.csvHostServer3 ? [{ label: "Server 3", data: csv.csvHostServer3, color: colors.server3 }] : []),
              ...(csv.csvHostServer4 ? [{ label: "Server 4", data: csv.csvHostServer4, color: colors.server4 }] : []),
            ]}
          />
        )}

        {!results && (
          <p style={emptyText}>No verification results loaded — run Verify to populate this tab.</p>
        )}
      </div>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: 14,
  fontWeight: 500,
  color: "var(--color-text-primary)",
  letterSpacing: "-0.2px",
};

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const sectionLabel = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const propCard = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
  overflow: "hidden",
};

const propTable = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const propTh = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-secondary)",
  borderBottom: "1px solid rgba(255,255,255,0.09)",
  whiteSpace: "nowrap",
};

const propTd = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  verticalAlign: "middle",
  lineHeight: 1.55,
  transition: "background .12s",
};

const propIdxBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 32,
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid",
};

const expandBtn = {
  fontSize: 10,
  fontWeight: 600,
  color: "var(--color-text-info)",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 999,
  padding: "2px 8px",
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: "0.04em",
  flexShrink: 0,
};

const fullFormulaPre = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: 11,
  lineHeight: 1.65,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "10px 14px",
  margin: "8px 0 0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "rgba(255,255,255,0.82)",
  overflowX: "hidden",
};

const emptyText = {
  fontSize: 12,
  color: "var(--color-text-secondary)",
  margin: "8px 0",
};

const inlineCode = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  background: "var(--color-background-secondary)",
  padding: "1px 5px",
  borderRadius: 4,
  border: "0.5px solid var(--color-border-tertiary)",
};

const card = {
  border: "0.5px solid var(--color-border-tertiary)",
  borderRadius: "var(--border-radius-lg)",
  padding: 16,
  marginBottom: 12,
  background: "var(--color-background-secondary)",
};

const chartWrap = {
  width: "100%",
  height: 340,
};