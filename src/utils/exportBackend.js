import { buildNameTranslation } from "./translateNames";

export function exportToBackendFormat(state) {
  const { hostNames, zoneIds, hostsOrdered } = buildNameTranslation(state);
  const tr  = name => hostNames[name] ?? name;
  const trZ = id   => zoneIds[id]    ?? id;

  // CONNECTED_HOSTS: per host, which hosts it can reach (derived from attack paths)
  const connectedHosts = hostsOrdered.map(host => {
    const paths = state.attackPaths.filter(p => p.from === host.id);
    if (paths.length === 0) return null;
    const targets = paths
      .map(p => { const t = state.hosts.find(h => h.id === p.to); return t ? tr(t.name) : null; })
      .filter(Boolean);
    return targets.length > 0 ? targets : null;
  });

  const hostExploits     = hostsOrdered.map(h => [...h.services]);
  const hostDecoys       = hostsOrdered.map(h => [...h.decoys]);
  const hostPriority     = hostsOrdered.map(h => h.priority ?? 1);
  const rewardedExploits = hostsOrdered.map(h => [...(h.rewardedExploits || [])]);

  const attackPaths = state.attackPaths.map(c => {
    const f = state.hosts.find(h => h.id === c.from);
    const t = state.hosts.find(h => h.id === c.to);
    return f && t ? [tr(f.name), tr(t.name)] : null;
  }).filter(Boolean);

  const zoneConnections = state.zoneConnections.map(c => {
    const fromZone = state.zones.find(z => z.id === c.from);
    const toZone   = state.zones.find(z => z.id === c.to);
    return fromZone && toZone ? [fromZone.name, toZone.name] : null;
  }).filter(Boolean);

  const subnets = {};
  state.zones.forEach(z => {
    subnets[trZ(z.id)] = hostsOrdered.filter(h => h.zoneId === z.id).map(h => tr(h.name));
  });

  const nameById  = id  => { const h = state.hosts.find(h => h.id === id); return h ? tr(h.name) : null; };
  const nameByIds = ids => (ids || []).map(id => nameById(id)).filter(Boolean);

  return {
    SUBNETS:           subnets,
    TARGET:            nameById(state.target),
    ENTRY_POINT:       nameById(state.entryPoint),
    TARGET_GATEWAY:    nameById(state.targetGateway),
    RED_START_HOST:    nameById(state.redStartHost),
    DEFENDER_HOSTS:    nameByIds(state.defenderHosts),
    USERS:             nameByIds(state.users),
    GREEN_HOSTS:       nameByIds(state.greenHosts),

    EXPLOIT_PRIO:      state.exploitPrio  ?? 0.75,
    EXPLOIT_OBS:       state.exploitObs   ?? 0.95,
    REMOVE_SUCCESS:    state.removeSuccess  ?? 1.0,
    RESTORE_SUCCESS:   state.restoreSuccess ?? 1.0,
    RESTORE_RESETS_DECOYS: state.restoreResetsDecoys ?? false,

    RED_ACTIONS:       state.redActions,
    BLUE_ACTIONS:      state.blueActions,

    AGENT_LOCKOUT:     state.agentLockout,
    HOST_LOCKOUT:      state.hostLockout,

    NUM_SUBNETS:       state.zones.length,
    HOSTS:             hostsOrdered.map(h => tr(h.name)),
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
