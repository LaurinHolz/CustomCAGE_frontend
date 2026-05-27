import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
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
  Legend
);

const SOCKET_URL = "http://localhost:4000";

const PLOTS = [
  {
    id: "reward",
    title: "Reward",
    yLabel: "Reward",
    color: "#1D9E75",
  },
  {
    id: "loss",
    title: "Loss",
    yLabel: "Loss",
    color: "#E24B4A",
  },
  {
    id: "accuracy",
    title: "Accuracy",
    yLabel: "Accuracy",
    color: "#3B8BD4",
  },
];

const styles = {
  page: {
    padding: 20,
    minHeight: "100%",
    color: "var(--color-text-primary, #f5f5f5)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "var(--color-text-primary, #f5f5f5)",
  },

  subtitle: {
    margin: "6px 0 0 0",
    fontSize: 13,
    color: "var(--color-text-secondary, rgba(255,255,255,0.55))",
  },

  controls: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  badge: (connected) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
    background: connected
      ? "rgba(29, 158, 117, 0.14)"
      : "rgba(226, 75, 74, 0.14)",
    color: connected ? "#36d399" : "#ff7777",
    border: connected
      ? "1px solid rgba(29, 158, 117, 0.35)"
      : "1px solid rgba(226, 75, 74, 0.35)",
  }),

  dot: (connected) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: connected ? "#1D9E75" : "#E24B4A",
  }),

  pill: {
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(255,255,255,0.06)",
    color: "var(--color-text-secondary, rgba(255,255,255,0.65))",
    border: "1px solid rgba(255,255,255,0.1)",
  },

  button: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.055)",
    color: "var(--color-text-primary, #f5f5f5)",
    borderRadius: 9,
    padding: "7px 11px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 16,
  },

  card: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },

  plotTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
  },

  meta: {
    fontSize: 12,
    color: "var(--color-text-secondary, rgba(255,255,255,0.55))",
    marginTop: 4,
  },

  chartShell: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  chartWrap: {
    width: "100%",
    height: 300,
  },

  emptyState: {
    height: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--color-text-secondary, rgba(255,255,255,0.45))",
    fontSize: 13,
    borderRadius: 12,
    background: "rgba(0,0,0,0.12)",
  },

  log: {
    marginTop: 20,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.035)",
    padding: 14,
  },

  logTitle: {
    margin: "0 0 10px 0",
    fontSize: 14,
    fontWeight: 700,
  },

  logItem: {
    fontSize: 12,
    color: "var(--color-text-secondary, rgba(255,255,255,0.65))",
    padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * This is the function you customize.
 *
 * It receives one newly arrived file payload:
 *
 * {
 *   filename,
 *   createdAt,
 *   data
 * }
 *
 * It returns computed values for your plots.
 */
function computePlotValuesFromFile(file, fileIndex) {
  const data = file.data;

  /**
   * CASE 1:
   * CSV/JSON data is an array of rows, for example:
   *
   * [
   *   { step: 1, reward: 10, loss: 0.9, accuracy: 0.4 },
   *   { step: 2, reward: 14, loss: 0.7, accuracy: 0.5 }
   * ]
   *
   * Here we use the last row as the newest result.
   */
  if (Array.isArray(data) && data.length > 0) {
    const lastRow = data[data.length - 1];

    return {
      x: toNumber(lastRow.step) ?? toNumber(lastRow.episode) ?? fileIndex,

      reward: toNumber(lastRow.reward),
      loss: toNumber(lastRow.loss),
      accuracy: toNumber(lastRow.accuracy),
    };
  }

  /**
   * CASE 2:
   * JSON data is a single object, for example:
   *
   * {
   *   "step": 12,
   *   "reward": 22,
   *   "loss": 0.3,
   *   "accuracy": 0.8
   * }
   */
  if (data && typeof data === "object") {
    return {
      x: toNumber(data.step) ?? toNumber(data.episode) ?? fileIndex,

      reward: toNumber(data.reward),
      loss: toNumber(data.loss),
      accuracy: toNumber(data.accuracy),
    };
  }

  return {
    x: fileIndex,
    reward: null,
    loss: null,
    accuracy: null,
  };
}

function createInitialSeries() {
  return PLOTS.reduce((acc, plot) => {
    acc[plot.id] = [];
    return acc;
  }, {});
}

function PlotCard({ plot, points }) {
  const hasData = points.length > 0;

  const chartData = useMemo(
    () => ({
      labels: points.map((point) => point.x),
      datasets: [
        {
          label: plot.yLabel,
          data: points.map((point) => point.y),
          tension: 0.28,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          borderColor: plot.color,
          backgroundColor: plot.color,
          pointBackgroundColor: plot.color,
          pointBorderColor: plot.color,
        },
      ],
    }),
    [points, plot]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,

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
          displayColors: false,
        },
      },

      scales: {
        x: {
          title: {
            display: true,
            text: "File / step",
            color: "rgba(255,255,255,0.62)",
          },
          ticks: {
            color: "rgba(255,255,255,0.62)",
            maxTicksLimit: 8,
          },
          grid: {
            color: "rgba(255,255,255,0.08)",
          },
        },
        y: {
          title: {
            display: true,
            text: plot.yLabel,
            color: "rgba(255,255,255,0.62)",
          },
          ticks: {
            color: "rgba(255,255,255,0.62)",
          },
          grid: {
            color: "rgba(255,255,255,0.08)",
          },
          beginAtZero: false,
        },
      },
    }),
    [plot]
  );

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <h3 style={styles.plotTitle}>{plot.title}</h3>
          <div style={styles.meta}>
            {points.length} point{points.length === 1 ? "" : "s"}
          </div>
        </div>

        {points.length > 0 && (
          <div style={styles.meta}>
            Latest: <strong>{points[points.length - 1].y}</strong>
          </div>
        )}
      </div>

      <div style={styles.chartShell}>
        {hasData ? (
          <div style={styles.chartWrap}>
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div style={styles.emptyState}>Waiting for data...</div>
        )}
      </div>
    </div>
  );
}

export default function LiveFilePlots() {
  const [connected, setConnected] = useState(false);
  const [series, setSeries] = useState(() => createInitialSeries());
  const [receivedFiles, setReceivedFiles] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("Connected to watcher backend:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from watcher backend");
      setConnected(false);
    });

    socket.on("new-file", (file) => {
      console.log("New file received:", file);

      setReceivedFiles((previousFiles) => {
        const fileIndex = previousFiles.length + 1;
        const computed = computePlotValuesFromFile(file, fileIndex);

        setSeries((previousSeries) => {
          const nextSeries = { ...previousSeries };

          for (const plot of PLOTS) {
            const y = computed[plot.id];

            if (typeof y === "number" && Number.isFinite(y)) {
              nextSeries[plot.id] = [
                ...nextSeries[plot.id],
                {
                  x: computed.x,
                  y,
                  filename: file.filename,
                  createdAt: file.createdAt,
                },
              ];
            }
          }

          return nextSeries;
        });

        return [
          {
            filename: file.filename,
            createdAt: file.createdAt,
            computed,
          },
          ...previousFiles,
        ];
      });
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const clearAll = () => {
    setSeries(createInitialSeries());
    setReceivedFiles([]);
  };

  const totalPoints = Object.values(series).reduce(
    (sum, points) => sum + points.length,
    0
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Live experiment plots</h2>
          <p style={styles.subtitle}>
            Plots are initialized immediately. Each incoming file is parsed,
            converted into metrics, and appended to the matching charts.
          </p>
        </div>

        <div style={styles.controls}>
          <span style={styles.badge(connected)}>
            <span style={styles.dot(connected)} />
            {connected ? "Connected" : "Disconnected"}
          </span>

          <span style={styles.pill}>
            {receivedFiles.length} file
            {receivedFiles.length === 1 ? "" : "s"}
          </span>

          <span style={styles.pill}>
            {totalPoints} point{totalPoints === 1 ? "" : "s"}
          </span>

          <button style={styles.button} onClick={clearAll}>
            Clear all
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {PLOTS.map((plot) => (
          <PlotCard
            key={plot.id}
            plot={plot}
            points={series[plot.id] || []}
          />
        ))}
      </div>

      <div style={styles.log}>
        <h3 style={styles.logTitle}>Received files</h3>

        {receivedFiles.length === 0 ? (
          <div style={styles.meta}>No files received yet.</div>
        ) : (
          receivedFiles.slice(0, 8).map((file) => (
            <div
              key={`${file.filename}-${file.createdAt}`}
              style={styles.logItem}
            >
              <strong>{file.filename}</strong> ·{" "}
              {new Date(file.createdAt).toLocaleTimeString()} · computed:{" "}
              {JSON.stringify(file.computed)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}