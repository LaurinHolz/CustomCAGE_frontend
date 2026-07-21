import { S } from "../styles/styles";

const PROB_PRESETS = [0.5, 0.75, 0.9, 0.95, 1.0];

export default function ConfigPanel({ state, setState }) {

  // ── Helpers ────────────────────────────────────────────────────────

  const addTo = (field, item) => {
    if (!item.trim()) return;
    setState(s => ({ ...s, [field]: [...s[field], item.trim()] }));
  };

  const removeFrom = (field, item) => {
    setState(s => ({ ...s, [field]: s[field].filter(x => x !== item) }));
  };

  // ── Renderers ──────────────────────────────────────────────────────

  const renderList = (title, field, color) => {
    let inputRef = null;
    return (
      <div style={S.section}>
        <label style={S.label}>{title}</label>
        <div style={{ ...S.row, marginTop: 4 }}>
          {(state[field] || []).map(item => (
            <span key={item} style={{ ...S.chip(true), borderColor: color, background: color + '18', color }}>
              {item}
              <span style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6 }} onClick={() => removeFrom(field, item)}>&times;</span>
            </span>
          ))}
          <input
            style={{ ...S.input, width: 90 }}
            placeholder="+ Add..."
            onKeyDown={e => { if (e.key === "Enter") { addTo(field, e.target.value); e.target.value = ""; } }}
          />
        </div>
      </div>
    );
  };

  const renderProbSelector = (title, field, color, description) => {
    const value = state[field] ?? 1.0;
    return (
      <div style={S.section}>
        <label style={S.label}>{title}</label>
        {description && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{description}</div>}
        <div style={{ ...S.row, marginTop: 4 }}>
          {PROB_PRESETS.map(opt => (
            <span key={opt}
              style={{
                ...S.chip(value === opt),
                background: value === opt ? color : 'var(--color-background-secondary)',
                color: value === opt ? '#fff' : 'var(--color-text-secondary)',
                borderColor: value === opt ? color : 'var(--color-border-tertiary)',
                cursor: 'pointer', fontWeight: 500, minWidth: 40, textAlign: 'center'
              }}
              onClick={() => setState(s => ({ ...s, [field]: opt }))}>
              {opt}
            </span>
          ))}
          <input
            type="number" min="0" max="1" step="0.05"
            style={{ ...S.input, width: 65 }}
            value={value}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0 && v <= 1) setState(s => ({ ...s, [field]: v }));
            }}
          />
        </div>
      </div>
    );
  };

  const renderToggle = (title, field, color, description, defaultValue = false) => {
    const value = state[field] ?? defaultValue;
    return (
      <div style={S.section}>
        <label style={S.label}>{title}</label>
        {description && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{description}</div>}
        <div style={{ ...S.row, marginTop: 4 }}>
          {[true, false].map(opt => (
            <span key={String(opt)}
              style={{
                ...S.chip(value === opt),
                background: value === opt ? color : 'var(--color-background-secondary)',
                color: value === opt ? '#fff' : 'var(--color-text-secondary)',
                borderColor: value === opt ? color : 'var(--color-border-tertiary)',
                cursor: 'pointer', fontWeight: 500, minWidth: 40, textAlign: 'center'
              }}
              onClick={() => setState(s => ({ ...s, [field]: opt }))}>
              {opt ? 'on' : 'off'}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderLockout = (title, field) => {
    const lockout = state[field] || { red: {}, blue: {} };
    return (
      <div style={S.section}>
        <label style={S.label}>{title}</label>
        {['red', 'blue'].map(agent => (
          <div key={agent} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: agent === 'red' ? '#E24B4A' : '#3B8BD4', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {agent} agent
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(lockout[agent] || {}).map(([action, turns]) => (
                <div key={action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{action}</span>
                  <input type="number" min="0" max="99"
                    style={{ ...S.input, width: 44, textAlign: 'center', padding: '2px 4px', fontSize: 11 }}
                    value={turns}
                    onChange={e => setState(s => ({
                      ...s,
                      [field]: {
                        ...s[field],
                        [agent]: { ...s[field][agent], [action]: parseInt(e.target.value) || 0 }
                      }
                    }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHostSelect = (title, field) => {
    const hostId = state[field];
    const hostName = state.hosts.find(h => h.id === hostId)?.name || "None";
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, minWidth: 120, color: 'var(--color-text-secondary)' }}>{title}</span>
        <select
          style={{ ...S.select, flex: 1 }}
          value={hostId || ""}
          onChange={e => setState(s => ({ ...s, [field]: e.target.value || null }))}>
          <option value="">None</option>
          {state.hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
    );
  };

  const renderHostGroup = (title, field, color) => {
    const group = state[field] || [];
    return (
      <div style={S.section}>
        <label style={S.label}>{title}</label>
        <div style={{ ...S.row, marginTop: 4, flexWrap: 'wrap' }}>
          {state.hosts.map(h => {
            const isActive = group.includes(h.id);
            return (
              <span key={h.id}
                style={{
                  ...S.chip(isActive),
                  background: isActive ? color : 'var(--color-background-secondary)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  borderColor: isActive ? color : 'var(--color-border-tertiary)',
                  cursor: 'pointer'
                }}
                onClick={() => setState(s => ({
                  ...s,
                  [field]: isActive
                    ? (s[field] || []).filter(x => x !== h.id)
                    : [...(s[field] || []), h.id]
                }))}>
                {h.name}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div style={{ ...S.panel, maxWidth: 900, overflowY: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--color-text-primary)' }}>
        Environment configuration
      </div>

      {/* ── Actions ── */}
      {renderList("Red actions", "redActions", "#E24B4A")}
      {renderList("Blue actions", "blueActions", "#3B8BD4")}

      <div style={S.divider}/>

      {/* ── Services ── */}
      {renderList("Global exploits", "exploits", "#D85A30")}
      {renderList("Global decoys", "decoys", "#1D9E75")}

      <div style={S.divider}/>

      {/* ── Exploit outcomes ── */}
      <div style={S.section}>
        <label style={S.label}>Exploit outcomes</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, marginTop: 4 }}>
          {(state.exploits || []).map(ex => (
            <div key={ex} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, minWidth: 64 }}>{ex}</span>
              <select
                style={{ ...S.select, fontSize: 10, padding: '3px 6px' }}
                value={state.exploitOutcomes?.[ex] || "user"}
                onChange={e => setState(s => ({
                  ...s,
                  exploitOutcomes: { ...s.exploitOutcomes, [ex]: e.target.value }
                }))}>
                <option value="user">user</option>
                <option value="root">root</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={S.divider}/>

      {/* ── Exploit → Decoy map ── */}
      <div style={S.section}>
        <label style={S.label}>Exploit → Decoy map</label>
        <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
          {(state.exploits || []).map(exploit => {
            const mapped = state.exploitDecoyMap?.[exploit] || [];
            return (
              <div key={exploit} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 500, minWidth: 72, color: '#D85A30' }}>{exploit}</span>
                <div style={{ ...S.row, flexWrap: 'wrap' }}>
                  {(state.decoys || []).map(d => {
                    const active = mapped.includes(d);
                    return (
                      <span key={d}
                        style={{
                          ...S.chip(active),
                          background: active ? '#1D9E75' : 'var(--color-background-secondary)',
                          color: active ? '#fff' : 'var(--color-text-secondary)',
                          borderColor: active ? '#1D9E75' : 'var(--color-border-tertiary)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setState(s => ({
                          ...s,
                          exploitDecoyMap: {
                            ...s.exploitDecoyMap,
                            [exploit]: active
                              ? (s.exploitDecoyMap?.[exploit] || []).filter(x => x !== d)
                              : [...(s.exploitDecoyMap?.[exploit] || []), d]
                          }
                        }))}>
                        {d}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.divider}/>

      {/* ── Numeric params ── */}
      {renderProbSelector("Exploit priority (exploitPrio)", "exploitPrio", "#D85A30", "Probability that red chooses to exploit over other actions")}
      {renderToggle("Restore resets decoys (restoreResetsDecoys)", "restoreResetsDecoys", "#1D9E75",
        "Whether a successful restore rolls the host back to its baseline image, removing all decoys placed on it")}
      {renderProbSelector("Exploit observability (exploitObs)", "exploitObs", "#3B8BD4", "Probability that blue observes a red exploit action")}
      {renderProbSelector("Remove success rate (removeSuccess)", "removeSuccess", "#1D9E75", "Probability that blue's remove action succeeds")}
      {renderProbSelector("Restore success rate (restoreSuccess)", "restoreSuccess", "#1D9E75", "Probability that blue's restore action succeeds")}

      <div style={S.divider}/>

      {/* ── Lockouts ── */}
      {renderLockout("Agent lockout (turns per action)", "agentLockout")}
      {renderLockout("Host lockout (turns per action)", "hostLockout")}

      <div style={S.divider}/>

      {/* ── Scenario roles ── */}
      <div style={S.section}>
        <label style={S.label}>Scenario roles</label>
        <div style={{ marginTop: 8 }}>
          {renderHostSelect("Target", "target")}
          {renderHostSelect("Entry point", "entryPoint")}
          {renderHostSelect("Target gateway", "targetGateway")}
          {renderHostSelect("Red start host", "redStartHost")}
        </div>
      </div>

      <div style={S.divider}/>

      {/* ── Host groups ── */}
      {renderHostGroup("Defender hosts", "defenderHosts", "#3B8BD4")}
      {renderHostGroup("Users", "users", "#7F77DD")}
      {renderHostGroup("Green hosts", "greenHosts", "#1D9E75")}
    </div>
  );
}
