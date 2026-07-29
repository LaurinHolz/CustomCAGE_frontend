import { useCallback, useEffect, useMemo, useState } from "react";

const FV_URL = "http://127.0.0.1:9999/fv-key-metrics";
const SIM_URL = "http://127.0.0.1:9999/watchdog-averages";

const GOOD_STANDARDIZED_THRESHOLD = 0.5;
const MODERATE_STANDARDIZED_THRESHOLD = 1.0;

// Evaluation runs use a fixed horizon of 100 steps per episode.
const SIMULATION_STEPS_PER_EPISODE = 100;

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
    simMeanKey: "reward",
    simStdKey: "reward_std",
    simNKey: "reward_n",
    fvMeanKey: "cumulative_reward_mean",
    fvStdKey: "cumulative_reward_std",
    fvNKey: "cumulative_reward_n",
  },
  {
    label: "Mean reward per step",
    // The simulation stores cumulative reward per episode. Because every
    // evaluation episode has a fixed 100-step horizon, mean and standard
    // deviation per step are obtained by dividing both by 100.
    simMeanKey: "reward",
    simStdKey: "reward_std",
    simNKey: "reward_n",
    simDivisor: SIMULATION_STEPS_PER_EPISODE,
    fvMeanKey: "mean_reward_per_step_mean",
    fvStdKey: "mean_reward_per_step_std",
    fvNKey: "mean_reward_per_step_n",
  },
  {
    label: "First exploit V1",
    simMeanKey: "first_exploit_V1",
    simStdKey: "first_exploit_V1_std",
    simNKey: "first_exploit_V1_n",
    fvMeanKey: "t_first_exploit_v1_mean",
    fvStdKey: "t_first_exploit_v1_std",
    fvNKey: "t_first_exploit_v1_n",
  },
  {
    label: "First entry V2",
    simMeanKey: "first_entry_V2",
    simStdKey: "first_entry_V2_std",
    simNKey: "first_entry_V2_n",
    fvMeanKey: "t_first_entry_v2_mean",
    fvStdKey: "t_first_entry_v2_std",
    fvNKey: "t_first_entry_v2_n",
  },
  {
    label: "First exploit V2",
    simMeanKey: "first_exploit_V2",
    simStdKey: "first_exploit_V2_std",
    simNKey: "first_exploit_V2_n",
    fvMeanKey: "t_first_exploit_v2_mean",
    fvStdKey: "t_first_exploit_v2_std",
    fvNKey: "t_first_exploit_v2_n",
  },
  {
    label: "First entry V3",
    simMeanKey: "first_entry_V3",
    simStdKey: "first_entry_V3_std",
    simNKey: "first_entry_V3_n",
    fvMeanKey: "t_first_entry_v3_mean",
    fvStdKey: "t_first_entry_v3_std",
    fvNKey: "t_first_entry_v3_n",
  },
  {
    label: "Restores total",
    simMeanKey: "total_restores",
    simStdKey: "total_restores_std",
    simNKey: "total_restores_n",
    fvMeanKey: "restore_total_mean",
    fvStdKey: "restore_total_std",
    fvNKey: "restore_total_n",
  },
  {
    label: "Restores V1",
    simMeanKey: "restore_V1",
    simStdKey: "restore_V1_std",
    simNKey: "restore_V1_n",
    fvMeanKey: "restore_v1_mean",
    fvStdKey: "restore_v1_std",
    fvNKey: "restore_v1_n",
  },
  {
    label: "Restores V2",
    simMeanKey: "restore_V2",
    simStdKey: "restore_V2_std",
    simNKey: "restore_V2_n",
    fvMeanKey: "restore_v2_mean",
    fvStdKey: "restore_v2_std",
    fvNKey: "restore_v2_n",
  },
  {
    label: "Restores V3",
    simMeanKey: "restore_V3",
    simStdKey: "restore_V3_std",
    simNKey: "restore_V3_n",
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
    minWidth: 1080,
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

function calculateGap(simMeanValue, fvMeanValue, simStdValue, fvStdValue) {
  const simMean = normalizeNumber(simMeanValue);
  const fvMean = normalizeNumber(fvMeanValue);
  const simStd = normalizeNumber(simStdValue);
  const fvStd = normalizeNumber(fvStdValue);

  if (simMean === null || fvMean === null) {
    return {
      absoluteGap: null,
      relativeGap: null,
      standardizedGap: null,
      status: null,
    };
  }

  const absoluteGap = Math.abs(simMean - fvMean);

  let relativeGap;

  if (simMean === 0 && fvMean === 0) {
    relativeGap = 0;
  } else {
    const denominator = Math.max(
      Math.abs(simMean),
      Math.abs(fvMean),
      Number.EPSILON,
    );

    relativeGap = (absoluteGap / denominator) * 100;
  }

  // The status is based on the mean difference relative to the typical
  // episode-to-episode variation in simulation and formal-model samples.
  // Sample sizes are deliberately not used here: using standard errors would
  // make even practically small differences look large for high n.
  let standardizedGap = null;
  let status = null;

  if (simStd !== null && fvStd !== null && simStd >= 0 && fvStd >= 0) {
    const combinedStd = Math.sqrt((simStd ** 2 + fvStd ** 2) / 2);

    if (combinedStd <= Number.EPSILON) {
      standardizedGap = absoluteGap <= Number.EPSILON
        ? 0
        : Number.POSITIVE_INFINITY;
    } else {
      standardizedGap = absoluteGap / combinedStd;
    }

    if (standardizedGap <= GOOD_STANDARDIZED_THRESHOLD) {
      status = "green";
    } else if (standardizedGap <= MODERATE_STANDARDIZED_THRESHOLD) {
      status = "yellow";
    } else {
      status = "red";
    }
  }

  return {
    absoluteGap,
    relativeGap,
    standardizedGap,
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

function MetricValue({ mean, std, n }) {
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

function flattenStatistics(statistics) {
  if (!statistics || typeof statistics !== "object") {
    return {};
  }

  return Object.entries(statistics).reduce((flat, [key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      flat[key] = value;
      return flat;
    }

    const hasStatistics =
      Object.prototype.hasOwnProperty.call(value, "mean") ||
      Object.prototype.hasOwnProperty.call(value, "std") ||
      Object.prototype.hasOwnProperty.call(value, "n");

    if (!hasStatistics) {
      flat[key] = value;
      return flat;
    }

    flat[key] = value.mean ?? null;
    flat[`${key}_std`] = value.std ?? null;
    flat[`${key}_n`] = value.n ?? null;
    return flat;
  }, {});
}

function unwrapResponse(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  if (data.statistics && typeof data.statistics === "object") {
    return flattenStatistics(data.statistics);
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
      setError(
        loadError instanceof Error
          ? loadError.message
          : String(loadError),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return COMPARISON_METRICS.map((metric) => {
      const simDivisor = normalizeNumber(metric.simDivisor) ?? 1;

      const rawSimMean = metric.simMeanKey
        ? normalizeNumber(simData?.[metric.simMeanKey])
        : null;
      const rawSimStd = metric.simStdKey
        ? normalizeNumber(simData?.[metric.simStdKey])
        : null;

      const simMean = rawSimMean === null
        ? null
        : rawSimMean / simDivisor;
      const simStd = rawSimStd === null
        ? null
        : rawSimStd / simDivisor;
      const simN = metric.simNKey
        ? normalizeNumber(simData?.[metric.simNKey])
        : null;

      const fvMean = normalizeNumber(fvData?.[metric.fvMeanKey]);
      const fvStd = normalizeNumber(fvData?.[metric.fvStdKey]);
      const fvN = normalizeNumber(fvData?.[metric.fvNKey]);

      return {
        ...metric,
        simMean,
        simStd,
        simN,
        fvMean,
        fvStd,
        fvN,
        ...calculateGap(
          simMean,
          fvMean,
          simStd,
          fvStd,
        ),
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
            model. Values are shown as mean ± standard deviation.
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
            <span>Status based on standardized mean difference:</span>

            <StatusBadge status="green" />
            <span>≤ {GOOD_STANDARDIZED_THRESHOLD}</span>

            <StatusBadge status="yellow" />
            <span>≤ {MODERATE_STANDARDIZED_THRESHOLD}</span>

            <StatusBadge status="red" />
            <span>&gt; {MODERATE_STANDARDIZED_THRESHOLD}</span>
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
                    <th style={styles.th}>Standardized gap</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td style={styles.td}>
                        <span style={styles.metric}>{row.label}</span>
                      </td>

                      <td style={styles.td}>
                        <MetricValue
                          mean={row.simMean}
                          std={row.simStd}
                          n={row.simN}
                        />
                      </td>

                      <td style={styles.td}>
                        <MetricValue
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
                        {Number.isFinite(row.standardizedGap)
                          ? formatNumber(row.standardizedGap, 2)
                          : row.standardizedGap === Number.POSITIVE_INFINITY
                            ? "∞"
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