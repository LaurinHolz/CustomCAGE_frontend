export function exportToBackendFormat(state) {
  const hostsInOrder = state.hosts;

  // CONNECTED_HOSTS: for each host, list of target host names it can reach (from attackPaths)
  const connectedHosts = hostsInOrder.map(host => {
    const paths = state.attackPaths.filter(p => p.from === host.id);
    if (paths.length === 0) return null;
    const targets = paths.map(p => state.hosts.find(h => h.id === p.to)?.name).filter(Boolean);
    return targets.length > 0 ? targets : null;
  });

  // HOST_EXPLOITS, HOST_DECOYS, HOST_PRIORITY, REWARDED_EXPLOITS per host
  const hostExploits       = hostsInOrder.map(h => [...h.services]);
  const hostDecoys         = hostsInOrder.map(h => [...h.decoys]);
  const hostPriority       = hostsInOrder.map(h => h.priority ?? 1);
  const rewardedExploits   = hostsInOrder.map(h => [...(h.rewardedExploits || [])]);

  // ATTACK_PATHS: [[from_name, to_name], ...]
  const attackPaths = state.attackPaths.map(c => {
    const f = state.hosts.find(h => h.id === c.from);
    const t = state.hosts.find(h => h.id === c.to);
    return f && t ? [f.name, t.name] : null;
  }).filter(Boolean);

  // ZONE_CONNECTIONS: [[from_zone_name, to_zone_name], ...]
  const zoneConnections = state.zoneConnections.map(c => {
    const fromZone = state.zones.find(z => z.id === c.from);
    const toZone   = state.zones.find(z => z.id === c.to);
    return fromZone && toZone ? [fromZone.name, toZone.name] : null;
  }).filter(Boolean);

  // SUBNETS: { zoneId: [hostName, ...] }
  const subnets = {};
  state.zones.forEach(z => {
    subnets[z.id] = hostsInOrder.filter(h => h.zoneId === z.id).map(h => h.name);
  });

  // Scenario role host IDs → names
  const hostName = (id) => state.hosts.find(h => h.id === id)?.name ?? null;
  const hostNames = (ids) => (ids || []).map(id => hostName(id)).filter(Boolean);

  return {
    SUBNETS:           subnets,
    TARGET:            hostName(state.target),
    ENTRY_POINT:       hostName(state.entryPoint),
    TARGET_GATEWAY:    hostName(state.targetGateway),
    RED_START_HOST:    hostName(state.redStartHost),
    DEFENDER_HOSTS:    hostNames(state.defenderHosts),
    USERS:             hostNames(state.users),
    GREEN_HOSTS:       hostNames(state.greenHosts),

    EXPLOIT_PRIO:      state.exploitPrio  ?? 0.75,
    EXPLOIT_OBS:       state.exploitObs   ?? 0.95,
    REMOVE_SUCCESS:    state.removeSuccess  ?? 1.0,
    RESTORE_SUCCESS:   state.restoreSuccess ?? 1.0,

    RED_ACTIONS:       state.redActions,
    BLUE_ACTIONS:      state.blueActions,

    AGENT_LOCKOUT:     state.agentLockout,
    HOST_LOCKOUT:      state.hostLockout,

    NUM_SUBNETS:       state.zones.length,
    HOSTS:             hostsInOrder.map(h => h.name),
    HOST_EXPLOITS:     hostExploits,
    HOST_DECOYS:       hostDecoys,
    HOST_PRIORITY:     hostPriority,
    CONNECTED_HOSTS:   connectedHosts,

    EXPLOITS:          state.exploits,
    DECOYS:            state.decoys,
    EXPLOIT_OUTCOME:   state.exploitOutcomes,
    EXPLOIT_DECOY_MAP: state.exploitDecoyMap,
    REWARDED_EXPLOITS: rewardedExploits,

    ZONE_CONNECTIONS:  zoneConnections,
    ATTACK_PATHS:      attackPaths,
  };
}

export function downloadJSON(data, filename = "cage2_config.json") {
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
