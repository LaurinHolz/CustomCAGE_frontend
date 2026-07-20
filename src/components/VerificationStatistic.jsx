import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { S } from "../styles/styles";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BASE = "http://127.0.0.1:9999";

const C = {
  formal: "#4EC3C9",
  induced: "#9B8AFB",
  stageA: "#E0A458",
  stageB: "#3B8BD4",
  stageC: "#1D9E75",
};

const fmtInt = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "—");
const fmtSec = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");

const isValidModel = (m) =>
  Number.isFinite(m?.n_states) && Number.isFinite(m?.n_transitions);

const isValidTiming = (timings, key) => Number.isFinite(timings?.[key]);

const isValidDecoy = (d) =>
  Number.isFinite(d?.number_switches) && Number.isFinite(d?.models_generated);

function makeOptions({ yLabel, log = false }) {
  return {
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
          pointStyle: "rect",
        },
      },
      tooltip: {
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
        ticks: { color: "rgba(255,255,255,0.62)" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        type: log ? "logarithmic" : "linear",
        beginAtZero: !log,
        title: {
          display: !!yLabel,
          text: yLabel,
          color: "rgba(255,255,255,0.62)",
        },
        ticks: { color: "rgba(255,255,255,0.62)" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };
}

function ModelStatsTable({ formal, induced }) {
  const rows = [
    { label: "Formal Model", color: C.formal, m: formal },
    { label: "Policy-induced", color: C.induced, m: induced },
  ];

  return (
    <div style={tableCard}>
      <table style={statTable}>
        <thead>
          <tr>
            <th style={th}>Model</th>
            <th style={{ ...th, textAlign: "right" }}>#States</th>
            <th style={{ ...th, textAlign: "right" }}>#Transitions</th>
            <th style={{ ...th, textAlign: "right" }}>#Total</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const s = r.m?.n_states;
            const t = r.m?.n_transitions;
            const total = Number.isFinite(s) && Number.isFinite(t) ? s + t : NaN;

            return (
              <tr key={r.label}>
                <td style={td}>
                  <span style={{ ...dot, background: r.color }} />
                  {r.label}
                </td>
                <td style={tdNum}>{fmtInt(s)}</td>
                <td style={tdNum}>{fmtInt(t)}</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{fmtInt(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DecoyStatsTable({ decoy }) {
  const rows = [
    { label: "Model Switches", color: C.stageB, value: decoy?.number_switches },
    { label: "Models Generated", color: C.stageC, value: decoy?.models_generated },
  ];

  return (
    <div style={tableCard}>
      <table style={statTable}>
        <thead>
          <tr>
            <th style={th}>Metric</th>
            <th style={{ ...th, textAlign: "right" }}>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={td}>
                <span style={{ ...dot, background: r.color }} />
                {r.label}
              </td>
              <td style={tdNum}>{fmtInt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STAGES = [
  {
    key: "model_construction_bfs",
    label: "Model Construction + BFS",
    color: C.stageA,
  },
  {
    key: "induced_model_construction",
    label: "Induced Model Construction",
    color: C.stageB,
  },
  {
    key: "model_checking",
    label: "Model Checking",
    color: C.stageC,
  },
];

function TimingTable({ timings }) {
  const total = STAGES.reduce((acc, s) => {
    const value = timings?.[s.key];
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <div style={tableCard}>
      <table style={statTable}>
        <thead>
          <tr>
            <th style={th}>Stage</th>
            <th style={{ ...th, textAlign: "right" }}>Time (s)</th>
          </tr>
        </thead>

        <tbody>
          {STAGES.map((s) => (
            <tr key={s.key}>
              <td style={td}>
                <span style={{ ...dot, background: s.color }} />
                {s.label}
              </td>
              <td style={tdNum}>{fmtSec(timings?.[s.key])}</td>
            </tr>
          ))}

          <tr>
            <td style={{ ...td, fontWeight: 700 }}>Total</td>
            <td style={{ ...tdNum, fontWeight: 700 }}>{fmtSec(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function VerificationStatistics() {
  const [stats, setStats] = useState(null);
  const [verifyRunning, setVerifyRunning] = useState(false);

  const wasRunningRef = useRef(false);
  const timerRef = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/verification-statistics`);

      if (!response.ok) {
        setStats(null);
        return;
      }

      const data = await response.json();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        const status = await fetch(`${BASE}/verification-tree`).then((r) =>
          r.json()
        );

        const running = !!status.running;

        if (!cancelled) {
          setVerifyRunning(running);

          const justFinished = wasRunningRef.current && !running;
          const firstCheck = !wasRunningRef.current && !running;

          if (justFinished || firstCheck) {
            await loadStats();
          }

          wasRunningRef.current = running;
        }
      } catch {
        // server not up yet
      }

      if (!cancelled) {
        timerRef.current = setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [loadStats]);

  const formal = stats?.formal_model;
  const induced = stats?.induced_model;
  const timings = stats?.timings;
  const decoy = stats?.decoy_metrics;

  const hasFormalModel = isValidModel(formal);
  const hasInducedModel = isValidModel(induced);
  const hasModelStats = hasFormalModel || hasInducedModel;

  const hasTimings =
    !!timings && STAGES.some((s) => isValidTiming(timings, s.key));

  const hasDecoyStats = isValidDecoy(decoy);

  const modelChartData = useMemo(() => {
    const datasets = [];

    if (isValidModel(formal)) {
      datasets.push({
        label: "Formal Model",
        backgroundColor: C.formal,
        borderRadius: 4,
        data: [
          formal.n_states,
          formal.n_transitions,
          formal.n_states + formal.n_transitions,
        ],
      });
    }

    if (isValidModel(induced)) {
      datasets.push({
        label: "Policy-induced",
        backgroundColor: C.induced,
        borderRadius: 4,
        data: [
          induced.n_states,
          induced.n_transitions,
          induced.n_states + induced.n_transitions,
        ],
      });
    }

    return {
      labels: ["#States", "#Transitions", "#Total"],
      datasets,
    };
  }, [formal, induced]);

  const timingChartData = useMemo(() => {
    const validStages = STAGES.filter((s) => isValidTiming(timings, s.key));

    return {
      labels: validStages.map((s) => s.label),
      datasets: [
        {
          label: "Time (s)",
          backgroundColor: validStages.map((s) => s.color),
          borderRadius: 4,
          data: validStages.map((s) => timings[s.key]),
        },
      ],
    };
  }, [timings]);

  return (
    <div style={{ padding: 12 }}>
      <div style={S.panel}>
        <h3 style={sectionTitle}>Verification Statistics</h3>

        <style>
          {`@keyframes vsPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}
        </style>

        {verifyRunning && (
          <div style={runningBanner}>
            <span
              style={{
                ...runningDot,
                animation: "vsPulse 1.4s ease-in-out infinite",
              }}
            />
            Verification in progress — statistics will load automatically when
            complete.
          </div>
        )}

        <div style={sectionHeader}>
          <span style={sectionLabel}>Formal Model Statistics</span>
        </div>

        {hasModelStats ? (
          <>
            <ModelStatsTable formal={formal} induced={induced} />

            {modelChartData.datasets.length > 0 && (
              <div style={card}>
                <div style={chartWrap}>
                  <Bar
                    data={modelChartData}
                    options={makeOptions({
                      yLabel: "Count",
                      log: false,
                    })}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={emptyText}>
            {verifyRunning
              ? "Waiting for verification to complete…"
              : "No model statistics yet."}
          </p>
        )}

        <div style={{ ...sectionHeader, marginTop: 20 }}>
          <span style={sectionLabel}>Timing Breakdown</span>
        </div>

        {hasTimings ? (
          <>
            <TimingTable timings={timings} />

            {timingChartData.labels.length > 0 && (
              <div style={card}>
                <div style={chartWrap}>
                  <Bar
                    data={timingChartData}
                    options={makeOptions({ yLabel: "Time (s)" })}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={emptyText}>
            {verifyRunning
              ? "Waiting for verification to complete…"
              : "No timing data yet."}
          </p>
        )}

        <div style={{ ...sectionHeader, marginTop: 20 }}>
          <span style={sectionLabel}>Decoy Statistics</span>
        </div>

        {hasDecoyStats ? (
          <DecoyStatsTable decoy={decoy} />
        ) : (
          <p style={emptyText}>
            {verifyRunning
              ? "Waiting for verification to complete…"
              : "No decoy statistics yet."}
          </p>
        )}

        {!stats && (
          <p style={emptyText}>
            No statistics loaded — run Verify to populate this tab.
          </p>
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

const tableCard = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
  overflow: "hidden",
  marginBottom: 12,
};

const statTable = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th = {
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

const td = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  verticalAlign: "middle",
  color: "var(--color-text-primary)",
};

const tdNum = {
  ...td,
  textAlign: "right",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  whiteSpace: "nowrap",
};

const dot = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: 2,
  marginRight: 8,
  verticalAlign: "middle",
};

const runningBanner = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  marginBottom: 14,
  borderRadius: "var(--border-radius-md)",
  background: "rgba(78,195,201,0.08)",
  border: "0.5px solid rgba(78,195,201,0.3)",
  fontSize: 12,
  color: "#4EC3C9",
};

const runningDot = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#4EC3C9",
  flexShrink: 0,
};

const emptyText = {
  fontSize: 12,
  color: "var(--color-text-secondary)",
  margin: "8px 0",
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
  height: 300,
};