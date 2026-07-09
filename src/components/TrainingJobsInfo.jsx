import { useEffect, useMemo, useRef, useState } from "react";
import { planSchedule } from "./CurriculumEditor";

const SSE_URL = "http://127.0.0.1:9999/stream";

const GREEN = "#21B989";
const BLUE  = "#3B8BD4";
const RED   = "#E24B4A";
const GRAY  = "rgba(255,255,255,0.35)";
const TEXT_SECONDARY = "var(--color-text-secondary, rgba(255,255,255,0.55))";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// A crisper stand-in for the "ⓘ" glyph, which renders thin/off-center in most
// system fonts — a plain stroked circle + dot/stem reads cleanly at any size.
function InfoIcon({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.25" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="7.6" r="1.15" fill={color} />
      <path d="M12 11v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// A little progress ring: fraction 0..1 of `color` over a faint track.
function Ring({ frac, color, size = 26 }) {
  const r = (size - 4) / 2, c = 2 * Math.PI * r, cx = size / 2;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${c * clamp01(frac)} ${c}`} transform={`rotate(-90 ${cx} ${cx})`} />
    </svg>
  );
}

/**
 * Top-bar info panel: every job the curriculum will train, each with a progress
 * ring (current episode / total). Only running jobs advance; queued jobs sit at
 * 0 — so a sequential run shows just the head moving, a parallel run shows one
 * ring per busy GPU.
 *
 * `ctx` = { curriculum, maxEpisodes, gpuFree } captured when Train was clicked.
 * The plan (GPU + queue order) comes from planSchedule; live status/episode come
 * from the SSE stream: curriculum_progress events map job_name ↔ node id, and
 * job_name-tagged metric snapshots carry the current episode ("step").
 */
export default function TrainingJobsInfo({ ctx }) {
  const [open, setOpen] = useState(false);
  const [prog, setProg] = useState({});   // job_name -> { node, status, gpu, step }
  const btnRef = useRef(null);

  const plan = useMemo(
    () => planSchedule(ctx?.curriculum, ctx?.gpuFree || []),
    [ctx?.curriculum, ctx?.gpuFree],
  );
  const total = Math.max(1, ctx?.maxEpisodes || 1);

  // Fresh run → fresh progress.
  useEffect(() => { setProg({}); }, [ctx]);

  // Listen to the same SSE stream the live plots use.
  useEffect(() => {
    if (!ctx) return;
    const src = new EventSource(SSE_URL);
    src.onmessage = (e) => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === "curriculum_progress") {
        if (!d.job_name) return;   // start/complete/stopped envelopes carry no job
        setProg((p) => ({ ...p, [d.job_name]: {
          ...(p[d.job_name] || {}), node: d.node, status: d.status,
          gpu: d.gpu, step: d.status === "done" ? total : (p[d.job_name]?.step || 0),
        } }));
      } else if (d.job_name && typeof d.step === "number") {
        // A metric snapshot: carries node + episode. Keep a terminal status if
        // we already have one; otherwise the job is running (covers the case
        // where we subscribed after the one-shot "running" event fired).
        setProg((p) => {
          const prev = p[d.job_name] || {};
          const terminal = ["done", "failed", "skipped"].includes(prev.status);
          return { ...p, [d.job_name]: {
            ...prev, step: d.step, node: d.node ?? prev.node,
            status: terminal ? prev.status : "running",
          } };
        });
      }
    };
    return () => src.close();
  }, [ctx, total]);

  // Progress keyed by node id (plan side) instead of job_name (event side).
  const byNode = useMemo(() => {
    const m = {};
    Object.values(prog).forEach((v) => { if (v.node) m[v.node] = v; });
    return m;
  }, [prog]);

  const view = (j) => {
    const p = byNode[j.nodeId] || {};
    const status = p.status || "queued";
    const step = status === "done" ? total : (p.step || 0);
    const frac = status === "done" ? 1
      : status === "skipped" || status === "failed" ? 0
      : step / total;
    const color = status === "done" ? GREEN
      : status === "running" ? BLUE
      : status === "failed" ? RED : GRAY;
    return { status, step, frac, color };
  };

  const hasJobs = !!ctx && plan.jobs.length > 0;
  const running = hasJobs ? plan.jobs.filter((j) => (byNode[j.nodeId]?.status) === "running").length : 0;
  const done    = hasJobs ? plan.jobs.filter((j) => (byNode[j.nodeId]?.status) === "done").length : 0;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title={hasJobs ? "Training jobs" : "No active training run"}
        style={{
          width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${hasJobs ? "rgba(94,170,240,0.55)" : "rgba(255,255,255,0.2)"}`,
          background: hasJobs
            ? "linear-gradient(160deg, rgba(94,170,240,0.3), rgba(94,170,240,0.12))"
            : "rgba(255,255,255,0.07)",
          color: hasJobs ? "#A9D3F7" : "var(--color-text-primary, rgba(255,255,255,0.75))",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", opacity: hasJobs ? 1 : 0.8,
          transition: "background .2s, color .2s, opacity .2s, border-color .2s",
          animation: running > 0 ? "jobs-info-pulse 2s ease-out infinite" : "none",
        }}
        onMouseEnter={(e) => { if (!hasJobs) e.currentTarget.style.opacity = 1; }}
        onMouseLeave={(e) => { if (!hasJobs) e.currentTarget.style.opacity = 0.8; }}
      >
        <InfoIcon size={15} color={hasJobs ? "#A9D3F7" : "currentColor"} />
        {running > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, padding: "0 3px",
            borderRadius: 999, background: BLUE, color: "#fff", fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 2px var(--color-background-tertiary, #13131a)",
          }}>{running}</span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 10px)", right: 0, width: 340, maxHeight: 420,
            overflowY: "auto", zIndex: 41, padding: 14, borderRadius: 16,
            background: "var(--modal-bg, #1c1c22)", border: "1px solid var(--modal-border, rgba(255,255,255,0.14))",
            boxShadow: "0 20px 55px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            color: "var(--color-text-primary, #f5f5f5)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 11, paddingBottom: 10, borderBottom: "1px solid var(--modal-border, rgba(255,255,255,0.1))" }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.1px" }}>Training jobs</span>
              {hasJobs && (
                <span style={{ fontSize: 10.5, color: TEXT_SECONDARY, fontWeight: 600 }}>
                  {done}/{plan.jobs.length} done{running ? ` · ${running} running` : ""}
                </span>
              )}
            </div>

            {!hasJobs ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "22px 10px", textAlign: "center", color: TEXT_SECONDARY,
              }}>
                <span style={{ opacity: 0.6 }}><InfoIcon size={24} /></span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>No active training run</span>
                <span style={{ fontSize: 11, lineHeight: 1.5 }}>
                  Job progress will appear here once you start training.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.jobs.map((j) => {
                  const v = view(j);
                  return (
                    <div key={j.nodeId} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: 9, borderRadius: 11,
                      background: "var(--surface-muted, rgba(255,255,255,0.03))",
                      border: "1px solid var(--modal-border, rgba(255,255,255,0.08))",
                      transition: "background .15s",
                    }}>
                      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Ring frac={v.frac} color={v.color} />
                        <span style={{ position: "absolute", fontSize: 8, fontWeight: 800, color: v.color }}>
                          {v.status === "done" ? "✓" : `${Math.round(v.frac * 100)}`}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis",
                        }} title={j.label}>
                          <span style={{ color: j.role === "defender" ? "#3B8BD4" : "#E04B4A" }}>
                            {j.role === "defender" ? "🛡️" : "⚔️"}
                          </span>{" "}{j.label}
                        </div>
                        <div style={{ fontSize: 10, color: TEXT_SECONDARY, display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                          <span>{j.phaseName}</span>
                          <span>·</span>
                          <span>{j.gpuLabel}</span>
                          {v.status === "running" || v.status === "queued" ? (
                            <>
                              <span>·</span>
                              <span>ep {v.step}/{total}</span>
                            </>
                          ) : (
                            <>
                              <span>·</span>
                              <span style={{ color: v.color, fontWeight: 700 }}>{v.status}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
