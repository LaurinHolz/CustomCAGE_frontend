// Helper to get host order matching backend
export function getHostOrder(hosts) {
  const order = ['def', 'ent0', 'ent1', 'ent2', 'ophost0', 'ophost1', 'ophost2', 'opserv', 'user0', 'user1', 'user2', 'user3', 'user4'];
  return order.filter(name => hosts.some(h => h.name === name));
}

export function exportToBackendFormat(state) {
  // Verwende die tatsächlichen Hosts aus dem State (nicht feste Namen)
  const hostsInOrder = state.hosts;

  console.log('Exporting hosts:', hostsInOrder.map(h => ({ name: h.name, services: h.services, decoys: h.decoys })));

  // Build CONNECTED_HOSTS array (basierend auf Attack Paths)
  const connectedHosts = hostsInOrder.map(host => {
    // Finde einen Attack Path WO dieser Host die Quelle ist
    const attackPath = state.attackPaths.find(p => p.from === host.id);
    if (!attackPath) return null;
    const target = state.hosts.find(h => h.id === attackPath.to);
    return target ? target.name : null;
  });

  // Build HOST_EXPLOITS (Services per host)
  const hostExploits = hostsInOrder.map(h => [...h.services]);

  // Build HOST_DECOYS (Decoys per host)
  const hostDecoys = hostsInOrder.map(h => [...h.decoys]);

  // Build REWARDED_EXPLOITS (basierend auf Host-Namen und Services)
  const rewardedExploits = hostsInOrder.map(host => {
    const rewards = [];

    // Hier können Sie Ihre eigene Logik für Rewards implementieren
    // Für Custom-Netzwerke erstmal leer lassen
    // Basierend auf Host-Namen oder Services
    if (host.name === 'server1' && host.services.includes('Keep')) {
      rewards.push('Keep');
    }
    if (host.name === 'host0' && host.services.includes('Haraka')) {
      rewards.push('Haraka');
    }

    return rewards;
  });

  // Build ATTACK_PATHS als Array von [from_hostname, to_hostname]
  const attackPaths = state.attackPaths.map(c => {
    const f = state.hosts.find(h => h.id === c.from);
    const t = state.hosts.find(h => h.id === c.to);
    return f && t ? [f.name, t.name] : null;
  }).filter(Boolean);

  // Build ZONE_CONNECTIONS
  const zoneConnections = state.zoneConnections.map(c => {
    const fromZone = state.zones.find(z => z.id === c.from);
    const toZone = state.zones.find(z => z.id === c.to);
    return fromZone && toZone ? [fromZone.name, toZone.name] : null;
  }).filter(Boolean);

  const result = {
    RED_ACTIONS: state.redActions,
    BLUE_ACTIONS: state.blueActions,
    NUM_SUBNETS: state.zones.length,
    HOSTS: hostsInOrder.map(h => h.name),
    HOST_EXPLOITS: hostExploits,
    CONNECTED_HOSTS: connectedHosts,
    EXPLOITS: state.exploits,
    DECOYS: state.decoys,
    HOST_DECOYS: hostDecoys,
    EXPLOIT_OUTCOME: state.exploitOutcomes,
    REWARDED_EXPLOITS: rewardedExploits,
    ZONE_CONNECTIONS: zoneConnections,
    ATTACK_PATHS: attackPaths,
  };

  console.log('Final JSON:', JSON.stringify(result, null, 2));
  return result;
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