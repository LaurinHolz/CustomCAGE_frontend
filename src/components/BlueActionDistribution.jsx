import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const DIST_URL = "http://127.0.0.1:9999/blue-action-dist";
const POLL_MS = 10000;

const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";
const GRID = "rgba(255,255,255,0.08)";

// Wie viele named Actions gezeigt werden; der Rest wandert in "OTHER".
const TOP_N = 7;

// Eine stabile Farbe pro Stack-Position. OTHER ist immer grau.
const PALETTE = ["#E28FB0", "#5FC2E4", "#1D9E75", "#3B8BD4", "#C0522E", "#E0A458", "#E8D44D", "#C879E0", "#4EC3C9"];
const OTHER_COLOR = "#8A8A93";

const styles = {
  card: { display: "flex", flexDirection: "column", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))", boxShadow: "0 18px 50px rgba(0,0,0,0.22)", overflow: "hidden" },
  cardTitle: { margin: 0, padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary, rgba(255,255,255,0.5))", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  chartBody: { height: 380, padding: "16px 18px" },
  empty: { height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)", fontSize: 13 },
};

function buildChartData(dist, labelFor) {
  // Actions nach Gesamt-Häufigkeit ranken -> Top-N behalten, Rest -> OTHER.
  const ranked = [...dist.overall].sort((a, b) => b.count - a.count);
  const top = ranked.slice(0, TOP_N).map((r) => r.action_id);
  const topSet = new Set(top);

  const datasets = top.map((aid, i) => ({
    label: labelFor(aid),
    data: dist.by_step.map((s) => (s.probs[String(aid)] ?? 0) * 100),
    backgroundColor: PALETTE[i % PALETTE.length],
    borderColor: "rgba(17,18,23,0.9)",
    borderWidth: 1,
    stack: "dist",
  }));

  if (ranked.length > TOP_N) {
    datasets.push({
      label: "OTHER",
      data: dist.by_step.map((s) => {
        let sum = 0;
        for (const [aid, p] of Object.entries(s.probs)) {
          if (!topSet.has(Number(aid))) sum += p;
        }
        return sum * 100;
      }),
      backgroundColor: OTHER_COLOR,
      borderColor: "rgba(17,18,23,0.9)",
      borderWidth: 1,
      stack: "dist",
    });
  }

  return { labels: dist.by_step.map((s) => s.step), datasets };
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  scales: {
    x: {
      stacked: true,
      title: { display: true, text: "Step", color: "#ffffff" },
      ticks: { color: "#ffffff" },
      grid: { display: false },
    },
    y: {
      stacked: true,
      min: 0,
      max: 100,
      title: { display: true, text: "Action Distribution (%)", color: "#ffffff" },
      ticks: { color: "#ffffff" },
      grid: { color: GRID },
    },
  },
  plugins: {
    legend: { position: "top", labels: { color: "#f0f0f5", boxWidth: 12, padding: 10, font: { size: 11 } } },
    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } },
  },
};

export default function BlueActionDistributionChart({ evalState = "idle", actionLabels }) {
  const [dist, setDist] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    fetch(DIST_URL)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => { setDist(data); setError(null); })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (evalState !== "done") return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load, evalState]);

  const labelFor = useCallback(
    (aid) =>
      (dist?.action_labels && dist.action_labels[String(aid)]) ||
      (actionLabels && actionLabels[aid]) ||
      `Action ${aid}`,
    [dist, actionLabels]
  );

  const chartData = useMemo(
    () => (dist ? buildChartData(dist, labelFor) : null),
    [dist, labelFor]
  );

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Blue action distribution (first {dist?.first_k ?? 10} steps)</h3>
      {chartData ? (
        <div style={styles.chartBody}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div style={styles.empty}>
          {evalState !== "done"
            ? "Run an evaluation to see the action distribution."
            : error
            ? `Could not load distribution: ${error}`
            : "No distribution data yet."}
        </div>
      )}
    </div>
  );
}