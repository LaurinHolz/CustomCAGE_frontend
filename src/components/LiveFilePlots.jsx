import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
);

const SSE_URL = "http://127.0.0.1:9999/stream";

// ── Plot configuration ─────────────────────────────────────────────────────────
// Single-series scalar plots (one line each). Adding a new scalar metric is just
// another entry here — storage is generic.
const SINGLE_PLOTS = [
  { id: "reward",            title: "Reward",                   yLabel: "Reward",            color: "#1D9E75" },
  { id: "restore",           title: "Restore Efficiency",       yLabel: "Restore Efficiency", color: "#E24B4A", yMin: 0, yMax: 1 },
  { id: "compromised",       title: "Compromised Entities",     yLabel: "Compromised Entities", color: "#3B8BD4" },
  { id: "impacts_on_target", title: "Impacts on Target (server4)", yLabel: "Impacts / episode", color: "#C879E0" },
  { id: "remove_efficiency", title: "Remove Efficiency",        yLabel: "Remove Efficiency", color: "#E0A458", yMin: 0, yMax: 1 },
  { id: "total_restores",    title: "Total Restores",           yLabel: "Restores / episode", color: "#4EC3C9" },
  { id: "red_success",       title: "Red Success Rate",         yLabel: "Success rate",      color: "#E24B4A", yMin: 0, yMax: 1 },
  { id: "blue_success",      title: "Blue Success Rate",        yLabel: "Success rate",      color: "#3B8BD4", yMin: 0, yMax: 1 },
];

// Subnet palette (role-based, matching the V-labels from metric_points.py):
//   V1 = User (red start), V2 = Enterprise, V3 = Operational/target.
const SUBNET_COLORS = {
  V1: "#E0A458", // user — amber
  V2: "#3B8BD4", // enterprise — blue
  V3: "#E24B4A", // operational/target — red
  unknown: "#8A8A93",
};

const RED_ACTION_COLORS = {
  sleep:    "#6B7280",
  remote:   "#E0A458",
  network:  "#4EC3C9",
  exploit:  "#E24B4A",
  escalate: "#C879E0",
  impact:   "#F25C8A",
};

const BLUE_ACTION_COLORS = {
  sleep:   "#6B7280",
  analyse: "#4EC3C9",
  decoy:   "#C879E0",
  remove:  "#E0A458",
  restore: "#1D9E75",
};

// Multi-series plots (several lines per chart).
const MULTI_PLOTS = [
  {
    id: "first_exploit",
    title: "First Successful Exploit per Subnet",
    yLabel: "Step",
    series: [
      { key: "first_exploit_V1", label: "V1 · User",       color: SUBNET_COLORS.V1 },
      { key: "first_exploit_V2", label: "V2 · Enterprise", color: SUBNET_COLORS.V2 },
      { key: "first_exploit_V3", label: "V3 · Op/Target",  color: SUBNET_COLORS.V3 },
    ],
  },
  {
    id: "first_entry",
    title: "First Entry per Subnet",
    yLabel: "Step",
    series: [
      { key: "first_entry_V1", label: "V1 · User",       color: SUBNET_COLORS.V1 },
      { key: "first_entry_V2", label: "V2 · Enterprise", color: SUBNET_COLORS.V2 },
      { key: "first_entry_V3", label: "V3 · Op/Target",  color: SUBNET_COLORS.V3 },
    ],
  },
  {
    id: "restore_decomposition",
    title: "Restore Decomposition per Subnet",
    yLabel: "Restores / episode",
    series: [
      { key: "restore_V1",      label: "V1 · User",       color: SUBNET_COLORS.V1 },
      { key: "restore_V2",      label: "V2 · Enterprise", color: SUBNET_COLORS.V2 },
      { key: "restore_V3",      label: "V3 · Op/Target",  color: SUBNET_COLORS.V3 },
      { key: "restore_unknown", label: "unknown",         color: SUBNET_COLORS.unknown },
    ],
  },
  {
    id: "red_decomposition",
    title: "Red Action Distribution",
    yLabel: "Fraction of steps",
    stacked: true,
    yMin: 0, yMax: 1,
    series: Object.entries(RED_ACTION_COLORS).map(([t, color]) => ({
      key: `red_action_frac_${t}`, label: t, color,
    })),
  },
  {
    id: "blue_decomposition",
    title: "Blue Action Distribution",
    yLabel: "Fraction of steps",
    stacked: true,
    yMin: 0, yMax: 1,
    series: Object.entries(BLUE_ACTION_COLORS).map(([t, color]) => ({
      key: `blue_action_frac_${t}`, label: t, color,
    })),
  },
];

const styles = {
  page: { padding: 20, minHeight: "100%", color: "var(--color-text-primary, #f5f5f5)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary, #f5f5f5)" },
  subtitle: { margin: "6px 0 0 0", fontSize: 13, color: "var(--color-text-secondary, rgba(255,255,255,0.55))" },
  controls: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  pill: { borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.06)", color: "var(--color-text-secondary, rgba(255,255,255,0.65))", border: "1px solid rgba(255,255,255,0.1)" },
  button: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.055)", color: "var(--color-text-primary, #f5f5f5)", borderRadius: 9, padding: "7px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  sectionLabel: { margin: "26px 0 12px 0", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary, rgba(255,255,255,0.45))" },
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

  jobBar: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 },
  jobSelectWrap: { display: "flex", alignItems: "center", gap: 8 },
  jobSelect: {
    borderRadius: 9, padding: "7px 30px 7px 11px", fontSize: 12.5, fontWeight: 600,
    background: "var(--input-bg, rgba(255,255,255,0.06))", color: "var(--color-text-primary, #f5f5f5)",
    border: "1px solid rgba(255,255,255,0.14)", fontFamily: "inherit", cursor: "pointer",
  },
  jobStatusDot: (color) => ({ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }),
  jobSubtitle: { fontSize: 12, color: "var(--color-text-secondary, rgba(255,255,255,0.55))" },
};

// Bucket key for metric snapshots that carry no job identity — a plain
// (non-curriculum) evaluation run, or anything from before job-tagging existed.
const DEFAULT_JOB_KEY = "__default__";

// Curriculum jobs are tagged (see curriculum_runner.py) with `node` (the
// training node's id — stable and unique) and `job_name` (human-friendly).
// `node` wins as the bucket key since it's guaranteed unique per job.
function jobKeyOf(data) {
  return data.node || data.job_name || DEFAULT_JOB_KEY;
}

const STATUS_COLORS = {
  queued: "#6B7280",
  running: "#3B8BD4",
  done: "#1D9E75",
  failed: "#E24B4A",
  skipped: "#8A8A93",
  stopped: "#E0A458",
};

function jobTitle(meta) {
  if (!meta) return "";
  if (meta.key === DEFAULT_JOB_KEY) return "Evaluation / untagged run";
  return meta.jobName || meta.key;
}

function jobSubtitle(meta) {
  if (!meta) return "";
  const bits = [];
  if (meta.side) bits.push(meta.side === "defender" ? "🛡️ defender" : meta.side === "attacker" ? "⚔️ attacker" : meta.side);
  if (meta.phase) bits.push(meta.phase);
  if (meta.jobNumber && meta.total) bits.push(`job ${meta.jobNumber}/${meta.total}`);
  if (meta.gpu !== undefined && meta.gpu !== null) bits.push(`GPU ${meta.gpu}`);
  return bits.join(" · ");
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Normalize a snapshot into { x, ...numericKeys }. Every non-finite value
// (including JSON null from "event never occurred") becomes null and is later
// filtered out per series, so it never renders as a spurious zero.
function normalizeSnapshot(data, index) {
  const src = Array.isArray(data) ? data[data.length - 1] : data;
  if (!src || typeof src !== "object") return { x: index };

  const x = toNumber(src.step) ?? toNumber(src.episode) ?? index;
  const out = { x };
  for (const [k, v] of Object.entries(src)) {
    if (k === "step" || k === "episode") continue;
    out[k] = toNumber(v);
  }
  return out;
}

function seriesPoints(history, key) {
  return history
    .map((h) => ({ x: h.x, y: h[key] }))
    .filter((p) => Number.isFinite(p.y));
}

const baseScales = (yLabel, { stacked = false, yMin, yMax } = {}) => ({
  x: {
    type: "linear",
    title: { display: true, text: "Step", color: "rgba(255,255,255,0.62)" },
    ticks: { color: "rgba(255,255,255,0.62)", maxTicksLimit: 8 },
    grid: { color: "rgba(255,255,255,0.08)" },
  },
  y: {
    stacked,
    title: { display: true, text: yLabel, color: "rgba(255,255,255,0.62)" },
    ticks: { color: "rgba(255,255,255,0.62)" },
    grid: { color: "rgba(255,255,255,0.08)" },
    beginAtZero: false,
    ...(yMin !== undefined ? { min: yMin } : {}),
    ...(yMax !== undefined ? { max: yMax } : {}),
  },
});

const basePlugins = (showLegend) => ({
  legend: showLegend
    ? { display: true, labels: { color: "rgba(255,255,255,0.62)", boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "circle" } }
    : { display: false },
  tooltip: { enabled: true, backgroundColor: "rgba(20,20,24,0.95)", titleColor: "#fff", bodyColor: "rgba(255,255,255,0.82)", borderColor: "rgba(255,255,255,0.12)", borderWidth: 1, padding: 10, displayColors: true },
});

function SinglePlotCard({ plot, history, chartRef }) {
  const points = useMemo(() => seriesPoints(history, plot.id), [history, plot.id]);
  const hasData = points.length > 0;
  const latest = hasData ? points[points.length - 1].y : null;

  const chartData = useMemo(() => ({
    datasets: [{
      label: plot.yLabel,
      data: points,
      tension: 0.28,
      pointRadius: points.map((_, i) => (i === points.length - 1 ? 5 : 3)),
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
    plugins: basePlugins(true),
    scales: baseScales(plot.yLabel, { yMin: plot.yMin, yMax: plot.yMax }),
  }), [plot]);

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <h3 style={styles.plotTitle}>{plot.title}</h3>
          <div style={styles.meta}>{points.length} point{points.length === 1 ? "" : "s"}</div>
        </div>
        {hasData && (
          <div style={styles.meta}>Latest: <strong>{Number.isInteger(latest) ? latest : latest.toFixed(3)}</strong></div>
        )}
      </div>
      <div style={styles.chartShell}>
        {hasData
          ? <div style={styles.chartWrap}><Line ref={chartRef} data={chartData} options={chartOptions} /></div>
          : <div style={styles.emptyState}>Waiting for data...</div>}
      </div>
    </div>
  );
}

function MultiPlotCard({ plot, history, chartRef }) {
  const datasets = useMemo(() => plot.series.map((s, idx) => {
    const pts = seriesPoints(history, s.key);
    return {
      label: s.label,
      data: pts,
      tension: 0.28,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
      borderColor: s.color,
      backgroundColor: plot.stacked ? `${s.color}66` : s.color,
      pointBackgroundColor: s.color,
      pointBorderColor: s.color,
      fill: plot.stacked ? (idx === 0 ? "origin" : "-1") : false,
    };
  }), [history, plot]);

  const totalPoints = datasets.reduce((s, d) => s + d.data.length, 0);
  const hasData = totalPoints > 0;

  const chartData = useMemo(() => ({ datasets }), [datasets]);
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutQuart" },
    plugins: basePlugins(true),
    scales: baseScales(plot.yLabel, { stacked: plot.stacked, yMin: plot.yMin, yMax: plot.yMax }),
  }), [plot]);

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <h3 style={styles.plotTitle}>{plot.title}</h3>
          <div style={styles.meta}>{plot.series.length} series · {totalPoints} point{totalPoints === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div style={styles.chartShell}>
        {hasData
          ? <div style={styles.chartWrap}><Line ref={chartRef} data={chartData} options={chartOptions} /></div>
          : <div style={styles.emptyState}>Waiting for data...</div>}
      </div>
    </div>
  );
}

export default function LiveFilePlots({ setConnected, onTrainingDone, onEvaluationDone, screenshotsEnabled }) {
  // Per-job metric history — a curriculum run trains several jobs (sequentially
  // or in parallel across GPUs); each is tagged with a stable key by
  // curriculum_runner.py (see jobKeyOf) so their series never mix on one chart.
  const [historyByJob, setHistoryByJob] = useState({});
  const [jobsMeta, setJobsMeta]         = useState({});
  const [jobOrder, setJobOrder]         = useState([]);
  const [selectedJob, setSelectedJob]   = useState(null);
  const [log, setLog]                   = useState([]);
  const captureTimer = useRef(null);

  const history = historyByJob[selectedJob] || [];

  // First job seen is auto-selected; once a selection exists (auto or manual)
  // new jobs starting up don't yank the view away from what's on screen.
  const registerJob = useCallback((key, data) => {
    setJobOrder((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setJobsMeta((prev) => {
      const existing = prev[key] || { key };
      const next = {
        ...existing,
        jobName:   data.job_name ?? existing.jobName,
        phase:     data.phase    ?? existing.phase,
        side:      data.side     ?? existing.side,
        node:      data.node     ?? existing.node,
        gpu:       data.gpu      ?? existing.gpu,
        jobNumber: data.job      ?? existing.jobNumber,
        total:     data.total    ?? existing.total,
      };
      if (data.type === "curriculum_progress" && data.status) {
        next.status = data.status;
      } else {
        // A real per-episode metric snapshot unambiguously means the job is
        // running now — advance it off "queued", but don't clobber a terminal
        // status if a stray snapshot arrives after done/failed/skipped.
        const terminal = existing.status === "done" || existing.status === "failed" || existing.status === "skipped";
        if (!terminal) next.status = "running";
      }
      return { ...prev, [key]: next };
    });
    setSelectedJob((cur) => cur ?? key);
  }, []);

  // Keep refs so the SSE closure (opened once, on mount) can read the current
  // prop values without needing them in its effect's dependency array — the
  // parent passes onTrainingDone/onEvaluationDone as fresh inline closures on
  // every render, so depending on them directly would reopen the connection
  // (and re-fetch history) far more often than intended.
  const screenshotsEnabledRef = useRef(screenshotsEnabled);
  useEffect(() => { screenshotsEnabledRef.current = screenshotsEnabled; }, [screenshotsEnabled]);
  const onTrainingDoneRef = useRef(onTrainingDone);
  useEffect(() => { onTrainingDoneRef.current = onTrainingDone; }, [onTrainingDone]);
  const onEvaluationDoneRef = useRef(onEvaluationDone);
  useEffect(() => { onEvaluationDoneRef.current = onEvaluationDone; }, [onEvaluationDone]);

  // Stable ref arrays — one per chart, created once on mount.
  const singleRefs = useRef(SINGLE_PLOTS.map(() => createRef()));
  const multiRefs  = useRef(MULTI_PLOTS.map(() => createRef()));

  const captureScreenshot = useCallback((step) => {
    const COLS = 2;
    const dpr  = window.devicePixelRatio || 1;

    const allPlots = [
      ...SINGLE_PLOTS.map((p, i) => ({ title: p.title, ref: singleRefs.current[i] })),
      ...MULTI_PLOTS.map((p, i)  => ({ title: p.title, ref: multiRefs.current[i]  })),
    ];
    const totalGroups = Math.ceil(allPlots.length / 4);

    for (let gi = 0; gi * 4 < allPlots.length; gi++) {
      const group = allPlots.slice(gi * 4, gi * 4 + 4);

      // Use the natural canvas pixel size from the first chart that has data.
      let cellW = 0, cellH = 0;
      for (const { ref } of group) {
        const cvs = ref.current?.canvas;
        if (cvs && cvs.width > 0 && cvs.height > 0) { cellW = cvs.width; cellH = cvs.height; break; }
      }
      if (cellW === 0) continue; // no chart has rendered yet

      const TITLE_H = Math.round(28 * dpr);
      const rows    = Math.ceil(group.length / COLS);

      const offscreen = document.createElement("canvas");
      offscreen.width  = cellW * COLS;
      offscreen.height = (cellH + TITLE_H) * rows;
      const ctx = offscreen.getContext("2d");

      ctx.fillStyle = "#13131a";
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);

      for (let ci = 0; ci < group.length; ci++) {
        const { title, ref } = group[ci];
        const col = ci % COLS;
        const row = Math.floor(ci / COLS);
        const x   = col * cellW;
        const y   = row * (cellH + TITLE_H);

        ctx.fillStyle = "rgba(245,245,245,0.85)";
        ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
        ctx.fillText(title, x + Math.round(12 * dpr), y + Math.round(19 * dpr));

        const cvs = ref.current?.canvas;
        if (cvs && cvs.width > 0) {
          // Draw 1-to-1 at natural pixel size — no scaling distortion.
          ctx.drawImage(cvs, x, y + TITLE_H);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(x, y + TITLE_H, cellW, cellH);
          ctx.fillStyle = "rgba(245,245,245,0.3)";
          ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
          ctx.fillText("No data", x + cellW / 2 - Math.round(24 * dpr), y + TITLE_H + cellH / 2);
        }
      }

      const dataUrl = offscreen.toDataURL("image/png");
      fetch("http://127.0.0.1:9999/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, step, group: gi + 1, totalGroups }),
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (history.length === 0 || !screenshotsEnabled) return;
    clearTimeout(captureTimer.current);
    const snap = history[history.length - 1];
    captureTimer.current = setTimeout(
      () => captureScreenshot(snap?.x ?? history.length),
      800,
    );
    return () => clearTimeout(captureTimer.current);
  }, [history.length, captureScreenshot, screenshotsEnabled]);

  // Handles one event from either the replayed history buffer or the live SSE
  // stream. `isReplay` suppresses one-shot side effects (video compile, the
  // isTraining/isEvaluating callbacks) that must fire only once, live — not
  // every time an old tab reloads and replays a run that already finished.
  const handleEvent = useCallback((data, { isReplay = false } = {}) => {
    if (data.type === "evaluation_done") {
      if (!isReplay) onEvaluationDoneRef.current?.();
      return;
    }
    if (data.type === "training_done") {
      if (!isReplay) {
        if (screenshotsEnabledRef.current) {
          // Wait 2 s after training_done so the last 800 ms screenshot timer
          // has time to fire and the PNG reaches the server before we compile.
          setTimeout(() => {
            fetch("http://127.0.0.1:9999/make-video", { method: "POST" }).catch(() => {});
          }, 2000);
        }
        onTrainingDoneRef.current?.();
      }
      return;
    }
    // Curriculum lifecycle events (job queued/started/done/failed/skipped, or
    // the overall run start/complete) carry job identity but no plottable
    // metrics — use them only to populate/update the job picker.
    if (data.type === "curriculum_progress") {
      const key = data.node || data.job_name;
      if (key) registerJob(key, data);
      return;
    }
    // A real per-episode metric snapshot.
    const key = jobKeyOf(data);
    registerJob(key, data);
    setHistoryByJob((prev) => {
      const arr = prev[key] || [];
      const snap = normalizeSnapshot(data, arr.length + 1);
      setLog((prevLog) => [
        { index: prevLog.length + 1, jobKey: key, x: snap.x, snap, receivedAt: new Date().toISOString() },
        ...prevLog,
      ]);
      return { ...prev, [key]: [...arr, snap] };
    });
  }, [registerJob]);

  // On mount: replay whatever the server still has buffered from the current
  // run (so a page refresh mid-training doesn't lose already-plotted data),
  // then open the live stream for everything from here on.
  const sourceRef = useRef(null);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:9999/metrics-history");
        if (res.ok) {
          const events = await res.json();
          if (!cancelled) events.forEach((e) => handleEvent(e, { isReplay: true }));
        }
      } catch {
        // Server unreachable / no buffer yet — just start fresh from live data.
      }
      if (cancelled) return;

      const source = new EventSource(SSE_URL);
      sourceRef.current = source;
      source.onopen = () => setConnected(true);
      source.onmessage = (event) => handleEvent(JSON.parse(event.data));
      source.onerror = () => setConnected(false);
    })();

    return () => {
      cancelled = true;
      sourceRef.current?.close();
      setConnected(false);
    };
  }, [handleEvent, setConnected]);

  const clearAll = () => {
    setHistoryByJob({});
    setJobsMeta({});
    setJobOrder([]);
    setSelectedJob(null);
    setLog([]);
    fetch("http://127.0.0.1:9999/clear-metrics", { method: "POST" }).catch(() => {});
  };

  const selectedMeta = jobsMeta[selectedJob] || null;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Live training plots</h2>
        </div>
        <div style={styles.controls}>
          <span style={styles.pill}>{jobOrder.length} job{jobOrder.length === 1 ? "" : "s"}</span>
          <span style={styles.pill}>{log.length} update{log.length === 1 ? "" : "s"}</span>
          <span style={styles.pill}>{history.length} snapshot{history.length === 1 ? "" : "s"}</span>
          <button style={styles.button} onClick={clearAll}>Clear all</button>
        </div>
      </div>

      <div style={styles.jobBar}>
        <div style={styles.jobSelectWrap}>
          {selectedMeta && <span style={styles.jobStatusDot(STATUS_COLORS[selectedMeta.status] || "#8A8A93")} />}
          <select
            style={styles.jobSelect}
            value={selectedJob ?? ""}
            disabled={jobOrder.length === 0}
            onChange={(e) => setSelectedJob(e.target.value)}
          >
            {jobOrder.length === 0 && <option value="">Waiting for a job…</option>}
            {jobOrder.map((key) => {
              const meta = jobsMeta[key];
              const statusTag = meta?.status ? ` — ${meta.status}` : "";
              return <option key={key} value={key}>{jobTitle(meta)}{statusTag}</option>;
            })}
          </select>
        </div>
        {selectedMeta && <span style={styles.jobSubtitle}>{jobSubtitle(selectedMeta)}</span>}
      </div>

      <div style={styles.grid}>
        {SINGLE_PLOTS.map((plot, i) => (
          <SinglePlotCard key={plot.id} plot={plot} history={history} chartRef={singleRefs.current[i]} />
        ))}
      </div>

      <div style={styles.sectionLabel}>Per-subnet &amp; decomposition</div>
      <div style={styles.grid}>
        {MULTI_PLOTS.map((plot, i) => (
          <MultiPlotCard key={plot.id} plot={plot} history={history} chartRef={multiRefs.current[i]} />
        ))}
      </div>
    </div>
  );
}