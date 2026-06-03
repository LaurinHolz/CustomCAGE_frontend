// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchRule(name, rules) {
  return rules
    .filter(r => name === r.prefix || (name.startsWith(r.prefix) && /^\d+$/.test(name.slice(r.prefix.length))))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}

/** BFS zone order starting from startZoneId, using inter-zone attack path adjacency. */
function zoneTraversalOrder(hosts, attackPaths, zones, startZoneId) {
  const adj = new Map();
  attackPaths.forEach(({ from, to }) => {
    const fh = hosts.find(h => h.id === from);
    const th = hosts.find(h => h.id === to);
    if (!fh || !th || fh.zoneId === th.zoneId) return;
    if (!adj.has(fh.zoneId)) adj.set(fh.zoneId, []);
    if (!adj.get(fh.zoneId).includes(th.zoneId)) adj.get(fh.zoneId).push(th.zoneId);
  });
  const order = [], seen = new Set([startZoneId]), queue = [startZoneId];
  while (queue.length) {
    const z = queue.shift(); order.push(z);
    for (const nz of (adj.get(z) || [])) { if (!seen.has(nz)) { seen.add(nz); queue.push(nz); } }
  }
  zones.forEach(z => { if (!seen.has(z.id)) order.push(z.id); });
  return order;
}

// ─── Main builder ──────────────────────────────────────────────────────────────

/**
 * Builds a complete frontend state from:
 *   entities       – array of { name, services?, decoys?, priority? } (or plain strings)
 *   connectedHosts – parallel array; each entry is null or [targetName, …]
 *   redStart       – display name of the red agent's starting host
 *   target         – display name of the target host
 *   rules          – translation rules: [{ prefix, zoneName, zoneColor, outputType }]
 *   positions      – optional { [name]: { x, y } } for explicit host placement
 *
 * Everything is inferred automatically:
 *   zones           – created from unique zone names in rules; IDs remapped to
 *                     traversal order (red start zone → zone0, next → zone1, …)
 *   attackPaths     – derived from connectedHosts
 *   zoneConnections – derived from inter-zone attack paths
 *   users           – all hosts in the red start zone
 *   entryPoint      – first intermediate-zone host reachable from the red start zone
 *   targetGateway   – host with a direct attack path to the target
 *   defenderHosts   – server-type intermediate-zone hosts with no outgoing attack paths
 *   greenHosts      – user zone + intermediate zone, excluding defenders
 */
export function buildStateFromFlat({
  entities,
  connectedHosts,
  redStart,
  target,
  rules,
  positions = {},
}) {
  // ── 1. Create zones in rule order ────────────────────────────────────────
  const zoneMap = new Map();
  rules.forEach(r => {
    if (!zoneMap.has(r.zoneName)) {
      const idx = zoneMap.size;
      zoneMap.set(r.zoneName, { id: `zone${idx}`, name: r.zoneName, color: r.zoneColor, x: 60 + idx * 280, y: 30 });
    }
  });
  const zones = [...zoneMap.values()];

  // ── 2. Create hosts (zone + type inferred from rules) ─────────────────────
  const zoneCounter = new Map(zones.map(z => [z.id, 0]));
  const hosts = entities.map(e => {
    const name  = typeof e === "string" ? e : e.name;
    const props = typeof e === "string" ? {} : e;
    const rule  = matchRule(name, rules);
    const zone  = rule ? zoneMap.get(rule.zoneName) : null;
    const type  = rule?.outputType ?? "host";

    let x, y;
    if (positions[name]) {
      ({ x, y } = positions[name]);
    } else if (zone) {
      const cnt = zoneCounter.get(zone.id) ?? 0;
      zoneCounter.set(zone.id, cnt + 1);
      x = zone.x + 10 + (cnt % 2) * 90;
      y = zone.y + 60 + Math.floor(cnt / 2) * 70;
    } else {
      x = 650; y = 350;
    }

    return { id: `h_${name}`, name, type, zoneId: zone?.id ?? null, services: props.services ?? [], decoys: props.decoys ?? [], connectedHosts: [], priority: props.priority ?? 1, rewardedExploits: [], x, y };
  });

  // ── 3. Build attack paths from connectedHosts ─────────────────────────────
  const attackPaths = [];
  entities.forEach((e, i) => {
    const targets = connectedHosts[i];
    if (!targets?.length) return;
    const name = typeof e === "string" ? e : e.name;
    const fh   = hosts.find(h => h.name === name);
    if (!fh) return;
    targets.forEach(tName => {
      const th = hosts.find(h => h.name === tName);
      if (th) attackPaths.push({ from: fh.id, to: th.id });
    });
  });

  // ── 4. Zone connections from inter-zone attack paths ──────────────────────
  const seenConn = new Set();
  const zoneConnections = [];
  attackPaths.forEach(({ from, to }) => {
    const fh = hosts.find(h => h.id === from);
    const th = hosts.find(h => h.id === to);
    if (!fh || !th || fh.zoneId === th.zoneId) return;
    const key = `${fh.zoneId}->${th.zoneId}`;
    if (!seenConn.has(key)) { seenConn.add(key); zoneConnections.push({ from: fh.zoneId, to: th.zoneId }); }
  });

  // ── 5. Remap zone IDs to traversal order (red start → zone0, …) ──────────
  const redZoneIdTmp = hosts.find(h => h.name === redStart)?.zoneId;
  if (redZoneIdTmp) {
    const traversal = zoneTraversalOrder(hosts, attackPaths, zones, redZoneIdTmp);
    const idRemap   = new Map(traversal.map((oldId, i) => [oldId, `zone${i}`]));
    zones.forEach(z           => { z.id     = idRemap.get(z.id)     ?? z.id; });
    hosts.forEach(h           => { h.zoneId = h.zoneId ? (idRemap.get(h.zoneId) ?? h.zoneId) : null; });
    zoneConnections.forEach(c => { c.from   = idRemap.get(c.from)   ?? c.from; c.to = idRemap.get(c.to) ?? c.to; });
  }

  // ── 6. Infer scenario roles ───────────────────────────────────────────────
  const redStartHost = hosts.find(h => h.name === redStart);
  const targetHost   = hosts.find(h => h.name === target);
  const redZoneId    = redStartHost?.zoneId ?? null;
  const targetZoneId = targetHost?.zoneId   ?? null;

  const zoneOrder = redZoneId ? zoneTraversalOrder(hosts, attackPaths, zones, redZoneId) : zones.map(z => z.id);
  const entZoneId = zoneOrder.find(z => z !== redZoneId && z !== targetZoneId) ?? null;

  const users          = hosts.filter(h => h.zoneId === redZoneId).map(h => h.id);
  const redZoneHostIds = new Set(hosts.filter(h => h.zoneId === redZoneId).map(h => h.id));
  const entryPoint     = attackPaths.filter(p => redZoneHostIds.has(p.from)).map(p => hosts.find(h => h.id === p.to)).find(h => h?.zoneId === entZoneId)?.id ?? null;
  const targetGateway  = attackPaths.find(p => p.to === targetHost?.id)?.from ?? null;

  const hasOutgoing    = new Set(attackPaths.map(p => p.from));
  const defenderHosts  = hosts.filter(h => h.zoneId === entZoneId && h.type === "server" && !hasOutgoing.has(h.id)).map(h => h.id);

  const defSet         = new Set(defenderHosts);
  const greenHosts     = hosts.filter(h => (h.zoneId === redZoneId || h.zoneId === entZoneId) && !defSet.has(h.id)).map(h => h.id);

  return { zones, hosts, attackPaths, zoneConnections, target: targetHost?.id ?? null, redStartHost: redStartHost?.id ?? null, entryPoint, targetGateway, defenderHosts, users, greenHosts };
}
