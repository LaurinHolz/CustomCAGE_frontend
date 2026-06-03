/**
 * Derives canonical backend names (hostX / serverX) by traversing zones in
 * attack-path order starting from the red agent's foothold zone.
 *
 * Ordering rules:
 *   1. Zones are visited BFS-order from the red start zone via inter-zone attack paths.
 *   2. Within each zone: type="host" entries are numbered first, type="server" after,
 *      both continuing the same global counters across zones.
 *   3. The target host is always placed last → becomes serverN (highest server index).
 *
 * The host.type field ("host" | "server") acts as the translation definition:
 * set it in the Detail sidebar to control which output prefix each host receives.
 */

function zoneTraversalOrder(state) {
  const redStart = state.hosts.find(h => h.id === state.redStartHost);
  if (!redStart?.zoneId) return state.zones.map(z => z.id);

  // Build zone-level adjacency from inter-zone attack paths
  const adj = new Map();
  state.attackPaths.forEach(({ from, to }) => {
    const fh = state.hosts.find(h => h.id === from);
    const th = state.hosts.find(h => h.id === to);
    if (!fh || !th || fh.zoneId === th.zoneId) return;
    if (!adj.has(fh.zoneId)) adj.set(fh.zoneId, []);
    if (!adj.get(fh.zoneId).includes(th.zoneId)) adj.get(fh.zoneId).push(th.zoneId);
  });

  // BFS from red start zone
  const order = [];
  const seen  = new Set([redStart.zoneId]);
  const queue = [redStart.zoneId];
  while (queue.length) {
    const z = queue.shift();
    order.push(z);
    for (const nz of (adj.get(z) || [])) {
      if (!seen.has(nz)) { seen.add(nz); queue.push(nz); }
    }
  }

  // Append zones not reachable via attack paths (disconnected)
  state.zones.forEach(z => { if (!seen.has(z.id)) order.push(z.id); });
  return order;
}

export function buildNameTranslation(state) {
  const targetId   = state.target;
  const targetHost = state.hosts.find(h => h.id === targetId);

  const zoneOrder    = zoneTraversalOrder(state);
  const hostNames    = {};
  const hostsOrdered = [];
  let hostIdx   = 0;
  let serverIdx = 0;

  for (const zoneId of zoneOrder) {
    const inZone  = state.hosts.filter(h => h.zoneId === zoneId);
    // hosts (type="host") first, then servers — target excluded here, appended last
    const hosts   = inZone.filter(h => h.type === "host"   && h.id !== targetId);
    const servers = inZone.filter(h => h.type === "server" && h.id !== targetId);
    hosts.forEach(h   => { hostNames[h.name] = `host${hostIdx++}`;     hostsOrdered.push(h); });
    servers.forEach(h => { hostNames[h.name] = `server${serverIdx++}`; hostsOrdered.push(h); });
  }

  // Target is always the final entry → serverN
  if (targetHost) {
    hostNames[targetHost.name] = `server${serverIdx}`;
    hostsOrdered.push(targetHost);
  }

  // Hosts with no zone assignment pass through unchanged
  const seen = new Set(hostsOrdered.map(h => h.id));
  state.hosts.filter(h => !seen.has(h.id)).forEach(h => hostsOrdered.push(h));

  return { hostNames, zoneIds: {}, hostsOrdered };
}
