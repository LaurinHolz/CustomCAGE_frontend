import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {CAGE2_PRESET, makeEmpty} from "./data/cage2Preset";
import {S} from "./styles/styles"
import { HOST_W, HOST_H, ZONE_W, ZONE_H, ZONE_PAD } from "./constants/layout";
import { uid } from "./utils/ids";
import { exportToBackendFormat, downloadJSON } from "./utils/exportBackend";
import TopologyCanvas from "./components/TopologyCanvas";
import AttackGraphCanvas from "./components/AttackGraphCanvas"
import DetailSidebar from "./components/DetailSidebar";
import OverviewPanel from "./components/OverviewPanel";
import ConfigPanel from "./components/ConfigPanel";
import LiveFilePlots from "./components/LiveFilePlots";

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
        {[["topology","Topology"],
        ["attack","Attack graph"],
        ["overview","Overview"],
        ["config","Config"],
        ["live", "Live plots"]
      ].map(([k,v]) => (
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
      <div style={{ display: tab === "live" ? "block" : "none" }}>
        <LiveFilePlots />
      </div>


      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}