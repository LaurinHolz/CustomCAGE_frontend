import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ─── Data Constants ───────────────────────────────────────────────
const CAGE2_EXPLOITS = ["FTP","Haraka","SQL","HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"];
const CAGE2_DECOYS = ["Femitter","Vsftpd","Apache","Haraka","SSHD","SMSS","Tomcat","Svchost"];
const CAGE2_RED_ACTIONS = ["sleep","remote","network","exploit","escalate","impact"];
const CAGE2_BLUE_ACTIONS = ["sleep","analyse","decoy","remove","restore"];
const EXPLOIT_OUTCOMES = {FTP:"root",Haraka:"root",SQL:"root",HTTPSRFI:"user",HTTPRFI:"user",Eternal:"root",Keep:"user",Brute:"user"};

const CAGE2_PRESET = {
  name: "CAGE-2 Original",
  redActions: [...CAGE2_RED_ACTIONS],
  blueActions: [...CAGE2_BLUE_ACTIONS],
  exploits: [...CAGE2_EXPLOITS],
  decoys: [...CAGE2_DECOYS],
  exploitOutcomes: {...EXPLOIT_OUTCOMES},
  zones: [
    { id: "z0", name: "User Subnet", color: "#3B8BD4", x: 60, y: 30 },
    { id: "z1", name: "Enterprise Subnet", color: "#1D9E75", x: 340, y: 30 },
    { id: "z2", name: "Operational Subnet", color: "#D85A30", x: 620, y: 30 },
  ],
  hosts: [
    { id: "h_def",     name: "def",     type: "server", zoneId: "z1", services: ["Brute"], decoys: [],                x: 350, y: 100 },
    { id: "h_ent0",    name: "ent0",    type: "host",   zoneId: "z1", services: ["Brute"], decoys: ["Haraka","Tomcat","Vsftpd","Apache"],               x: 450, y: 100 },
    { id: "h_ent1",    name: "ent1",    type: "host",   zoneId: "z1", services: ["Brute","Eternal","Keep","HTTPRFI","HTTPSRFI"], decoys: ["Femitter"], x: 350, y: 170 },
    { id: "h_ent2",    name: "ent2",    type: "host",   zoneId: "z1", services: ["Brute","Eternal","Keep","HTTPRFI","HTTPSRFI"], decoys: ["Femitter"], x: 450, y: 170 },
    { id: "h_ophost0", name: "ophost0", type: "host",   zoneId: "z2", services: ["Brute"], decoys: [],                x: 630, y: 100 },
    { id: "h_ophost1", name: "ophost1", type: "host",   zoneId: "z2", services: ["Brute"], decoys: [],                x: 730, y: 100 },
    { id: "h_ophost2", name: "ophost2", type: "host",   zoneId: "z2", services: ["Brute"], decoys: [],                x: 630, y: 170 },
    { id: "h_opserv",  name: "opserv",  type: "server", zoneId: "z2", services: ["Brute"], decoys: ["Haraka","Apache","Tomcat","Vsftpd"],               x: 730, y: 170 },
    { id: "h_user0",   name: "user0",   type: "host",   zoneId: "z0", services: [], decoys: [],                       x: 50, y: 100 },
    { id: "h_user1",   name: "user1",   type: "host",   zoneId: "z0", services: ["Brute","FTP"], decoys: ["Apache","Tomcat","SMSS","Svchost"],      x: 150, y: 100 },
    { id: "h_user2",   name: "user2",   type: "host",   zoneId: "z0", services: ["Eternal","Keep"], decoys: ["Femitter","Tomcat","Apache","SSHD"], x: 50, y: 170 },
    { id: "h_user3",   name: "user3",   type: "host",   zoneId: "z0", services: ["Keep","HTTPSRFI","HTTPRFI","Haraka"], decoys: ["Vsftpd","SSHD"],   x: 150, y: 170 },
    { id: "h_user4",   name: "user4",   type: "host",   zoneId: "z0", services: ["Keep","HTTPSRFI","HTTPRFI","Haraka","SQL"], decoys: ["Vsftpd"],   x: 100, y: 240 },
  ],
  zoneConnections: [
    { from: "z0", to: "z1" },
    { from: "z1", to: "z2" },
  ],
  attackPaths: [
    { from: "h_ent0", to: "h_ent2" },
    { from: "h_ent1", to: "h_ent2" },
    { from: "h_ent2", to: "h_opserv" },
    { from: "h_user1", to: "h_ent0" },
    { from: "h_user2", to: "h_ent0" },
    { from: "h_user3", to: "h_ent1" },
    { from: "h_user4", to: "h_ent1" },
  ],
};

function makeEmpty() {
  return {
    name: "Custom",
    redActions: [...CAGE2_RED_ACTIONS],
    blueActions: [...CAGE2_BLUE_ACTIONS],
    exploits: [...CAGE2_EXPLOITS],
    decoys: [...CAGE2_DECOYS],
    exploitOutcomes: {...EXPLOIT_OUTCOMES},
    zones: [],
    hosts: [],
    zoneConnections: [],
    attackPaths: [],
  };
}

// ─── Utility ──────────────────────────────────────────────────────
let _id = 100;
const uid = (prefix) => `${prefix}${_id++}`;

const HOST_W = 80;
const HOST_H = 34;
const ZONE_W = 160;
const ZONE_H = 36;
const ZONE_PAD = 30;

// Helper to get host order matching backend
function getHostOrder(hosts) {
  const order = ['def', 'ent0', 'ent1', 'ent2', 'ophost0', 'ophost1', 'ophost2', 'opserv', 'user0', 'user1', 'user2', 'user3', 'user4'];
  return order.filter(name => hosts.some(h => h.name === name));
}

function exportToBackendFormat(state) {
  // Verwende die tatsächlichen Hosts aus dem State (nicht feste Namen)
  const hostsInOrder = state.hosts;

  console.log('Exporting hosts:', hostsInOrder.map(h => ({ name: h.name, services: h.services, decoys: h.decoys })));

  // Build CONNECTED_HOSTS array (basierend auf Attack Paths)
  const connectedHosts = hostsInOrder.map(host => {
    // Finde einen Attack Path WO dieser Host die Quelle ist
    const attackPath = state.attackPaths.find(p => p.from === host.id);
    if (!attackPath) return null;
    const target = state.hosts.find(h => h.id === attackPath.to);
    return target ? target.name : null;
  });

  // Build HOST_EXPLOITS (Services per host)
  const hostExploits = hostsInOrder.map(h => [...h.services]);

  // Build HOST_DECOYS (Decoys per host)
  const hostDecoys = hostsInOrder.map(h => [...h.decoys]);

  // Build REWARDED_EXPLOITS (basierend auf Host-Namen und Services)
  const rewardedExploits = hostsInOrder.map(host => {
    const rewards = [];

    // Hier können Sie Ihre eigene Logik für Rewards implementieren
    // Für Custom-Netzwerke erstmal leer lassen
    // Basierend auf Host-Namen oder Services
    if (host.name === 'server1' && host.services.includes('Keep')) {
      rewards.push('Keep');
    }
    if (host.name === 'host0' && host.services.includes('Haraka')) {
      rewards.push('Haraka');
    }

    return rewards;
  });

  // Build ATTACK_PATHS als Array von [from_hostname, to_hostname]
  const attackPaths = state.attackPaths.map(c => {
    const f = state.hosts.find(h => h.id === c.from);
    const t = state.hosts.find(h => h.id === c.to);
    return f && t ? [f.name, t.name] : null;
  }).filter(Boolean);

  // Build ZONE_CONNECTIONS
  const zoneConnections = state.zoneConnections.map(c => {
    const fromZone = state.zones.find(z => z.id === c.from);
    const toZone = state.zones.find(z => z.id === c.to);
    return fromZone && toZone ? [fromZone.name, toZone.name] : null;
  }).filter(Boolean);

  const result = {
    RED_ACTIONS: state.redActions,
    BLUE_ACTIONS: state.blueActions,
    NUM_SUBNETS: state.zones.length,
    HOSTS: hostsInOrder.map(h => h.name),
    HOST_EXPLOITS: hostExploits,
    CONNECTED_HOSTS: connectedHosts,
    EXPLOITS: state.exploits,
    DECOYS: state.decoys,
    HOST_DECOYS: hostDecoys,
    EXPLOIT_OUTCOME: state.exploitOutcomes,
    REWARDED_EXPLOITS: rewardedExploits,
    ZONE_CONNECTIONS: zoneConnections,
    ATTACK_PATHS: attackPaths,
  };

  console.log('Final JSON:', JSON.stringify(result, null, 2));
  return result;
}

function downloadJSON(data, filename = "cage2_config.json") {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Styles ───────────────────────────────────────────────────────
const S = {
  app: { fontFamily: '"Source Code Pro", "JetBrains Mono", monospace', background: 'var(--color-background-tertiary)', minHeight: '100vh', padding: 0 },
  header: { background: 'var(--color-background-primary)', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' },
  badge: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--border-radius-md)', background: 'var(--color-background-info)', color: 'var(--color-text-info)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' },
  select: { fontSize: 12, padding: '6px 10px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },
  btn: { fontSize: 11, padding: '6px 14px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 500, transition: 'all .15s', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  btnPrimary: { background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', border: 'none' },
  btnSuccess: { background: '#1D9E75', color: '#fff', border: 'none' },
  btnDanger: { background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', border: '0.5px solid var(--color-border-danger)' },
  btnSmall: { fontSize: 10, padding: '3px 8px' },
  tabs: { display: 'flex', gap: 0, borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', padding: '0 16px' },
  tab: (active) => ({ fontSize: 12, padding: '10px 16px', cursor: 'pointer', border: 'none', background: 'none', color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: active ? 500 : 400, borderBottom: active ? '2px solid var(--color-text-primary)' : '2px solid transparent', transition: 'all .15s', fontFamily: 'inherit' }),
  panel: { padding: 16, background: 'var(--color-background-primary)', margin: 8, borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)' },
  canvas: { width: '100%', height: 480, borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', cursor: 'default', background: 'var(--color-background-secondary)' },
  sidebar: { width: 280, minWidth: 280, padding: 12, background: 'var(--color-background-primary)', borderLeft: '0.5px solid var(--color-border-tertiary)', overflowY: 'auto', maxHeight: 480, fontSize: 12 },
  label: { fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { fontSize: 12, padding: '5px 8px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  chip: (active) => ({ fontSize: 10, padding: '2px 8px', borderRadius: 12, border: '0.5px solid', borderColor: active ? 'var(--color-border-info)' : 'var(--color-border-tertiary)', background: active ? 'var(--color-background-info)' : 'var(--color-background-secondary)', color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 500, transition: 'all .12s', whiteSpace: 'nowrap', userSelect: 'none' }),
  chipDanger: { fontSize: 10, padding: '2px 8px', borderRadius: 12, border: '0.5px solid var(--color-border-danger)', background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', cursor: 'pointer', fontWeight: 500 },
  chipSuccess: (active) => ({ fontSize: 10, padding: '2px 8px', borderRadius: 12, border: '0.5px solid', borderColor: active ? 'var(--color-border-success)' : 'var(--color-border-tertiary)', background: active ? 'var(--color-background-success)' : 'var(--color-background-secondary)', color: active ? 'var(--color-text-success)' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 500, transition: 'all .12s', whiteSpace: 'nowrap', userSelect: 'none' }),
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  section: { marginBottom: 14 },
  divider: { borderTop: '0.5px solid var(--color-border-tertiary)', margin: '12px 0' },
  code: { fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--color-background-secondary)', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', overflowX: 'auto', whiteSpace: 'pre', maxHeight: 400, overflowY: 'auto', color: 'var(--color-text-primary)', border: '0.5px solid var(--color-border-tertiary)', lineHeight: 1.5 },
  toast: { position: 'fixed', bottom: 20, right: 20, padding: '10px 20px', borderRadius: 'var(--border-radius-md)', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', fontSize: 12, fontWeight: 500, zIndex: 999, fontFamily: 'inherit' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', padding: 24, minWidth: 320, maxWidth: 480, border: '0.5px solid var(--color-border-tertiary)' },
};

// ─── Topology Canvas (SVG) ────────────────────────────────────────
function TopologyCanvas({ state, setState, mode, connectFrom, setConnectFrom, onSelect, selectedId, showAttackPaths = false }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wasDragged, setWasDragged] = useState(false);
  const [clickTarget, setClickTarget] = useState(null);

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
  }, [mode, connectFrom, state, setState, setConnectFrom, getSvgPoint]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const pt = getSvgPoint(e);
    const nx = Math.max(10, Math.min(880, pt.x - dragOffset.x));
    const ny = Math.max(10, Math.min(460, pt.y - dragOffset.y));

    const item = dragging.type === "zone"
      ? state.zones.find(z => z.id === dragging.id)
      : state.hosts.find(h => h.id === dragging.id);

    if (item && (Math.abs(item.x - nx) > 2 || Math.abs(item.y - ny) > 2)) {
      setWasDragged(true);
    }

    if (dragging.type === "zone") {
      setState(s => ({ ...s, zones: s.zones.map(z => z.id === dragging.id ? { ...z, x: nx, y: ny } : z) }));
    } else {
      setState(s => ({ ...s, hosts: s.hosts.map(h => h.id === dragging.id ? { ...h, x: nx, y: ny } : h) }));
    }
  }, [dragging, dragOffset, getSvgPoint, setState, state.hosts, state.zones]);

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
        const allX = [z.x, ...hostsInZone.map(h => h.x)];
        const allY = [z.y, ...hostsInZone.map(h => h.y)];
        const allXR = [z.x + ZONE_W, ...hostsInZone.map(h => h.x + HOST_W)];
        const allYB = [z.y + ZONE_H, ...hostsInZone.map(h => h.y + HOST_H)];
        const minx = Math.min(...allX) - ZONE_PAD;
        const miny = Math.min(...allY) - ZONE_PAD;
        const maxx = Math.max(...allXR) + ZONE_PAD;
        const maxy = Math.max(...allYB) + ZONE_PAD;
        bounds[z.id] = { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
      }
    });
    return bounds;
  }, [state.zones, state.hosts]);

  return (
    <svg ref={svgRef} viewBox="0 0 900 480" style={S.canvas}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onClick={handleCanvasClick}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
        <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>

      {/* Zone bounding backgrounds */}
      {state.zones.map(z => {
        const b = zoneBounds[z.id];
        if (!b) return null;
        return (
          <rect key={z.id + "_bg"} x={b.x} y={b.y} width={b.w} height={b.h} rx="14"
            fill={z.color} fillOpacity="0.07" stroke={z.color} strokeWidth="0.5" strokeDasharray="6 3"/>
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
        return (
          <g key={z.id} style={{ cursor: mode === "select" ? "grab" : "pointer" }}
            onMouseDown={(e) => onMouseDown(e, z.id, "zone")}>
            <rect x={z.x} y={z.y} width={ZONE_W} height={ZONE_H} rx="8"
              fill={z.color} fillOpacity={isSelected ? "0.35" : "0.22"}
              stroke={isSelected ? "#FFD700" : z.color}
              strokeWidth={isSelected ? 3 : (connectFrom?.id === z.id ? 2.5 : 0.5)}
              strokeDasharray={isSelected ? "none" : "none"}/>
            {isSelected && (
              <rect x={z.x - 4} y={z.y - 4} width={ZONE_W + 8} height={ZONE_H + 8} rx="10"
                fill="none" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8"/>
            )}
            <text x={z.x + ZONE_W/2} y={z.y + ZONE_H/2 + 1} textAnchor="middle" dominantBaseline="central"
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
        const sw = isActive ? 2.5 : (isSelected ? 3 : 0.5);
        return (
          <g key={h.id} style={{ cursor: mode === "select" ? "grab" : "pointer" }}
            onMouseDown={(e) => onMouseDown(e, h.id, "host")}>
            <rect x={h.x} y={h.y} width={HOST_W} height={HOST_H} rx={isServer ? 4 : 6}
              fill={fillCol} fillOpacity={isSelected ? "0.25" : "0.12"}
              stroke={isSelected ? "#FFD700" : borderCol}
              strokeWidth={sw}/>
            {isSelected && (
              <rect x={h.x - 3} y={h.y - 3} width={HOST_W + 6} height={HOST_H + 6} rx={isServer ? 6 : 8}
                fill="none" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8"/>
            )}
            {isServer && (
              <line x1={h.x} y1={h.y + 7} x2={h.x + HOST_W} y2={h.y + 7}
                stroke={borderCol} strokeWidth="0.4" opacity="0.5"/>
            )}
            <text x={h.x + HOST_W/2} y={h.y + HOST_H/2 + 1} textAnchor="middle" dominantBaseline="central"
              fontSize="11" fontWeight={isSelected ? "600" : "500"} fill="var(--color-text-primary)" fontFamily="inherit">
              {h.name}
            </text>
            <text x={h.x + HOST_W - 4} y={h.y + 9} textAnchor="end" fontSize="7" fill={borderCol} fontFamily="inherit" opacity="0.7">
              {isServer ? "srv" : "hst"}
            </text>
          </g>
        );
      })}

      {/* Mode instructions at bottom */}
      {mode === "connect" && (
        <text x="450" y="472" textAnchor="middle" fontSize="11" fill="var(--color-text-info)" fontWeight="500" fontFamily="inherit">
          Click two entities to connect (zone↔zone or host→zone)
        </text>
      )}
      {mode === "attack" && (
        <text x="450" y="472" textAnchor="middle" fontSize="11" fill="#E24B4A" fontWeight="500" fontFamily="inherit">
          Click source host → then target host to create attack path
        </text>
      )}
    </svg>
  );
}

// ─── Attack Graph Canvas (mit gruppierter Anordnung in Spalten) ──────────────
function AttackGraphCanvas({ state, setState, mode, connectFrom, setConnectFrom, onSelect, selectedId }) {
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

// ─── Detail Sidebar ───────────────────────────────────────────────
function DetailSidebar({ state, setState, selectedItem }) {
  if (!selectedItem) return (
    <div style={S.sidebar}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, margin: 0 }}>Select a host or zone to edit its properties.</p>
    </div>
  );

  if (selectedItem.type === "zone") {
    const zone = state.zones.find(z => z.id === selectedItem.id);
    if (!zone) return null;
    return (
      <div style={S.sidebar}>
        <div style={S.section}>
          <span style={{ ...S.badge, background: zone.color + '22', color: zone.color }}>Zone</span>
        </div>
        <div style={S.section}>
          <label style={S.label}>Name</label>
          <input style={S.input} value={zone.name} onChange={e => setState(s => ({ ...s, zones: s.zones.map(z => z.id === zone.id ? { ...z, name: e.target.value } : z) }))}/>
        </div>
        <div style={S.section}>
          <label style={S.label}>Color</label>
          <input type="color" value={zone.color} onChange={e => setState(s => ({ ...s, zones: s.zones.map(z => z.id === zone.id ? { ...z, color: e.target.value } : z) }))} style={{ width: 40, height: 28, border: 'none', cursor: 'pointer', background: 'none' }}/>
        </div>
        <div style={S.divider}/>
        <label style={S.label}>Hosts in this zone</label>
        <div style={{ ...S.row, marginTop: 4 }}>
          {state.hosts.filter(h => h.zoneId === zone.id).map(h => (
            <span key={h.id} style={S.chip(true)}>{h.name}</span>
          ))}
          {state.hosts.filter(h => h.zoneId === zone.id).length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>None</span>
          )}
        </div>
        <div style={S.divider}/>
        <button style={{ ...S.btn, ...S.btnDanger, width: '100%' }} onClick={() => setState(s => ({
          ...s,
          zones: s.zones.filter(z => z.id !== zone.id),
          hosts: s.hosts.map(h => h.zoneId === zone.id ? { ...h, zoneId: null } : h),
          zoneConnections: s.zoneConnections.filter(c => c.from !== zone.id && c.to !== zone.id),
        }))}>Delete zone</button>
      </div>
    );
  }

  const host = state.hosts.find(h => h.id === selectedItem.id);
  if (!host) return null;

  const toggleArr = (field, item) => {
    setState(s => ({ ...s, hosts: s.hosts.map(h => {
      if (h.id !== host.id) return h;
      const has = h[field].includes(item);
      return { ...h, [field]: has ? h[field].filter(x => x !== item) : [...h[field], item] };
    })}));
  };

  return (
    <div style={S.sidebar}>
      <div style={S.section}>
        <span style={S.badge}>{host.type}</span>
      </div>
      <div style={S.section}>
        <label style={S.label}>Name</label>
        <input style={S.input} value={host.name} onChange={e => setState(s => ({ ...s, hosts: s.hosts.map(h => h.id === host.id ? { ...h, name: e.target.value } : h) }))}/>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Type</label>
          <select style={{ ...S.select, width: '100%' }} value={host.type} onChange={e => setState(s => ({ ...s, hosts: s.hosts.map(h => h.id === host.id ? { ...h, type: e.target.value } : h) }))}>
            <option value="host">Host</option>
            <option value="server">Server</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Zone</label>
          <select style={{ ...S.select, width: '100%' }} value={host.zoneId || ""} onChange={e => setState(s => ({ ...s, hosts: s.hosts.map(h => h.id === host.id ? { ...h, zoneId: e.target.value || null } : h) }))}>
            <option value="">Unassigned</option>
            {state.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div style={S.divider}/>

      {/* Services - farbig mit Toggle */}
      <div style={S.section}>
        <label style={S.label}>Services (exploits)</label>
        <div style={{ ...S.row, marginTop: 4 }}>
          {state.exploits.map(ex => {
            const isActive = host.services.includes(ex);
            return (
              <span
                key={ex}
                style={{
                  ...S.chip(isActive),
                  background: isActive ? '#D85A30' : 'var(--color-background-secondary)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  borderColor: isActive ? '#D85A30' : 'var(--color-border-tertiary)',
                  cursor: 'pointer',
                  transition: 'all .12s'
                }}
                onClick={() => toggleArr("services", ex)}
              >
                {ex}
              </span>
            );
          })}
        </div>
      </div>

      {/* Decoys - farbig mit Toggle */}
      <div style={S.section}>
        <label style={S.label}>Decoys</label>
        <div style={{ ...S.row, marginTop: 4 }}>
          {state.decoys.map(d => {
            const isActive = host.decoys.includes(d);
            return (
              <span
                key={d}
                style={{
                  ...S.chipSuccess(isActive),
                  background: isActive ? '#1D9E75' : 'var(--color-background-secondary)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  borderColor: isActive ? '#1D9E75' : 'var(--color-border-tertiary)',
                  cursor: 'pointer',
                  transition: 'all .12s'
                }}
                onClick={() => toggleArr("decoys", d)}
              >
                {d}
              </span>
            );
          })}
        </div>
      </div>

      <div style={S.divider}/>
      <button style={{ ...S.btn, ...S.btnDanger, width: '100%' }} onClick={() => setState(s => ({
        ...s,
        hosts: s.hosts.filter(h => h.id !== host.id),
        attackPaths: s.attackPaths.filter(p => p.from !== host.id && p.to !== host.id),
      }))}>Delete {host.type}</button>
    </div>
  );
}

// ─── Overview Table ───────────────────────────────────────────────
function OverviewPanel({ state }) {
  return (
    <div style={{ ...S.panel, overflowX: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--color-text-primary)' }}>Network overview</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            {["Host","Type","Zone","Services","Decoys","Attack paths"].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.hosts.map(h => {
            const zone = state.zones.find(z => z.id === h.zoneId);
            const paths = state.attackPaths.filter(p => p.from === h.id).map(p => state.hosts.find(x => x.id === p.to)?.name).filter(Boolean);
            return (
              <tr key={h.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{h.name}</td>
                <td style={{ padding: '6px 8px' }}><span style={{ ...S.badge, fontSize: 9 }}>{h.type}</span></td>
                <td style={{ padding: '6px 8px', color: zone?.color || 'var(--color-text-secondary)' }}>{zone?.name || "—"}</td>
                <td style={{ padding: '6px 8px' }}>{h.services.length > 0 ? h.services.join(", ") : "—"}</td>
                <td style={{ padding: '6px 8px' }}>{h.decoys.length > 0 ? h.decoys.join(", ") : "—"}</td>
                <td style={{ padding: '6px 8px' }}>{paths.length > 0 ? paths.join(", ") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.hosts.length === 0 && (
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 11, textAlign: 'center', margin: '20px 0' }}>No hosts defined yet.</p>
      )}
    </div>
  );
}

// ─── Config Panel (mit Detection & Failure Rates) ───────────────────
function ConfigPanel({ state, setState }) {
  const [newItem, setNewItem] = useState("");
  const [addingTo, setAddingTo] = useState(null);
  const [customDetection, setCustomDetection] = useState("");
  const [customRemoveFail, setCustomRemoveFail] = useState("");
  const [customRestoreFail, setCustomRestoreFail] = useState("");

  // Initialize rates if not present in state
  useEffect(() => {
    if (state.exploitDetectionRate === undefined) {
      setState(s => ({ ...s, exploitDetectionRate: 100 }));
    }
    if (state.removeActionFailRate === undefined) {
      setState(s => ({ ...s, removeActionFailRate: 0 }));
    }
    if (state.restoreActionFailRate === undefined) {
      setState(s => ({ ...s, restoreActionFailRate: 0 }));
    }
  }, [state, setState]);

  const addTo = (field) => {
    if (!newItem.trim()) return;
    setState(s => ({ ...s, [field]: [...s[field], newItem.trim()] }));
    setNewItem("");
    setAddingTo(null);
  };

  const removeFrom = (field, item) => {
    setState(s => ({ ...s, [field]: s[field].filter(x => x !== item) }));
  };

  const renderList = (title, field, color) => (
    <div style={S.section}>
      <label style={S.label}>{title}</label>
      <div style={{ ...S.row, marginTop: 4 }}>
        {state[field].map(item => (
          <span key={item} style={{ ...S.chip(true), borderColor: color, background: color + '18', color }}>
            {item}
            <span style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6 }} onClick={() => removeFrom(field, item)}>&times;</span>
          </span>
        ))}
        {addingTo === field ? (
          <span style={S.row}>
            <input style={{ ...S.input, width: 80 }} value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addTo(field); if (e.key === "Escape") setAddingTo(null); }} autoFocus placeholder="Name..."/>
            <button style={{ ...S.btn, ...S.btnSmall }} onClick={() => addTo(field)}>Add</button>
          </span>
        ) : (
          <span style={{ ...S.chip(false), cursor: 'pointer' }} onClick={() => setAddingTo(field)}>+ Add</span>
        )}
      </div>
    </div>
  );

  const renderRateSelector = (title, field, options, color) => {
    const currentValue = state[field] || (field === 'exploitDetectionRate' ? 100 : 0);
    const [isCustom, setIsCustom] = useState(false);
    const [customValue, setCustomValue] = useState(currentValue.toString());

    const handlePresetClick = (value) => {
      setIsCustom(false);
      setState(s => ({ ...s, [field]: value }));
    };

    const handleCustomClick = () => {
      setIsCustom(true);
      const numValue = parseInt(customValue, 10);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        setState(s => ({ ...s, [field]: numValue }));
      }
    };

    const handleCustomChange = (e) => {
      const val = e.target.value;
      setCustomValue(val);
      const numValue = parseInt(val, 10);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        setState(s => ({ ...s, [field]: numValue }));
      }
    };

    return (
      <div style={S.section}>
        <label style={S.label}>{title}</label>
        <div style={{ ...S.row, marginTop: 4 }}>
          {options.map(opt => (
            <span
              key={opt}
              style={{
                ...S.chip(currentValue === opt && !isCustom),
                background: currentValue === opt && !isCustom ? color : 'var(--color-background-secondary)',
                color: currentValue === opt && !isCustom ? '#fff' : 'var(--color-text-secondary)',
                borderColor: currentValue === opt && !isCustom ? color : 'var(--color-border-tertiary)',
                cursor: 'pointer',
                fontWeight: 500,
                minWidth: 45,
                textAlign: 'center'
              }}
              onClick={() => handlePresetClick(opt)}
            >
              {opt}%
            </span>
          ))}
          <span
            style={{
              ...S.chip(isCustom),
              background: isCustom ? color : 'var(--color-background-secondary)',
              color: isCustom ? '#fff' : 'var(--color-text-secondary)',
              borderColor: isCustom ? color : 'var(--color-border-tertiary)',
              cursor: 'pointer',
              fontWeight: 500
            }}
            onClick={handleCustomClick}
          >
            Custom
          </span>
          {isCustom && (
            <input
              style={{ ...S.input, width: 80 }}
              type="number"
              min="0"
              max="100"
              value={customValue}
              onChange={handleCustomChange}
              onBlur={handleCustomClick}
              placeholder="0-100"
              autoFocus
            />
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          Current: <span style={{ color, fontWeight: 500 }}>{currentValue}%</span>
        </div>
      </div>
    );
  };

  const detectionOptions = [100, 95, 90, 85, 80];
  const failOptions = [0, 5, 10, 15, 20, 25, 30];

  return (
    <div style={S.panel}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--color-text-primary)' }}>
        Environment configuration
      </div>

      {renderList("Red actions", "redActions", "#E24B4A")}
      {renderList("Blue actions", "blueActions", "#3B8BD4")}

      <div style={S.divider}/>

      {renderList("Global exploits", "exploits", "#D85A30")}
      {renderList("Global decoys", "decoys", "#1D9E75")}

      <div style={S.divider}/>

      <div style={S.section}>
        <label style={S.label}>Exploit outcomes</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, marginTop: 4 }}>
          {state.exploits.map(ex => (
            <div key={ex} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, minWidth: 60 }}>{ex}</span>
              <select
                style={{ ...S.select, fontSize: 10, padding: '3px 6px' }}
                value={state.exploitOutcomes[ex] || "user"}
                onChange={e => setState(s => ({
                  ...s,
                  exploitOutcomes: { ...s.exploitOutcomes, [ex]: e.target.value }
                }))}
              >
                <option value="user">user</option>
                <option value="root">root</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={S.divider}/>

      {renderRateSelector(
        "Exploit Detection (Defender) %",
        "exploitDetectionRate",
        detectionOptions,
        "#3B8BD4"
      )}

      {renderRateSelector(
        "Remove Action Fail (Attacker) %",
        "removeActionFailRate",
        failOptions,
        "#E24B4A"
      )}

      {renderRateSelector(
        "Restore Action Fail (Attacker) %",
        "restoreActionFailRate",
        failOptions,
        "#E24B4A"
      )}

      <div style={S.divider}/>

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
        <strong>Note:</strong> Detection rate affects how likely defender actions are to succeed.<br/>
        Fail rates affect attacker's remove and restore actions.
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(JSON.parse(JSON.stringify(CAGE2_PRESET)));
  const [tab, setTab] = useState("topology");
  const [mode, setMode] = useState("select");
  const [connectFrom, setConnectFrom] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [showJSON, setShowJSON] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const loadPreset = (val) => {
    if (val === "cage2") {
      setState(JSON.parse(JSON.stringify(CAGE2_PRESET)));
      showToast("Loaded CAGE-2 preset");
    } else if (val === "empty") {
      setState(makeEmpty());
      showToast("Loaded empty canvas");
    }
    setSelectedItem(null);
    setConnectFrom(null);
    setMode("select");
  };

  const addZone = () => {
    const id = uid("z");
    const colors = ["#3B8BD4","#1D9E75","#D85A30","#7F77DD","#D4537E","#888780"];
    const color = colors[state.zones.length % colors.length];
    setState(s => ({ ...s, zones: [...s.zones, { id, name: `Zone ${s.zones.length}`, color, x: 80 + (s.zones.length % 3) * 280, y: 30 + Math.floor(s.zones.length / 3) * 200 }] }));
    showToast("Zone added");
  };

  const addHost = (type = "host") => {
    const id = uid("h_");
    // Calculate a neutral, central position based on existing unassigned hosts
    const unassignedHosts = state.hosts.filter(h => !h.zoneId);
    const col = unassignedHosts.length % 4; // 4 columns for better spacing
    const row = Math.floor(unassignedHosts.length / 4);

    // Neutral zone position (center-right area, avoiding zone overlaps)
    const startX = 650;
    const startY = 350;

    setState(s => ({
      ...s,
      hosts: [...s.hosts, {
        id,
        name: `${type}${s.hosts.length}`,
        type,
        zoneId: null, // Explicitly unassigned
        services: [],
        decoys: [],
        x: startX + (col * 90), // Spread horizontally
        y: startY + (row * 50), // Spread vertically
      }],
    }));
    showToast(`${type} added (unassigned)`);
  };

  const deleteConnection = (type, idx) => {
    if (type === "zone") setState(s => ({ ...s, zoneConnections: s.zoneConnections.filter((_, i) => i !== idx) }));
    else setState(s => ({ ...s, attackPaths: s.attackPaths.filter((_, i) => i !== idx) }));
  };

  const backendData = useMemo(() => exportToBackendFormat(state), [state]);

  const handleDownload = () => {
    downloadJSON(backendData, "cage2_config.json");
    showToast("JSON downloaded");
  };

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.title}>Custom CAGE-2 environment</span>
          <span style={S.badge}>Builder</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Preset:</label>
          <select style={S.select} onChange={e => loadPreset(e.target.value)} defaultValue="cage2">
            <option value="cage2">CAGE-2 Original</option>
            <option value="empty">Empty (Custom)</option>
          </select>
          <button style={{ ...S.btn, ...S.btnSuccess }} onClick={handleDownload}>Download JSON</button>
        </div>
      </div>

      <div style={S.tabs}>
        {[["topology","Topology"],["attack","Attack graph"],["overview","Overview"],["config","Config"]].map(([k,v]) => (
          <button key={k} style={S.tab(tab === k)} onClick={() => { setTab(k); setMode("select"); setConnectFrom(null); }}>{v}</button>
        ))}
      </div>

      {tab === "topology" && (
        <div style={{ padding: 8 }}>
          <div style={{ ...S.row, marginBottom: 8, flexWrap: 'wrap' }}>
            <button style={{ ...S.btn, ...(mode === "select" ? S.btnPrimary : {}) }} onClick={() => { setMode("select"); setConnectFrom(null); }}>Select / drag</button>
            <button style={{ ...S.btn, ...(mode === "connect" ? { ...S.btnPrimary, background: 'var(--color-text-info)', color: '#fff' } : {}) }} onClick={() => { setMode("connect"); setConnectFrom(null); }}>Connect</button>
            <span style={{ width: 1, height: 20, background: 'var(--color-border-tertiary)' }}/>
            <button style={S.btn} onClick={addZone}>+ Zone</button>
            <button style={S.btn} onClick={() => addHost("host")}>+ Host</button>
            <button style={S.btn} onClick={() => addHost("server")}>+ Server</button>
            <span style={{ flex: 1 }}/>
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
              {state.zones.length} zones · {state.hosts.length} hosts
            </span>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ flex: 1 }}>
              <TopologyCanvas
                state={state}
                setState={setState}
                mode={mode}
                connectFrom={connectFrom}
                setConnectFrom={setConnectFrom}
                onSelect={setSelectedItem}
                showAttackPaths={false}
              />
            </div>
            <DetailSidebar state={state} setState={setState} selectedItem={selectedItem}/>
          </div>
          {state.zoneConnections.length > 0 && (
            <div style={{ ...S.panel, marginTop: 0 }}>
              <label style={S.label}>Zone connections</label>
              <div style={{ ...S.row, marginTop: 6 }}>
                {state.zoneConnections.map((c, i) => {
                  const f = state.zones.find(z => z.id === c.from);
                  const t = state.zones.find(z => z.id === c.to);
                  return (
                    <span key={i} style={{ ...S.chip(true), display: 'flex', alignItems: 'center', gap: 4 }}>
                      {f?.name} → {t?.name}
                      <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => deleteConnection("zone", i)}>&times;</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "attack" && (
        <div style={{ padding: 8 }}>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <button style={{ ...S.btn, ...(mode === "select" ? S.btnPrimary : {}) }} onClick={() => { setMode("select"); setConnectFrom(null); }}>Select / drag</button>
            <button style={{ ...S.btn, ...(mode === "attack" ? { background: '#E24B4A', color: '#fff', border: 'none' } : {}) }} onClick={() => { setMode("attack"); setConnectFrom(null); }}>Add attack path</button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ flex: 1 }}>
              <AttackGraphCanvas
                state={state}
                setState={setState}
                mode={mode}
                connectFrom={connectFrom}
                setConnectFrom={setConnectFrom}
                onSelect={setSelectedItem}
              />
            </div>
            <div style={S.sidebar}>
              <label style={S.label}>Attack paths</label>
              {state.attackPaths.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '8px 0' }}>No attack paths. Use "Add attack path" and click source → target.</p>
              )}
              {state.attackPaths.map((p, i) => {
                const f = state.hosts.find(h => h.id === p.from);
                const t = state.hosts.find(h => h.id === p.to);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <span style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 500 }}>{f?.name}</span>
                      <span style={{ color: '#E24B4A', margin: '0 6px' }}>→</span>
                      <span style={{ fontWeight: 500 }}>{t?.name}</span>
                    </span>
                    <span style={{ ...S.chipDanger, cursor: 'pointer' }} onClick={() => deleteConnection("attack", i)}>&times;</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "overview" && <OverviewPanel state={state}/>}
      {tab === "config" && <ConfigPanel state={state} setState={setState}/>}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}