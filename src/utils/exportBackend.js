import { buildNameTranslation } from "./translateNames";

export function exportToBackendFormat(state) {
  const { hostNames, zoneIds, hostsOrdered } = buildNameTranslation(state);

  const tr  = name => hostNames[name] ?? name;
  const trZ = id   => zoneIds[id]    ?? id;

  // CONNECTED_HOSTS:
  // per host, which hosts it can reach
  // derived from attack paths
  const connectedHosts = hostsOrdered.map(host => {
    const paths = state.attackPaths.filter(p => p.from === host.id);

    if (paths.length === 0) {
      return null;
    }

    const targets = paths
      .map(p => {
        const target = state.hosts.find(h => h.id === p.to);
        return target ? tr(target.name) : null;
      })
      .filter(Boolean);

    return targets.length > 0 ? targets : null;
  });

  const hostExploits = hostsOrdered.map(h => [
    ...(h.services || []),
  ]);

  const hostDecoys = hostsOrdered.map(h => [
    ...(h.decoys || []),
  ]);

  const hostPriority = hostsOrdered.map(
    h => h.priority ?? 1
  );

  const rewardedExploits = hostsOrdered.map(h => [
    ...(h.rewardedExploits || []),
  ]);

  const attackPaths = state.attackPaths
    .map(c => {
      const fromHost = state.hosts.find(
        h => h.id === c.from
      );

      const toHost = state.hosts.find(
        h => h.id === c.to
      );

      return fromHost && toHost
        ? [
            tr(fromHost.name),
            tr(toHost.name),
          ]
        : null;
    })
    .filter(Boolean);

  const zoneConnections = state.zoneConnections
    .map(c => {
      const fromZone = state.zones.find(
        z => z.id === c.from
      );

      const toZone = state.zones.find(
        z => z.id === c.to
      );

      return fromZone && toZone
        ? [
            trZ(fromZone.id),
            trZ(toZone.id),
          ]
        : null;
    })
    .filter(Boolean);

  const subnets = {};

  state.zones.forEach(z => {
    subnets[trZ(z.id)] = hostsOrdered
      .filter(h => h.zoneId === z.id)
      .map(h => tr(h.name));
  });

  const nameById = id => {
    const host = state.hosts.find(
      h => h.id === id
    );

    return host
      ? tr(host.name)
      : null;
  };

  const nameByIds = ids =>
    (ids || [])
      .map(id => nameById(id))
      .filter(Boolean);


  // ─────────────────────────────────────────────
  // Multi-Agent Defender Assignments
  //
  // The GUI stores assignments as:
  //
  //   host:<id>
  //   zone:<id>
  //
  // Zones are expanded here to all hosts that
  // belong to the selected zone.
  //
  // A host may occur in multiple defenders,
  // which explicitly represents overlapping
  // responsibility regions.
  // ─────────────────────────────────────────────

  const defenders = (state.defenders || []).map(
    defender => {

      const assignedHostIds = new Set();

      (defender.entityKeys || []).forEach(key => {
        if (
          typeof key !== "string" ||
          !key.includes(":")
        ) {
          return;
        }

        const separatorIndex = key.indexOf(":");

        const type = key.substring(
          0,
          separatorIndex
        );

        const id = key.substring(
          separatorIndex + 1
        );

        // Individual host selected
        if (type === "host") {
          const hostExists = state.hosts.some(
            h => h.id === id
          );

          if (hostExists) {
            assignedHostIds.add(id);
          }
        }

        // Entire zone selected:
        // expand zone to all contained hosts
        if (type === "zone") {
          state.hosts
            .filter(h => h.zoneId === id)
            .forEach(h => {
              assignedHostIds.add(h.id);
            });
        }
      });

      const hosts = Array
        .from(assignedHostIds)
        .map(id => {
          const host = state.hosts.find(
            h => h.id === id
          );

          return host
            ? tr(host.name)
            : null;
        })
        .filter(Boolean);

      return {
        id: defender.id,
        name: defender.name,
        hosts,
      };
    }
  );


  return {
    SUBNETS:           subnets,

    TARGET:            nameById(state.target),
    ENTRY_POINT:       nameById(state.entryPoint),
    TARGET_GATEWAY:    nameById(state.targetGateway),
    RED_START_HOST:    nameById(state.redStartHost),

    DEFENDER_HOSTS:    nameByIds(
      state.defenderHosts
    ),

    // ─── MARL ───────────────────────────────
    MULTI_AGENT:       state.marlEnabled ?? false,
    DEFENDERS:         defenders,

    USERS:             nameByIds(state.users),
    GREEN_HOSTS:       nameByIds(
      state.greenHosts
    ),

    EXPLOIT_PRIO:
      state.exploitPrio ?? 0.75,

    EXPLOIT_OBS:
      state.exploitObs ?? 0.95,

    REMOVE_SUCCESS:
      state.removeSuccess ?? 1.0,

    RESTORE_SUCCESS:
      state.restoreSuccess ?? 1.0,

    RESTORE_RESETS_DECOYS:
      state.restoreResetsDecoys ?? false,

    RED_ACTIONS:
      state.redActions,

    BLUE_ACTIONS:
      state.blueActions,

    AGENT_LOCKOUT:
      state.agentLockout,

    HOST_LOCKOUT:
      state.hostLockout,

    NUM_SUBNETS:
      state.zones.length,

    HOSTS:
      hostsOrdered.map(
        h => tr(h.name)
      ),

    HOST_EXPLOITS:
      hostExploits,

    HOST_DECOYS:
      hostDecoys,

    HOST_PRIORITY:
      hostPriority,

    CONNECTED_HOSTS:
      connectedHosts,

    EXPLOITS:
      state.exploits,

    DECOYS:
      state.decoys,

    EXPLOIT_OUTCOME:
      state.exploitOutcomes,

    EXPLOIT_DECOY_MAP:
      state.exploitDecoyMap,

    REWARDED_EXPLOITS:
      rewardedExploits,

    ZONE_CONNECTIONS:
      zoneConnections,

    ATTACK_PATHS:
      attackPaths,
  };
}


export function downloadJSON(
  data,
  filename = "cage2_config.json"
) {
  const jsonStr = JSON.stringify(
    data,
    null,
    2
  );

  const blob = new Blob(
    [jsonStr],
    {
      type: "application/json",
    }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}