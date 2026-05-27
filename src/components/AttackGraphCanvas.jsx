// ─── Attack Graph Canvas (mit gruppierter Anordnung in Spalten) ──────────────
export default function AttackGraphCanvas({ state, setState, mode, connectFrom, setConnectFrom, onSelect, selectedId }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wasDragged, setWasDragged] = useState(false);
  const [clickTarget, setClickTarget] = useState(null);

  // Berechne gruppierte Positionen für Hosts innerhalb ihrer Zonen (untereinander)
  const getGroupedPositions = useCallback(() => {
    const positions = {};
    const ZONE_START_X = 80;
    const ZONE_WIDTH = 180;
    const ZONE_GAP = 30;
    const HOST_Y_SPACING = 50;
    const ZONE_HEADER_H = 40;
    const START_Y = 60;

    // Zonen nebeneinander anordnen
    const zoneList = state.zones;
    zoneList.forEach((zone, zoneIdx) => {
      const zoneX = ZONE_START_X + zoneIdx * (ZONE_WIDTH + ZONE_GAP);
      const hostsInZone = state.hosts.filter(h => h.zoneId === zone.id);

      // Hosts untereinander anordnen
      hostsInZone.forEach((host, hostIdx) => {
        positions[host.id] = {
          x: zoneX + (ZONE_WIDTH - HOST_W) / 2, // Zentriert in der Zone
          y: START_Y + ZONE_HEADER_H + hostIdx * HOST_Y_SPACING
        };
      });
    });

    // Unassigned hosts (unten zentriert, auch untereinander)
    const unassigned = state.hosts.filter(h => !h.zoneId);
    const unassignedStartX = 450;
    const unassignedStartY = 380;
    const unassignedYSpacing = 45;

    unassigned.forEach((host, idx) => {
      positions[host.id] = {
        x: unassignedStartX - HOST_W / 2,
        y: unassignedStartY + idx * unassignedYSpacing
      };
    });

    return positions;
  }, [state.zones, state.hosts]);

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = 900 / rect.width;
    const scaleY = 480 / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const onMouseDown = useCallback((e, id, type) => {
    e.stopPropagation();
    setClickTarget({ id, type });

    if (mode === "select") {
      // warten auf mouseup
    }

    if (mode === "attack") {
      if (type === "zone") return;
      if (!connectFrom) {
        setConnectFrom({ id, type: "host" });
      } else {
        if (connectFrom.id === id) { setConnectFrom(null); return; }
        const exists = state.attackPaths.some(c => c.from===connectFrom.id && c.to===id);
        if (!exists) setState(s => ({ ...s, attackPaths: [...s.attackPaths, { from: connectFrom.id, to: id }] }));
        setConnectFrom(null);
      }
      return;
    }

    const pt = getSvgPoint(e);
    const groupedPos = getGroupedPositions();
    const pos = groupedPos[id];
    if (pos) {
      setDragOffset({ x: pt.x - pos.x, y: pt.y - pos.y });
      setDragging({ id, type });
      setWasDragged(false);
    }
  }, [mode, connectFrom, state, setState, setConnectFrom, getSvgPoint, getGroupedPositions]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const pt = getSvgPoint(e);
    const nx = Math.max(10, Math.min(880, pt.x - dragOffset.x));
    const ny = Math.max(10, Math.min(460, pt.y - dragOffset.y));

    const groupedPos = getGroupedPositions();
    const oldPos = groupedPos[dragging.id];
    if (oldPos && (Math.abs(oldPos.x - nx) > 2 || Math.abs(oldPos.y - ny) > 2)) {
      setWasDragged(true);
    }

    // Im Attack Graph: Position nur temporär speichern, nicht im State
    if (dragging.type === "host") {
      // Hier würden wir temporäre Positionen verwalten
      // Für die Einfachheit lassen wir Drag im Attack Graph vorerst zu
    }
  }, [dragging, dragOffset, getSvgPoint, getGroupedPositions]);

  const onMouseUp = useCallback((e) => {
    if (mode === "select" && !wasDragged && clickTarget) {
      if (selectedId === clickTarget.id) {
        onSelect?.(null);
      } else {
        onSelect?.(clickTarget);
      }
    }
    setDragging(null);
    setWasDragged(false);
    setTimeout(() => setClickTarget(null), 0);
  }, [mode, wasDragged, clickTarget, onSelect, selectedId]);

  const handleCanvasClick = useCallback((e) => {
    if (mode === "select" && !wasDragged && !clickTarget) {
      onSelect?.(null);
    }
  }, [mode, onSelect, wasDragged, clickTarget]);

  const getCenter = (id) => {
    const groupedPos = getGroupedPositions();
    const pos = groupedPos[id];
    if (pos) return { x: pos.x + HOST_W/2, y: pos.y + HOST_H/2 };
    return { x: 0, y: 0 };
  };

  // Berechne Zone-Bounds für die gruppierte Ansicht (Spalten-Layout)
  const getZoneBounds = useCallback(() => {
    const bounds = {};
    const ZONE_WIDTH = 180;
    const ZONE_START_X = 80;
    const ZONE_GAP = 30;
    const ZONE_HEADER_H = 40;
    const START_Y = 60;
    const HOST_Y_SPACING = 50;

    state.zones.forEach((zone, zoneIdx) => {
      const zoneX = ZONE_START_X + zoneIdx * (ZONE_WIDTH + ZONE_GAP);
      const hostsInZone = state.hosts.filter(h => h.zoneId === zone.id);
      const hostCount = hostsInZone.length;
      const zoneHeight = START_Y + ZONE_HEADER_H + hostCount * HOST_Y_SPACING + 20;

      bounds[zone.id] = {
        x: zoneX,
        y: START_Y - 10,
        w: ZONE_WIDTH,
        h: zoneHeight,
      };
    });
    return bounds;
  }, [state.zones, state.hosts]);

  const groupedPositions = getGroupedPositions();
  const zoneBounds = getZoneBounds();

  return (
    <svg ref={svgRef} viewBox="0 0 900 480" style={S.canvas}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onClick={handleCanvasClick}>
      <defs>
        <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>

      {/* Zone Container Backgrounds */}
      {state.zones.map(zone => {
        const bounds = zoneBounds[zone.id];
        if (!bounds) return null;
        return (
          <rect key={zone.id + "_container"}
            x={bounds.x} y={bounds.y}
            width={bounds.w} height={bounds.h}
            rx="12"
            fill={zone.color} fillOpacity="0.07"
            stroke={zone.color} strokeWidth="1.5"
            strokeDasharray="8 4"/>
        );
      })}

      {/* Zone Labels */}
      {state.zones.map(zone => {
        const bounds = zoneBounds[zone.id];
        if (!bounds) return null;
        const isSelected = selectedId === zone.id;
        return (
          <g key={zone.id}>
            <rect x={bounds.x + 10} y={bounds.y + 8} width={bounds.w - 20} height={28} rx="6"
              fill={zone.color} fillOpacity="0.2"/>
            <text x={bounds.x + bounds.w/2} y={bounds.y + 25} textAnchor="middle"
              fontSize="12" fontWeight="600" fill={zone.color} fontFamily="inherit">
              {zone.name}
            </text>
          </g>
        );
      })}

      {/* Attack paths */}
      {state.attackPaths.map((c, i) => {
        const f = getCenter(c.from), t = getCenter(c.to);
        if (!f || !t) return null;
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const ux = dx/len, uy = dy/len;
        const sx = f.x + ux * (HOST_W/2 + 2), sy = f.y + uy * (HOST_H/2 + 2);
        const ex = t.x - ux * (HOST_W/2 + 8), ey = t.y - uy * (HOST_H/2 + 8);
        return <line key={"ap" + i} x1={sx} y1={sy} x2={ex} y2={ey}
          stroke="#E24B4A" strokeWidth="1.5" strokeDasharray="5 3"
          markerEnd="url(#arr-red)" opacity="0.8"/>;
      })}

      {/* Hosts */}
      {state.hosts.map(h => {
        const pos = groupedPositions[h.id];
        if (!pos) return null;
        const isServer = h.type === "server";
        const isActive = connectFrom?.id === h.id;
        const isSelected = selectedId === h.id;
        const zone = state.zones.find(z => z.id === h.zoneId);
        const borderCol = zone?.color || (isServer ? "#BA7517" : "#378ADD");
        const fillCol = zone ? zone.color : (isServer ? "#BA7517" : "#378ADD");
        const sw = isActive ? 2.5 : (isSelected ? 3 : 1);

        return (
          <g key={h.id} style={{ cursor: mode === "select" ? "grab" : "pointer" }}
            onMouseDown={(e) => onMouseDown(e, h.id, "host")}>
            <rect x={pos.x} y={pos.y} width={HOST_W} height={HOST_H} rx={isServer ? 4 : 6}
              fill={fillCol} fillOpacity={isSelected ? "0.25" : "0.12"}
              stroke={isSelected ? "#FFD700" : borderCol}
              strokeWidth={sw}/>
            {isSelected && (
              <rect x={pos.x - 3} y={pos.y - 3} width={HOST_W + 6} height={HOST_H + 6} rx={isServer ? 6 : 8}
                fill="none" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8"/>
            )}
            {isServer && (
              <line x1={pos.x} y1={pos.y + 7} x2={pos.x + HOST_W} y2={pos.y + 7}
                stroke={borderCol} strokeWidth="0.4" opacity="0.5"/>
            )}
            <text x={pos.x + HOST_W/2} y={pos.y + HOST_H/2 + 1} textAnchor="middle" dominantBaseline="central"
              fontSize="11" fontWeight={isSelected ? "600" : "500"} fill="var(--color-text-primary)" fontFamily="inherit">
              {h.name}
            </text>
            <text x={pos.x + HOST_W - 4} y={pos.y + 9} textAnchor="end" fontSize="7" fill={borderCol} fontFamily="inherit" opacity="0.7">
              {isServer ? "srv" : "hst"}
            </text>
          </g>
        );
      })}

      {/* Mode instructions */}
      {mode === "attack" && (
        <text x="450" y="472" textAnchor="middle" fontSize="11" fill="#E24B4A" fontWeight="500" fontFamily="inherit">
          Click source host → then target host to create attack path
        </text>
      )}
    </svg>
  );
}