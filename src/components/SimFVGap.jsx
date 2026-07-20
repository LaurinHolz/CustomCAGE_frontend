import { useCallback, useEffect, useMemo, useState } from "react";

const FV_URL = "http://127.0.0.1:9999/fv-key-metrics";

// Hier denselben Endpoint eintragen, den WatchdogAveragesTable
// für das vorhandene Evaluation-JSON verwendet.
const SIM_URL = "http://127.0.0.1:9999/watchdog-averages";

const GREEN_THRESHOLD = 5;
const YELLOW_THRESHOLD = 15;

const STRUCTURE_METRICS = [
  {
    key: "n_states",
    label: "States",
  },
  {
    key: "n_transitions",
    label: "Transitions",
  },
  {
    key: "number_switches",
    label: "Model switches",
  },
  {
    key: "models_generated",
    label: "Models generated",
  },
];

const COMPARISON_METRICS = [
  {
    label: "Cumulative reward",
    simKey: "reward",
    fvMeanKey: "cumulative_reward_mean",
    fvStdKey: "cumulative_reward_std",
    fvNKey: "cumulative_reward_n",
  },
  {
    label: "Mean reward per step",
    simKey: null,
    fvMeanKey: "mean_reward_per_step_mean",
    fvStdKey: "mean_reward_per_step_std",
    fvNKey: "mean_reward_per_step_n",
  },
  {
    label: "First exploit V1",
    simKey: "first_exploit_V1",
    fvMeanKey: "t_first_exploit_v1_mean",
    fvStdKey: "t_first_exploit_v1_std",
    fvNKey: "t_first_exploit_v1_n",
  },
  {
    label: "First entry V2",
    simKey: "first_entry_V2",
    fvMeanKey: "t_first_entry_v2_mean",
    fvStdKey: "t_first_entry_v2_std",
    fvNKey: "t_first_entry_v2_n",
  },
  {
    label: "First exploit V2",
    simKey: "first_exploit_V2",
    fvMeanKey: "t_first_exploit_v2_mean",
    fvStdKey: "t_first_exploit_v2_std",
    fvNKey: "t_first_exploit_v2_n",
  },
  {
    label: "First entry V3",
    simKey: "first_entry_V3",
    fvMeanKey: "t_first_entry_v3_mean",
    fvStdKey: "t_first_entry_v3_std",
    fvNKey: "t_first_entry_v3_n",
  },
  {
    label: "Exploit attempts V1",
    simKey: null,
    fvMeanKey: "num_exploit_attempts_v1_mean",
    fvStdKey: "num_exploit_attempts_v1_std",
    fvNKey: "num_exploit_attempts_v1_n",
  },
  {
    label: "Exploit attempts V2",
    simKey: null,
    fvMeanKey: "num_exploit_attempts_v2_mean",
    fvStdKey: "num_exploit_attempts_v2_std",
    fvNKey: "num_exploit_attempts_v2_n",
  },
  {
    label: "Exploit attempts V3",
    simKey: null,
    fvMeanKey: "num_exploit_attempts_v3_mean",
    fvStdKey: "num_exploit_attempts_v3_std",
    fvNKey: "num_exploit_attempts_v3_n",
  },
  {
    label: "Restores total",
    simKey: "total_restores",
    fvMeanKey: "restore_total_mean",
    fvStdKey: "restore_total_std",
    fvNKey: "restore_total_n",
  },
  {
    label: "Restores V1",
    simKey: "restore_V1",
    fvMeanKey: "restore_v1_mean",
    fvStdKey: "restore_v1_std",
    fvNKey: "restore_v1_n",
  },
  {
    label: "Restores V2",
    simKey: "restore_V2",
    fvMeanKey: "restore_v2_mean",
    fvStdKey: "restore_v2_std",
    fvNKey: "restore_v2_n",
  },
  {
    label: "Restores V3",
    simKey: "restore_V3",
    fvMeanKey: "restore_v3_mean",
    fvStdKey: "restore_v3_std",
    fvNKey: "restore_v3_n",
  },
];

const STATUS = {
  green: {
    label: "Good",
    color: "#3FE0A8",
    background: "rgba(29, 158, 117, 0.16)",
    border: "rgba(29, 158, 117, 0.38)",
  },
  yellow: {
    label: "Moderate",
    color: "#F5C451",
    background: "rgba(245, 196, 81, 0.15)",
    border: "rgba(245, 196, 81, 0.4)",
  },
  red: {
    label: "Large",
    color: "#FF7373",
    background: "rgba(226, 75, 74, 0.15)",
    border: "rgba(226, 75, 74, 0.4)",
  },
};

const styles = {
  page: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "var(--color-text-primary)",
  },

  subtitle: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--color-text-secondary)",
  },

  refreshButton: {
    padding: "8px 14px",
    borderRadius: 9,
    border: "1px solid var(--color-border-secondary)",
    background: "var(--surface-muted)",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
  },

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(130px, 1fr))",
    gap: 12,
  },

  card: {
    padding: 16,
    borderRadius: 12,
    border: "1px solid var(--color-border-secondary)",
    background: "var(--surface-muted)",
  },

  cardLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--color-text-secondary)",
  },

  cardValue: {
    marginTop: 7,
    fontSize: 22,
    fontWeight: 700,
    color: "var(--color-text-primary)",
    fontVariantNumeric: "tabular-nums",
  },

  legend: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
    fontSize: 11,
    color: "var(--color-text-secondary)",
  },

  panel: {
    overflow: "hidden",
    borderRadius: 12,
    border: "1px solid var(--color-border-secondary)",
    background: "var(--surface-muted)",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: 850,
    borderCollapse: "collapse",
    fontSize: 12,
  },

  th: {
    padding: "11px 14px",
    textAlign: "left",
    borderBottom: "1px solid var(--color-border-secondary)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--color-text-secondary)",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "11px 14px",
    borderBottom: "1px solid var(--color-border-tertiary)",
    color: "var(--color-text-primary)",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },

  metric: {
    fontWeight: 600,
  },

  detail: {
    marginTop: 2,
    fontSize: 10,
    color: "var(--color-text-secondary)",
  },

  loading: {
    padding: 24,
    textAlign: "center",
    fontSize: 12,
    color: "var(--color-text-secondary)",
  },

  error: {
    padding: 14,
    borderRadius: 10,
    border: "1px solid rgba(226, 75, 74, 0.4)",
    background: "rgba(226, 75, 74, 0.12)",
    color: "#FF7373",
    fontSize: 12,
  },
};

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 3) {
  const number = normalizeNumber(value);

  if (number === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(number);
}

function formatInteger(value) {
  const number = normalizeNumber(value);

  if (number === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(number);
}

function calculateGap(simValue, fvValue) {
  const sim = normalizeNumber(simValue);
  const fv = normalizeNumber(fvValue);

  if (sim === null || fv === null) {
    return {
      absoluteGap: null,
      relativeGap: null,
      status: null,
    };
  }

  const absoluteGap = Math.abs(sim - fv);

  let relativeGap;

  if (sim === 0 && fv === 0) {
    relativeGap = 0;
  } else {
    const denominator = Math.max(
      Math.abs(sim),
      Math.abs(fv),
      Number.EPSILON,
    );

    relativeGap = (absoluteGap / denominator) * 100;
  }

  let status = "red";

  if (relativeGap <= GREEN_THRESHOLD) {
    status = "green";
  } else if (relativeGap <= YELLOW_THRESHOLD) {
    status = "yellow";
  }

  return {
    absoluteGap,
    relativeGap,
    status,
  };
}

function StatusBadge({ status }) {
  if (!status || !STATUS[status]) {
    return "-";
  }

  const config = STATUS[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minWidth: 70,
        padding: "4px 9px",
        borderRadius: 999,
        border: `1px solid ${config.border}`,
        background: config.background,
        color: config.color,
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: config.color,
        }}
      />

      {config.label}
    </span>
  );
}

function StructureCard({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{formatInteger(value)}</div>
    </div>
  );
}

function FVValue({ mean, std, n }) {
  const normalizedMean = normalizeNumber(mean);
  const normalizedStd = normalizeNumber(std);
  const normalizedN = normalizeNumber(n);

  if (normalizedMean === null) {
    return "-";
  }

  return (
    <div>
      <div>
        {formatNumber(normalizedMean)}

        {normalizedStd !== null && (
          <span style={{ color: "var(--color-text-secondary)" }}>
            {" "}± {formatNumber(normalizedStd)}
          </span>
        )}
      </div>

      {normalizedN !== null && (
        <div style={styles.detail}>
          n = {formatInteger(normalizedN)}
        </div>
      )}
    </div>
  );
}

function unwrapResponse(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  return (
    data.metrics ??
    data.averages ??
    data.latest ??
    data.data ??
    data
  );
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    let detail = "";

    try {
      const body = await response.json();
      detail = body?.detail ? `: ${body.detail}` : "";
    } catch {
      detail = "";
    }

    throw new Error(`HTTP ${response.status}${detail}`);
  }

  return response.json();
}

export default function SimFVGap() {
  const [simData, setSimData] = useState(null);
  const [fvData, setFvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [simulationResponse, fvResponse] = await Promise.all([
        fetchJson(SIM_URL),
        fetchJson(FV_URL),
      ]);

      setSimData(unwrapResponse(simulationResponse));
      setFvData(unwrapResponse(fvResponse));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return COMPARISON_METRICS.map((metric) => {
      const simValue = metric.simKey
        ? normalizeNumber(simData?.[metric.simKey])
        : null;

      const fvMean = normalizeNumber(fvData?.[metric.fvMeanKey]);
      const fvStd = normalizeNumber(fvData?.[metric.fvStdKey]);
      const fvN = normalizeNumber(fvData?.[metric.fvNKey]);

      return {
        ...metric,
        simValue,
        fvMean,
        fvStd,
        fvN,
        ...calculateGap(simValue, fvMean),
      };
    });
  }, [simData, fvData]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Simulation–FV Gap</h2>

          <p style={styles.subtitle}>
            Comparison between simulation results and the generated formal
            model.
          </p>
        </div>

        <button
          type="button"
          style={{
            ...styles.refreshButton,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "default" : "pointer",
          }}
          onClick={load}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          Could not load Sim–FV metrics: {error}
        </div>
      )}

      {loading && !fvData && !simData && (
        <div style={styles.loading}>
          Loading simulation and FV metrics...
        </div>
      )}

      {(fvData || simData) && (
        <>
          <div style={styles.cards}>
            {STRUCTURE_METRICS.map((metric) => (
              <StructureCard
                key={metric.key}
                label={metric.label}
                value={fvData?.[metric.key]}
              />
            ))}
          </div>

          <div style={styles.legend}>
            <span>Relative difference:</span>

            <StatusBadge status="green" />
            <span>≤ {GREEN_THRESHOLD}%</span>

            <StatusBadge status="yellow" />
            <span>≤ {YELLOW_THRESHOLD}%</span>

            <StatusBadge status="red" />
            <span>&gt; {YELLOW_THRESHOLD}%</span>
          </div>

          <div style={styles.panel}>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Metric</th>
                    <th style={styles.th}>Simulation</th>
                    <th style={styles.th}>Formal model</th>
                    <th style={styles.th}>Absolute gap</th>
                    <th style={styles.th}>Relative gap</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.fvMeanKey}>
                      <td style={styles.td}>
                        <span style={styles.metric}>{row.label}</span>
                      </td>

                      <td style={styles.td}>
                        {formatNumber(row.simValue)}
                      </td>

                      <td style={styles.td}>
                        <FVValue
                          mean={row.fvMean}
                          std={row.fvStd}
                          n={row.fvN}
                        />
                      </td>

                      <td style={styles.td}>
                        {formatNumber(row.absoluteGap)}
                      </td>

                      <td style={styles.td}>
                        {isNumber(row.relativeGap)
                          ? `${formatNumber(row.relativeGap, 2)}%`
                          : "-"}
                      </td>

                      <td style={styles.td}>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}