import { useEffect, useMemo, useState } from "react";
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
      <h3 style={{ marginTop: 0 }}>{title}</h3>
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
        <h3 style={{ marginTop: 0 }}>Verification Results</h3>

        <h4>Safety / Reachability Properties</h4>
        <pre style={preStyle}>
          {propertiesText || "No safety_properties.txt found."}
        </pre>

        <h4>Availability Plots</h4>

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

        {!results && <p>No verification results loaded.</p>}
      </div>
    </div>
  );
}

const preStyle = {
  fontSize: 11,
  whiteSpace: "pre-wrap",
  background: "var(--color-surface-secondary)",
  padding: 10,
  borderRadius: 8,
  maxHeight: 260,
  overflow: "auto",
};

const card = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
  background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.03))",
};

const chartWrap = {
  width: "100%",
  height: 340,
};