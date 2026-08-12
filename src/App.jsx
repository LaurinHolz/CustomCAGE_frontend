import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {CAGE2_PRESET, makeEmpty} from "./data/cage2Preset";
import { CAGE2_HALVED_PRESET } from "./data/cage2_05_preset.js";
import { CAGE2_075_PRESET} from "./data/cage2_075_preset.js";
import { CAGE2_125_PRESET} from "./data/cage2_125_preset.js";
import { CAGE2_ADD_USER_PRESET} from "./data/cage2_add_user_preset.js";
import {CAGE2_ADD_SERVER_PRESET} from "./data/cage2_add_server_preset.js";
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
import WatchdogAveragesTable from "./components/WatchdogAveragesTable";
import VerificationTree from "./components/VerificationTree";
import VerificationProperties from "./components/VerificationProperties";
import VerificationStatistics from "./components/VerificationStatistic";
import VerificationResults from "./components/VerificationResults";
import SimFVGap from "./components/SimFVGap";
import EvaluateModal from "./components/EvaluateModal";
import VerifyModal from "./components/VerificationConfig";
import TrainModal from "./components/TrainModal";
import ResumeModal from "./components/ResumeModal";
import RedVerifyModal from "./components/RedVerifyModal";
import TrainingJobsInfo from "./components/TrainingJobsInfo";
import { fetchGpuInfo } from "./components/CurriculumEditor";
import ToggleSwitch from "./components/ToggleSwitch";
import BlueActionDistributionChart from "./components/BlueActionDistribution";

const VERIFICATION_OPTIONS = [
  { key: "bfs", label: "BFS" },
  { key: "properties", label: "Properties" },
  { key: "results", label: "Results" },
  { key: "statistics", label: "Statistics"},
  { key: "sim-fv-gap", label: "Sim-FV Gap" },
];

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(JSON.parse(JSON.stringify(CAGE2_PRESET)));
  const [tab, setTab] = useState("topology");
  const [mode, setMode] = useState("select");
  const [connectFrom, setConnectFrom] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [showJSON, setShowJSON] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [isTraining, setIsTraining]         = useState(false);
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false);
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  // Snapshot of what's being trained (curriculum + free GPUs + total episodes),
  // captured at Train-click; drives the ⓘ jobs/progress panel in the header.
  const [trainCtx, setTrainCtx] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("aegis-theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aegis-theme", theme);
  }, [theme]);
  const [visualizerOn, setVisualizerOn] = useState(false);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [redVerifyModalOpen, setRedVerifyModalOpen] = useState(false);
  const [evalState, setEvalState] = useState("idle"); // "idle" | "running" | "done"
  const [verifySignal, setVerifySignal] = useState(0);
  const [verificationView, setVerificationView] = useState("bfs");
  const [verifMenuOpen, setVerifMenuOpen] = useState(false);
  const verifMenuRef = useRef(null);

  useEffect(() => {
    if (!verifMenuOpen) return;
    const onDocClick = (e) => {
      if (verifMenuRef.current && !verifMenuRef.current.contains(e.target)) {
        setVerifMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [verifMenuOpen]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const loadPreset = (val) => {
  if (val === "cage2") {
    setState(JSON.parse(JSON.stringify(CAGE2_PRESET)));
    showToast("Loaded CAGE-2 preset");
  } else if (val === "cage2_halved") {
    setState(JSON.parse(JSON.stringify(CAGE2_HALVED_PRESET)));
    showToast("Loaded 0.5x CAGE-2 preset");
  } else if (val === "cage2_075") {
    setState(JSON.parse(JSON.stringify(CAGE2_075_PRESET)));
    showToast("Loaded 0.75x CAGE-2 preset");
  } else if (val === "cage2_125") {
    setState(JSON.parse(JSON.stringify(CAGE2_125_PRESET)));
    showToast("Loaded 1.25x CAGE-2 preset")
  } else if (val === "cage2_add_user") {
    setState(JSON.parse(JSON.stringify(CAGE2_ADD_USER_PRESET)));
    showToast("Loaded CAGE-2 + User")
  } else if (val === "cage2_add_server") {
    setState(JSON.parse(JSON.stringify(CAGE2_ADD_SERVER_PRESET)))
    showToast("Loaded CAGE-2 + Server")
  } else if (val === "empty") {
    setState(makeEmpty());
    showToast("Loaded empty canvas");
  }
    setSelectedItem(null);
    setConnectFrom(null);
    setMode("select");
  };

  const addZone = () => {
    const id = uid("zone");
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
        zoneId: null,
        services: [],
        decoys: [],
        connectedHosts: [],
        priority: 1,
        rewardedExploits: [],
        x: startX + (col * 90),
        y: startY + (row * 50),
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

  const runTrain = async ({ curriculum, ckptDir, maxEpisodes, maxTimesteps, makeVideo, resumeDir }) => {
    try {
      const res = await fetch("http://127.0.0.1:9999/train-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: backendData,
          curriculum,
          ckptDir,
          maxEpisodes,
          maxTimesteps,
          resumeDir,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setIsTraining(true);
      setScreenshotsEnabled(!!makeVideo);
      setTrainModalOpen(false);
      setResumeModalOpen(false);
      // Snapshot the free GPUs the backend will schedule against, so the ⓘ panel
      // previews the same job→GPU distribution the run actually uses.
      const gi = await fetchGpuInfo();
      setTrainCtx({ curriculum, maxEpisodes, gpuFree: gi.free || [] });
      showToast(resumeDir ? "Resumed training ✓" : "Training started ✓");
    } catch (err) {
      showToast(`Failed: ${err.message}`);
    }
  };

  const runResume = (args) => runTrain({ ...args, makeVideo: false });

  const handleStopTraining = async () => {
    try {
      await fetch("http://127.0.0.1:9999/stop", { method: "POST" });
      setIsTraining(false);
      showToast("Training stopped — creating video…");
    } catch (err) {
      showToast(`Failed: ${err.message}`);
    }
  };

  const handleEvaluate = () => setEvalModalOpen(true);

  const handleVerify = () => setVerifyModalOpen(true);

  const runEvaluate = async ({ ckptPath, numEpisodes, maxTimesteps, redAgent, actionMasking }) => {
    try {
      const params = new URLSearchParams();
      if (ckptPath) params.set("ckpt_path", ckptPath);
      params.set("num_episodes", String(numEpisodes));
      params.set("max_timesteps", String(maxTimesteps));
      if (redAgent) params.set("red_agent", JSON.stringify(redAgent));
      // Unset (null/undefined) means "match how the checkpoint was trained" — see evaluate_agent.
      if (actionMasking !== null && actionMasking !== undefined) {
        params.set("action_masking", String(actionMasking));
      }

      const res = await fetch(`http://127.0.0.1:9999/evaluate?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendData),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEvalModalOpen(false);
      setEvalState("running");
      showToast("Evaluation started ✓");
    } catch (err) {
      showToast(`Failed: ${err.message}`);
    }
  };

  const runVerify = async ({ ckptPath, topK, partialObservability, fvApproach }) => {
  try {
    const params = new URLSearchParams();
    if (ckptPath) params.set("ckpt_path", ckptPath);
    params.set("top_k", String(topK));
    params.set("partial_observability", String(partialObservability));
    params.set("fv_approach", fvApproach);

    const res = await fetch(`http://127.0.0.1:9999/verify?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setVerifyModalOpen(false);
    setVerifySignal((n) => n + 1);
    setTab("verification");
    setVerificationView("bfs");   // BFS-Tree zeigen, damit der Fortschritt sichtbar ist
    showToast("Verification started ✓");
  } catch (err) {
    showToast(`Failed: ${err.message}`);
  }
};

  const handleToggleVisualizer = async () => {
    const enabled = !visualizerOn;
    try {
      const res = await fetch("http://127.0.0.1:9999/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setVisualizerOn(enabled);
      showToast(enabled ? "Visualizer opened" : "Visualizer closed");
    } catch (err) {
      showToast(`Failed: ${err.message}`);
    }
  };

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.title}>AEGIS</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 500,
            color: sseConnected ? '#1D9E75' : '#E24B4A',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: sseConnected ? '#1D9E75' : '#E24B4A',
            }}/>
            {sseConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Preset:</label>
          <select style={S.select} onChange={e => loadPreset(e.target.value)} defaultValue="cage2">
            <option value="cage2">CAGE-2 Original</option>
            <option value="cage2_halved">0.5x CAGE-2</option>
            <option value="cage2_075">0.75x CAGE-2</option>
            <option value="cage2_125">1.25x CAGE-2</option>
            <option value="cage2_add_user">Cage-2 + User</option>
            <option value="cage2_add_server">CAGE-2 + Server</option>
            <option value="empty">Empty (Custom)</option>
          </select>
          <button style={{ ...S.btn, ...S.btnSuccess }} onClick={handleDownload}>Download JSON</button>
          <button
            style={{ ...S.btn, ...(isTraining ? { background: '#E24B4A', color: '#fff', border: 'none' } : S.btnSuccess) }}
            onClick={isTraining ? handleStopTraining : () => setTrainModalOpen(true)}
          >{isTraining ? "Stop" : "Train"}</button>
          <button
            style={S.btn}
            disabled={isTraining}
            title={isTraining ? "Stop the current run first" : "Continue an interrupted curriculum run"}
            onClick={() => setResumeModalOpen(true)}
          >Resume</button>
          <button style={{ ...S.btn, ...S.btnSuccess }} onClick={handleEvaluate}>Evaluate</button>
          <button style={{ ...S.btn, ...S.btnSuccess }} onClick={handleVerify}>Verify</button>
          <button
            style={S.btn}
            title="Verify a trained blue policy against a trained red policy (RedVerification pipeline)"
            onClick={() => setRedVerifyModalOpen(true)}
          >Red-verify</button>
          <ToggleSwitch
            checked={visualizerOn}
            onToggle={handleToggleVisualizer}
            label="Visualizer"
          />
          <button
            style={{ ...S.btn, fontSize: 15, padding: '4px 10px', lineHeight: 1 }}
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <TrainingJobsInfo ctx={trainCtx} />
        </div>
      </div>

      <div style={S.tabs}>
        {[["topology","Topology"],
        ["attack","Attack graph"],
        ["overview","Overview"],
        ["config","Config"],
        ["live", "Live plots"],
        ["evaluation", "Evaluation"],
      ].map(([k,v]) => (
          <button key={k} style={S.tab(tab === k)} onClick={() => { setTab(k); setMode("select"); setConnectFrom(null); }}>{v}</button>
        ))}
        <div ref={verifMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            style={{ ...S.tab(tab === "verification"), display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setVerifMenuOpen(o => !o)}
          >
            Verification
            <span style={{
              display: 'inline-block', fontSize: 9, lineHeight: 1,
              transform: verifMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .15s',
            }}>▾</span>
          </button>

          {verifMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 160,
              background: '#1c1c22',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
              padding: 6, zIndex: 20,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {VERIFICATION_OPTIONS.map(opt => {
                const active = tab === "verification" && verificationView === opt.key;
                return (
                  <button
                    key={opt.key}
                    style={{
                      fontSize: 12, padding: '9px 12px', textAlign: 'left',
                      border: 'none', borderRadius: 8,
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontWeight: active ? 600 : 400,
                      background: active ? 'rgba(29,158,117,0.22)' : 'transparent',
                      color: active ? '#3FE0A8' : '#f5f5f5',
                      transition: 'background .12s, color .12s',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => {
                      setTab("verification");
                      setVerificationView(opt.key);
                      setVerifMenuOpen(false);
                      setMode("select");
                      setConnectFrom(null);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
      <div style={tab === "live"
        ? {}
        : { position: "fixed", top: -99999, left: 0, width: "100vw", visibility: "hidden" }
      }>
        <LiveFilePlots
          setConnected={setSseConnected}
          onTrainingDone={() => setIsTraining(false)}
          onEvaluationDone={() => setEvalState("done")}
          screenshotsEnabled={screenshotsEnabled}
        />
      </div>
      {tab === "evaluation" && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <WatchdogAveragesTable evalState={evalState} />
            <BlueActionDistributionChart evalState={evalState} />
          </div>
      )}
      <div style={{ display: tab === "verification" ? "block" : "none" }}>
        <div style={{ display: verificationView === "bfs" ? "block" : "none" }}>
          <VerificationTree startSignal={verifySignal} />
        </div>
        <div style={{ display: verificationView === "properties" ? "block" : "none" }}>
          <VerificationProperties />
        </div>
        <div style={{ display: verificationView === "results" ? "block" : "none" }}>
          <VerificationResults />
        </div>
        <div style={{ display: verificationView === "statistics" ? "block" : "none" }}>
          <VerificationStatistics />
        </div>
        <div style={{ display: verificationView === "sim-fv-gap" ? "block" : "none" }}>
        <SimFVGap />
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
      {trainModalOpen && (
        <TrainModal
          onClose={() => setTrainModalOpen(false)}
          onRun={runTrain}
          hostCount={state.hosts?.length || 0}
        />
      )}
      {resumeModalOpen && (
        <ResumeModal
          onClose={() => setResumeModalOpen(false)}
          onResume={runResume}
        />
      )}
      {redVerifyModalOpen && (
        <RedVerifyModal onClose={() => setRedVerifyModalOpen(false)} />
      )}
      {evalModalOpen && (
        <EvaluateModal
          onClose={() => setEvalModalOpen(false)}
          onRun={runEvaluate}
        />
      )}

      {verifyModalOpen && (
        <VerifyModal
          onClose={() => setVerifyModalOpen(false)}
          onVerify={runVerify}
        />
      )}
    </div>
  );
}