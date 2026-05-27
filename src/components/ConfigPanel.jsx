// ─── Config Panel (mit Detection & Failure Rates) ───────────────────
import { useState, useEffect } from "react";
import { S } from "../styles/styles";

export default function ConfigPanel({ state, setState }) {
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