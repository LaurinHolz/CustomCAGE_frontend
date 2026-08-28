import { useState, useCallback, useRef, useMemo } from "react";
import { S } from "../styles/styles";
import { HOST_W, HOST_H, ZONE_W, ZONE_H, ZONE_PAD } from "../constants/layout";

const DEFENDER_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626", "#0891B2"];

const makeEntityKey = (type, id) => `${type}:${id}`;
const parseEntityKey = (key) => {
  const idx = key.indexOf(":");
  return idx === -1 ? { type: "host", id: key } : { type: key.slice(0, idx), id: key.slice(idx + 1) };
};

// ─── Topology Canvas (SVG) ────────────────────────────────────────
export default function TopologyCanvas({
  state,
  setState,
  mode,
  connectFrom,
  setConnectFrom,
  onSelect,
  selectedId,
  showAttackPaths = false,
}) {
  const svgRef = useRef(null);
  const dragStartRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wasDragged, setWasDragged] = useState(false);
  const [clickTarget, setClickTarget] = useState(null);
  const [assigningDefenderId, setAssigningDefenderId] = useState(null);

  // Backward compatible: old scenarios without these fields still load.
  const marlEnabled = state.marlEnabled ?? false;
  const defenders = state.defenders ?? [];

  const toggleMarl = useCallback(() => {
    setState((s) => ({
      ...s,
      marlEnabled: !(s.marlEnabled ?? false),
      defenders: s.defenders ?? [],
    }));
    setAssigningDefenderId(null);
  }, [setState]);

  const addDefender = useCallback(() => {
    setState((s) => {
      const current = s.defenders ?? [];
      const usedNumbers = new Set(
        current
          .map((d) => Number(String(d.id).replace(/\D/g, "")))
          .filter(Number.isFinite)
      );
      let n = 1;
      while (usedNumbers.has(n)) n += 1;
      const id = `d${n}`;
      const defender = {
        id,
        name: `Defender ${n}`,
        color: DEFENDER_COLORS[(n - 1) % DEFENDER_COLORS.length],
        entityKeys: [],
      };
      return { ...s, marlEnabled: true, defenders: [...current, defender] };
    });
  }, [setState]);

  const removeDefender = useCallback((defenderId) => {
    setState((s) => ({
      ...s,
      defenders: (s.defenders ?? []).filter((d) => d.id !== defenderId),
    }));
    setAssigningDefenderId((id) => (id === defenderId ? null : id));
  }, [setState]);

  const toggleEntityAssignment = useCallback((type, id) => {
    if (!marlEnabled || !assigningDefenderId) return;
    const key = makeEntityKey(type, id);
    setState((s) => ({
      ...s,
      defenders: (s.defenders ?? []).map((d) => {
        if (d.id !== assigningDefenderId) return d;
        const entityKeys = d.entityKeys ?? [];
        const nextKeys = entityKeys.includes(key)
          ? entityKeys.filter((k) => k !== key)
          : [...entityKeys, key];
        return { ...d, entityKeys: nextKeys };
      }),
    }));
  }, [marlEnabled, assigningDefenderId, setState]);

  const defendersForEntity = useCallback((type, id) => {
    const key = makeEntityKey(type, id);
    return defenders.filter((d) => (d.entityKeys ?? []).includes(key));
  }, [defenders]);

  const getEntityName = useCallback((entityKey) => {
    const { type, id } = parseEntityKey(entityKey);
    if (type === "zone") return state.zones.find((z) => z.id === id)?.name ?? id;
    return state.hosts.find((h) => h.id === id)?.name ?? id;
  }, [state.zones, state.hosts]);

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = 900 / rect.width;
    const scaleY = 480 / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const onZoneBoxMouseDown = useCallback((e, zoneId) => {
    e.stopPropagation();

    // MARL assignment takes precedence over normal canvas editing.
    if (marlEnabled && assigningDefenderId) {
      toggleEntityAssignment("zone", zoneId);
      return;
    }

    if (mode !== "select") return;

    const pt = getSvgPoint(e);
    const zone = state.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const hostsInZone = state.hosts.filter((h) => h.zoneId === zoneId);

    dragStartRef.current = {
      startPoint: pt,
      zone: { ...zone },
      hosts: hostsInZone.map((h) => ({ ...h })),
    };

    setClickTarget({ id: zoneId, type: "zone" });
    setDragging({ id: zoneId, type: "zoneBox" });
    setWasDragged(false);
  }, [
    mode,
    getSvgPoint,
    state.zones,
    state.hosts,
    marlEnabled,
    assigningDefenderId,
    toggleEntityAssignment,
  ]);

  const onMouseDown = useCallback((e, id, type) => {
    e.stopPropagation();

    // While a defender is active, clicking an entity only toggles responsibility.
    if (marlEnabled && assigningDefenderId) {
      toggleEntityAssignment(type, id);
      return;
    }

    setClickTarget({ id, type });

    if (mode === "select") {
      // In Select-Modus: warten auf mouseup
    }

    if (mode === "connect") {
      if (!connectFrom) {
        setConnectFrom({ id, type });
      } else {
        const fromIsZone = connectFrom.type === "zone";
        const toIsZone = type === "zone";
        if (connectFrom.id === id) { setConnectFrom(null); return; }
        if (!fromIsZone && !toIsZone) { setConnectFrom(null); return; }
        if (fromIsZone && toIsZone) {
          const exists = state.zoneConnections.some(c => (c.from===connectFrom.id&&c.to===id)||(c.from===id&&c.to===connectFrom.id));
          if (!exists) setState(s => ({ ...s, zoneConnections: [...s.zoneConnections, { from: connectFrom.id, to: id }] }));
        } else {
          const hostId = fromIsZone ? id : connectFrom.id;
          const zoneId = fromIsZone ? connectFrom.id : id;
          setState(s => ({ ...s, hosts: s.hosts.map(h => h.id === hostId ? { ...h, zoneId } : h) }));
        }
        setConnectFrom(null);
      }
      return;
    }

    if (mode === "attack") {
      if (type === "zone") return;
      if (!connectFrom) {
        setConnectFrom({ id, type: "host" });
      } else {
        if (connectFrom.id === id) { setConnectFrom(null); return; }
        const exists = state.attackPaths.some(c => c.from===connectFrom.id&&c.to===id);
        if (!exists) setState(s => ({ ...s, attackPaths: [...s.attackPaths, { from: connectFrom.id, to: id }] }));
        setConnectFrom(null);
      }
      return;
    }

    const pt = getSvgPoint(e);
    const item = type === "zone" ? state.zones.find(z => z.id === id) : state.hosts.find(h => h.id === id);
    if (item) {
      setDragOffset({ x: pt.x - item.x, y: pt.y - item.y });
      setDragging({ id, type });
      setWasDragged(false);
    }
  }, [
    mode,
    connectFrom,
    state,
    setState,
    setConnectFrom,
    getSvgPoint,
    marlEnabled,
    assigningDefenderId,
    toggleEntityAssignment,
  ]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    if (marlEnabled && assigningDefenderId) return;

    const pt = getSvgPoint(e);

    // Drag entire zone box together with all hosts inside it
    if (dragging.type === "zoneBox") {
      const start = dragStartRef.current;
      if (!start) return;

      const dx = pt.x - start.startPoint.x;
      const dy = pt.y - start.startPoint.y;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setWasDragged(true);

      setState((s) => ({
        ...s,
        zones: s.zones.map((z) =>
          z.id === dragging.id
            ? {
                ...z,
                x: Math.max(10, Math.min(880, start.zone.x + dx)),
                y: Math.max(10, Math.min(460, start.zone.y + dy)),
              }
            : z
        ),
        hosts: s.hosts.map((h) => {
          const originalHost = start.hosts.find((sh) => sh.id === h.id);
          if (!originalHost) return h;
          return {
            ...h,
            x: Math.max(10, Math.min(880, originalHost.x + dx)),
            y: Math.max(10, Math.min(460, originalHost.y + dy)),
          };
        }),
      }));
      return;
    }

    const nx = Math.max(10, Math.min(880, pt.x - dragOffset.x));
    const ny = Math.max(10, Math.min(460, pt.y - dragOffset.y));

    const item = dragging.type === "zone"
      ? state.zones.find((z) => z.id === dragging.id)
      : state.hosts.find((h) => h.id === dragging.id);

    if (item && (Math.abs(item.x - nx) > 2 || Math.abs(item.y - ny) > 2)) setWasDragged(true);

    if (dragging.type === "zone") {
      setState((s) => ({
        ...s,
        zones: s.zones.map((z) => z.id === dragging.id ? { ...z, x: nx, y: ny } : z),
      }));
    } else {
      setState((s) => ({
        ...s,
        hosts: s.hosts.map((h) => h.id === dragging.id ? { ...h, x: nx, y: ny } : h),
      }));
    }
  }, [
    dragging,
    dragOffset,
    getSvgPoint,
    setState,
    state.hosts,
    state.zones,
    marlEnabled,
    assigningDefenderId,
  ]);

  const onMouseUp = useCallback(() => {
    if (marlEnabled && assigningDefenderId) {
      setDragging(null);
      setWasDragged(false);
      dragStartRef.current = null;
      setTimeout(() => setClickTarget(null), 0);
      return;
    }

    if (mode === "select" && !wasDragged && clickTarget) {
      if (selectedId === clickTarget.id) onSelect?.(null);
      else onSelect?.(clickTarget);
    }

    setDragging(null);
    setWasDragged(false);
    dragStartRef.current = null;
    setTimeout(() => setClickTarget(null), 0);
  }, [mode, wasDragged, clickTarget, onSelect, selectedId, marlEnabled, assigningDefenderId]);

  const handleCanvasClick = useCallback(() => {
    if (marlEnabled && assigningDefenderId) return;
    if (mode === "select" && !wasDragged && !clickTarget) onSelect?.(null);
  }, [mode, onSelect, wasDragged, clickTarget, marlEnabled, assigningDefenderId]);

  const getCenter = (id) => {
    const z = state.zones.find(z => z.id === id);
    if (z) return { x: z.x + ZONE_W / 2, y: z.y + ZONE_H / 2 };
    const h = state.hosts.find(h => h.id === id);
    if (h) return { x: h.x + HOST_W / 2, y: h.y + HOST_H / 2 };
    return { x: 0, y: 0 };
  };

  const zoneBounds = useMemo(() => {
    const bounds = {};
    state.zones.forEach(z => {
      const hostsInZone = state.hosts.filter(h => h.zoneId === z.id);
      if (hostsInZone.length === 0) {
        bounds[z.id] = { x: z.x - 10, y: z.y - 8, w: ZONE_W + 20, h: ZONE_H + 16 };
      } else {
        const LABEL_BAND = ZONE_H + 10;
        const allX = hostsInZone.map(h => h.x);
        const allY = hostsInZone.map(h => h.y);
        const allXR = hostsInZone.map(h => h.x + HOST_W);
        const allYB = hostsInZone.map(h => h.y + HOST_H);
        const minx = Math.min(...allX) - ZONE_PAD;
        const miny = Math.min(...allY) - ZONE_PAD - LABEL_BAND;
        const maxx = Math.max(...allXR) + ZONE_PAD;
        const maxy = Math.max(...allYB) + ZONE_PAD;
        bounds[z.id] = { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
      }
    });
    return bounds;
  }, [state.zones, state.hosts]);

  const renderDefenderBadges = (type, id, x, y) => {
    if (!marlEnabled) return null;
    const assigned = defendersForEntity(type, id);
    if (assigned.length === 0) return null;

    return (
      <g pointerEvents="none">
        {assigned.map((d, index) => (
          <g key={`${type}-${id}-${d.id}`} transform={`translate(${x + index * 15}, ${y})`}>
            <circle cx="0" cy="0" r="6" fill={d.color} stroke="white" strokeWidth="1" />
            <text
              x="0"
              y="0.4"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6.5"
              fontWeight="700"
              fill="white"
              fontFamily="inherit"
            >
              {String(d.id).replace(/^d/i, "")}
            </text>
          </g>
        ))}
      </g>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* MARL controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "8px 10px",
        border: "1px solid var(--color-border-secondary)",
        borderRadius: 8,
        background: "var(--color-background-secondary)",
      }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
          <input type="checkbox" checked={marlEnabled} onChange={toggleMarl} />
          MARL
        </label>

        {marlEnabled && (
          <>
            <button type="button" onClick={addDefender} style={{ padding: "5px 9px", borderRadius: 6, cursor: "pointer" }}>
              + Defender
            </button>

            <span style={{ width: 1, height: 24, background: "var(--color-border-secondary)", margin: "0 2px" }} />

            {defenders.map((d, index) => {
              const active = assigningDefenderId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setAssigningDefenderId(active ? null : d.id)}
                  title={active ? "Stop assigning entities" : `Assign entities to ${d.name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 8px",
                    borderRadius: 999,
                    border: `1.5px solid ${d.color}`,
                    background: active ? `${d.color}20` : "transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    color: "white",
                  }}
                >
                  <span style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: d.color,
                    color: "white",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                  }}>
                    {index + 1}
                  </span>
                  {d.name}
                </button>
              );
            })}

            {assigningDefenderId && (
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                Click zones/hosts to toggle responsibility. Overlap is allowed.
              </span>
            )}
          </>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 900 480"
        style={S.canvas}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={handleCanvasClick}
      >
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
          <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
        </defs>

        {/* Zone bounding backgrounds */}
        {state.zones.map((z) => {
          const b = zoneBounds[z.id];
          if (!b) return null;
          const assigned = defendersForEntity("zone", z.id);
          const isAssignmentTarget = marlEnabled && assigningDefenderId && assigned.some(d => d.id === assigningDefenderId);
          const activeDefender = defenders.find(d => d.id === assigningDefenderId);

          return (
            <g key={z.id + "_bg"}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx="14"
                fill={z.color}
                fillOpacity="0.07"
                stroke={isAssignmentTarget ? activeDefender?.color : z.color}
                strokeWidth={isAssignmentTarget ? "2.2" : "0.5"}
                strokeDasharray={isAssignmentTarget ? "none" : "6 3"}
                style={{
                  cursor: marlEnabled && assigningDefenderId
                    ? "crosshair"
                    : mode === "select" ? "grab" : "default",
                }}
                onMouseDown={(e) => onZoneBoxMouseDown(e, z.id)}
              />
              {renderDefenderBadges("zone", z.id, b.x + b.w - 9, b.y + 10)}
            </g>
          );
        })}

        {/* Zone connections */}
        {state.zoneConnections.map((c, i) => {
          const f = getCenter(c.from), t = getCenter(c.to);
          return <line key={"zc" + i} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeDasharray="8 4" markerEnd="url(#arr)"/>;
        })}

        {/* Attack paths */}
        {showAttackPaths && state.attackPaths.map((c, i) => {
          const f = getCenter(c.from), t = getCenter(c.to);
          const dx = t.x - f.x, dy = t.y - f.y;
          const len = Math.sqrt(dx*dx + dy*dy) || 1;
          const ux = dx/len, uy = dy/len;
          const sx = f.x + ux * (HOST_W/2 + 2), sy = f.y + uy * (HOST_H/2 + 2);
          const ex = t.x - ux * (HOST_W/2 + 8), ey = t.y - uy * (HOST_H/2 + 8);
          return <line key={"ap" + i} x1={sx} y1={sy} x2={ex} y2={ey} stroke="#E24B4A" strokeWidth="1.2" strokeDasharray="4 2" markerEnd="url(#arr-red)" opacity="0.75"/>;
        })}

        {/* Zone labels */}
        {state.zones.map(z => {
          const isSelected = selectedId === z.id;
          const b = zoneBounds[z.id];
          const lx = b ? b.x + b.w / 2 - ZONE_W / 2 : z.x;
          const ly = b ? b.y + 5 : z.y;
          const assignmentActive = marlEnabled && assigningDefenderId;
          return (
            <g
              key={z.id}
              style={{ cursor: assignmentActive ? "crosshair" : mode === "select" ? "grab" : "pointer" }}
              onMouseDown={(e) => onMouseDown(e, z.id, "zone")}
            >
              <rect x={lx} y={ly} width={ZONE_W} height={ZONE_H} rx="8"
                fill={z.color} fillOpacity={isSelected ? "0.35" : "0.22"}
                stroke={isSelected ? "#FFD700" : z.color}
                strokeWidth={isSelected ? 3 : (connectFrom?.id === z.id ? 2.5 : 0.5)}/>
              {isSelected && !assignmentActive && (
                <rect x={lx - 4} y={ly - 4} width={ZONE_W + 8} height={ZONE_H + 8} rx="10"
                  fill="none" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8"/>
              )}
              <text x={lx + ZONE_W/2} y={ly + ZONE_H/2 + 1} textAnchor="middle" dominantBaseline="central"
                fontSize="12" fontWeight={isSelected ? "600" : "500"} fill={z.color} fontFamily="inherit">
                {z.name}
              </text>
            </g>
          );
        })}

        {/* Hosts */}
        {state.hosts.map(h => {
          const isServer = h.type === "server";
          const isActive = connectFrom?.id === h.id;
          const isSelected = selectedId === h.id;
          const zone = state.zones.find(z => z.id === h.zoneId);
          const borderCol = zone?.color || (isServer ? "#BA7517" : "#378ADD");
          const fillCol = zone ? zone.color : (isServer ? "#BA7517" : "#378ADD");
          const assigned = defendersForEntity("host", h.id);
          const activeDefender = defenders.find(d => d.id === assigningDefenderId);
          const isAssignmentTarget = marlEnabled && assigningDefenderId && assigned.some(d => d.id === assigningDefenderId);
          const sw = isAssignmentTarget ? 2.5 : isActive ? 2.5 : (isSelected ? 3 : 0.5);
          const assignmentActive = marlEnabled && assigningDefenderId;

          return (
            <g
              key={h.id}
              style={{ cursor: assignmentActive ? "crosshair" : mode === "select" ? "grab" : "pointer" }}
              onMouseDown={(e) => onMouseDown(e, h.id, "host")}
            >
              <rect x={h.x} y={h.y} width={HOST_W} height={HOST_H} rx={isServer ? 4 : 6}
                fill={fillCol} fillOpacity={isSelected ? "0.25" : "0.12"}
                stroke={isAssignmentTarget ? activeDefender?.color : isSelected ? "#FFD700" : borderCol}
                strokeWidth={sw}/>
              {isSelected && !assignmentActive && (
                <rect x={h.x - 3} y={h.y - 3} width={HOST_W + 6} height={HOST_H + 6} rx={isServer ? 6 : 8}
                  fill="none" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8"/>
              )}
              {isServer && (
                <line x1={h.x} y1={h.y + 7} x2={h.x + HOST_W} y2={h.y + 7}
                  stroke={borderCol} strokeWidth="0.4" opacity="0.5"/>
              )}
              <text x={h.x + HOST_W/2} y={h.y + HOST_H/2 + 1} textAnchor="middle" dominantBaseline="central"
                fontSize="11" fontWeight={isSelected ? "700" : "600"} fill="var(--color-text-primary)" fontFamily="inherit">
                {h.name}
              </text>
              <text x={h.x + HOST_W - 4} y={h.y + 9} textAnchor="end" fontSize="7" fill="var(--color-text-secondary)" fontFamily="inherit" opacity="0.85">
                {isServer ? "srv" : "hst"}
              </text>
              {renderDefenderBadges("host", h.id, h.x + HOST_W - 2, h.y + 2)}
            </g>
          );
        })}

        {/* Mode instructions at bottom */}
        {assigningDefenderId ? (
          <text x="450" y="472" textAnchor="middle" fontSize="11" fill="var(--color-text-info)" fontWeight="500" fontFamily="inherit">
            MARL assignment: click entities to add/remove responsibility (overlap allowed)
          </text>
        ) : mode === "connect" ? (
          <text x="450" y="472" textAnchor="middle" fontSize="11" fill="var(--color-text-info)" fontWeight="500" fontFamily="inherit">
            Click two entities to connect (zone↔zone or host→zone)
          </text>
        ) : mode === "attack" ? (
          <text x="450" y="472" textAnchor="middle" fontSize="11" fill="#E24B4A" fontWeight="500" fontFamily="inherit">
            Click source host → then target host to create attack path
          </text>
        ) : null}
      </svg>

      {/* MARL overview */}
      {marlEnabled && defenders.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
        }}>
          {defenders.map((d, index) => {
            const entityKeys = d.entityKeys ?? [];
            return (
              <div key={d.id} style={{
                border: `1px solid ${d.color}55`,
                borderLeft: `4px solid ${d.color}`,
                borderRadius: 8,
                padding: "8px 10px",
                background: `${d.color}0A`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700 }}>
                    <span style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: d.color,
                      color: "white",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                    }}>
                      {index + 1}
                    </span>
                    {d.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDefender(d.id)}
                    title={`Remove ${d.name}`}
                    style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 14 }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.45, color: "var(--color-text-secondary)" }}>
                  {entityKeys.length === 0
                    ? "No entities assigned"
                    : entityKeys.map(getEntityName).join(", ")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}