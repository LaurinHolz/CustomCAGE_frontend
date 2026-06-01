import { useEffect, useMemo, useState } from "react";
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const SSE_URL = "http://127.0.0.1:9999/stream";

const PLOTS = [
  { id: "reward",      title: "Reward",               yLabel: "Reward",               color: "#1D9E75" },
  { id: "restore",     title: "Restore Efficiency",    yLabel: "Restore Efficiency",    color: "#E24B4A" },
  { id: "compromised", title: "Compromised Entities",  yLabel: "Compromised Entities",  color: "#3B8BD4" },
];

const styles = {
  page: { padding: 20, minHeight: "100%", color: "var(--color-text-primary, #f5f5f5)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary, #f5f5f5)" },
  subtitle: { margin: "6px 0 0 0", fontSize: 13, color: "var(--color-text-secondary, rgba(255,255,255,0.55))" },
  controls: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  badge: (connected) => ({
    display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "7px 12px",
    fontSize: 12, fontWeight: 700,
    background: connected ? "rgba(29,158,117,0.14)" : "rgba(226,75,74,0.14)",
    color: connected ? "#36d399" : "#ff7777",
    border: connected ? "1px solid rgba(29,158,117,0.35)" : "1px solid rgba(226,75,74,0.35)",
  }),
  dot: (connected) => ({ width: 8, height: 8, borderRadius: "50%", background: connected ? "#1D9E75" : "#E24B4A" }),
  pill: { borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.06)", color: "var(--color-text-secondary, rgba(255,255,255,0.65))", border: "1px solid rgba(255,255,255,0.1)" },
  button: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.055)", color: "var(--color-text-primary, #f5f5f5)", borderRadius: 9, padding: "7px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 },
  card: { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.03))", boxShadow: "0 18px 50px rgba(0,0,0,0.22)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  plotTitle: { margin: 0, fontSize: 15, fontWeight: 700 },
  meta: { fontSize: 12, color: "var(--color-text-secondary, rgba(255,255,255,0.55))", marginTop: 4 },
  chartShell: { marginTop: 12, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" },
  chartWrap: { width: "100%", height: 300 },
  emptyState: { height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary, rgba(255,255,255,0.45))", fontSize: 13, borderRadius: 12, background: "rgba(0,0,0,0.12)" },
  log: { marginTop: 20, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, background: "rgba(255,255,255,0.035)", padding: 14 },
  logTitle: { margin: "0 0 10px 0", fontSize: 14, fontWeight: 700 },
  logItem: { fontSize: 12, color: "var(--color-text-secondary, rgba(255,255,255,0.65))", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
};

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractValues(data, index) {
  const src = Array.isArray(data) ? data[data.length - 1] : data;
  if (!src || typeof src !== "object") return { x: index, reward: null, restore: null, compromised: null };
  return {
    x:           toNumber(src.step) ?? toNumber(src.episode) ?? index,
    reward:      toNumber(src.reward),
    restore:     toNumber(src.restore),
    compromised: toNumber(src.compromised),
  };
}

function createInitialSeries() {
  return PLOTS.reduce((acc, p) => { acc[p.id] = []; return acc; }, {});
}

function PlotCard({ plot, points }) {
  const hasData = points.length > 0;

  const chartData = useMemo(() => ({
    labels: points.map((p) => p.x),
    datasets: [{
      label: plot.yLabel,
      data: points.map((p) => p.y),
      tension: 0.28,
      pointRadius: points.map((_, i) => i === points.length - 1 ? 5 : 3),
      pointHoverRadius: 6,
      borderWidth: 2.5,
      borderColor: plot.color,
      backgroundColor: plot.color,
      pointBackgroundColor: plot.color,
      pointBorderColor: plot.color,
    }],
  }), [points, plot]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutQuart" },
    plugins: {
      legend: { display: true, labels: { color: "rgba(255,255,255,0.62)", boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "circle" } },
      tooltip: { enabled: true, backgroundColor: "rgba(20,20,24,0.95)", titleColor: "#fff", bodyColor: "rgba(255,255,255,0.82)", borderColor: "rgba(255,255,255,0.12)", borderWidth: 1, padding: 10, displayColors: false },
    },
    scales: {
      x: { title: { display: true, text: "Step", color: "rgba(255,255,255,0.62)" }, ticks: { color: "rgba(255,255,255,0.62)", maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,0.08)" } },
      y: { title: { display: true, text: plot.yLabel, color: "rgba(255,255,255,0.62)" }, ticks: { color: "rgba(255,255,255,0.62)" }, grid: { color: "rgba(255,255,255,0.08)" }, beginAtZero: false },
    },
  }), [plot]);

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <h3 style={styles.plotTitle}>{plot.title}</h3>
          <div style={styles.meta}>{points.length} point{points.length === 1 ? "" : "s"}</div>
        </div>
        {hasData && <div style={styles.meta}>Latest: <strong>{points[points.length - 1].y}</strong></div>}
      </div>
      <div style={styles.chartShell}>
        {hasData
          ? <div style={styles.chartWrap}><Line data={chartData} options={chartOptions} /></div>
          : <div style={styles.emptyState}>Waiting for data...</div>}
      </div>
    </div>
  );
}

export default function LiveFilePlots({ setConnected }) {
  const [series, setSeries] = useState(createInitialSeries);
  const [log, setLog]       = useState([]);

  useEffect(() => {
    const source = new EventSource(SSE_URL);

    source.onopen = () => {
      setConnected(true);
    };

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      setLog((prev) => {
        const index = prev.length + 1;
        const computed = extractValues(data, index);

        setSeries((prevSeries) => {
          const next = { ...prevSeries };
          for (const plot of PLOTS) {
            const y = computed[plot.id];
            if (typeof y === "number" && Number.isFinite(y)) {
              next[plot.id] = [...next[plot.id], { x: computed.x, y }];
            }
          }
          return next;
        });

        return [{ index, computed, receivedAt: new Date().toISOString() }, ...prev];
      });
    };

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, []);

  const clearAll = () => {
    setSeries(createInitialSeries());
    setLog([]);
  };

  const totalPoints = Object.values(series).reduce((s, pts) => s + pts.length, 0);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Live training plots</h2>
          <p style={styles.subtitle}>Metrics are streamed directly from the training server via SSE.</p>
        </div>
        <div style={styles.controls}>
          <span style={styles.pill}>{log.length} update{log.length === 1 ? "" : "s"}</span>
          <span style={styles.pill}>{totalPoints} point{totalPoints === 1 ? "" : "s"}</span>
          <button style={styles.button} onClick={clearAll}>Clear all</button>
        </div>
      </div>

      <div style={styles.grid}>
        {PLOTS.map((plot) => (
          <PlotCard key={plot.id} plot={plot} points={series[plot.id] || []} />
        ))}
      </div>

      <div style={styles.log}>
        <h3 style={styles.logTitle}>Recent updates</h3>
        {log.length === 0
          ? <div style={styles.meta}>No data received yet.</div>
          : log.slice(0, 8).map((entry) => (
            <div key={entry.index} style={styles.logItem}>
              <strong>Update #{entry.index}</strong>
              {" · "}{new Date(entry.receivedAt).toLocaleTimeString()}
              {" · "}{JSON.stringify(entry.computed)}
            </div>
          ))}
      </div>
    </div>
  );
}
