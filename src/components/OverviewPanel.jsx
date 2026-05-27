// ─── Overview Table ───────────────────────────────────────────────
import { S } from "../styles/styles";

export default function OverviewPanel({ state }) {
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