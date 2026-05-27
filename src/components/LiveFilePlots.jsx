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

function isNumeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeData(data) {
  if (!Array.isArray(data)) return [];

  return data
    .filter((row) => row && typeof row === "object")
    .map((row, index) => ({
      __index: index,
      ...row,
    }));
}

function getPlotKeys(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      xKey: "__index",
      yKeys: [],
    };
  }

  const keys = Object.keys(data[0]).filter((key) => key !== "__index");

  const numericKeys = keys.filter((key) =>
    data.some((row) => isNumeric(row[key]))
  );

  if (numericKeys.length === 0) {
    return {
      xKey: "__index",
      yKeys: [],
    };
  }

  const preferredXKeys = [
    "x",
    "step",
    "time",
    "t",
    "episode",
    "iteration",
    "epoch",
  ];

  const preferredXKey = preferredXKeys.find((key) =>
    numericKeys.includes(key)
  );

  const xKey = preferredXKey || numericKeys[0];
  const yKeys = numericKeys.filter((key) => key !== xKey);

  return {
    xKey,
    yKeys,
  };
}

function FilePlotCard({ file }) {
  const data = useMemo(() => normalizeData(file.data), [file.data]);
  const { xKey, yKeys } = useMemo(() => getPlotKeys(data), [data]);

  const [selectedYKey, setSelectedYKey] = useState(yKeys[0] || "");

  useEffect(() => {
    if (!selectedYKey && yKeys.length > 0) {
      setSelectedYKey(yKeys[0]);
    }

    if (selectedYKey && yKeys.length > 0 && !yKeys.includes(selectedYKey)) {
      setSelectedYKey(yKeys[0]);
    }
  }, [selectedYKey, yKeys]);

  const canPlot = data.length > 0 && selectedYKey;

  const chartData = useMemo(() => {
    if (!canPlot) {
      return {
        labels: [],
        datasets: [],
      };
    }

    return {
      labels: data.map((row) => row[xKey]),
      datasets: [
        {
          label: selectedYKey,
          data: data.map((row) => row[selectedYKey]),
          tension: 0.25,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    };
  }, [canPlot, data, xKey, selectedYKey]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xKey,
          },
        },
        y: {
          title: {
            display: true,
            text: selectedYKey,
          },
        },
      },
    }),
    [xKey, selectedYKey]
  );

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div>
          <strong>{file.filename}</strong>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Received: {new Date(file.createdAt).toLocaleString()}
          </div>
        </div>

        {yKeys.length > 1 && (
          <div>
            <label style={{ fontSize: 12, marginRight: 8 }}>Plot:</label>
            <select
              value={selectedYKey}
              onChange={(e) => setSelectedYKey(e.target.value)}
            >
              {yKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!canPlot && (
        <>
          <p style={{ color: "#777" }}>
            Could not find numeric columns to plot. Raw data:
          </p>
          <pre
            style={{
              fontSize: 12,
              overflowX: "auto",
              background: "#f6f6f6",
              padding: 12,
              borderRadius: 6,
            }}
          >
            {JSON.stringify(file.data, null, 2)}
          </pre>
        </>
      )}

      {canPlot && (
        <>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            x-axis: <strong>{xKey}</strong> · y-axis:{" "}
            <strong>{selectedYKey}</strong>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </div>
  );
}

export default function LiveFilePlots() {
  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const socket = io("http://localhost:4000");

    socket.on("connect", () => {
      console.log("Connected to watcher backend:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from watcher backend");
      setConnected(false);
    });

    socket.on("new-file", (payload) => {
      console.log("New file received:", payload);
      setFiles((previous) => [payload, ...previous]);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Live file plots</h2>

      <p>
        Backend connection:{" "}
        <strong style={{ color: connected ? "green" : "crimson" }}>
          {connected ? "connected" : "not connected"}
        </strong>
      </p>

      {files.length === 0 && (
        <p>
          No files received yet. Add a new CSV or JSON file to the watched
          folder.
        </p>
      )}

      {files.map((file) => (
        <FilePlotCard
          key={`${file.filename}-${file.createdAt}`}
          file={file}
        />
      ))}
    </div>
  );
}