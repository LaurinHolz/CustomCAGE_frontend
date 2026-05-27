// ─── Detail Sidebar ───────────────────────────────────────────────
import { S } from "../styles/styles";

export default function DetailSidebar({ state, setState, selectedItem }) {
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