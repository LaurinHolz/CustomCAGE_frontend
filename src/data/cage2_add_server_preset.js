import { buildStateFromFlat } from "../utils/buildState";

// ── Translation rules ────────────────────────────────────────────────────────
// Each rule maps a display-name prefix to:
//   zoneName   – which logical zone the host belongs to
//   zoneColor  – color used when the zone is auto-created
//   outputType – "host" | "server" → controls the backend name prefix (hostX vs serverX)
const RULES = [
  { prefix: "def",    zoneName: "Enterprise Subnet",  zoneColor: "#1D9E75", outputType: "server" },
  { prefix: "ent",    zoneName: "Enterprise Subnet",  zoneColor: "#1D9E75", outputType: "server" },
  { prefix: "ophost", zoneName: "Operational Subnet", zoneColor: "#D85A30", outputType: "host"   },
  { prefix: "opserv", zoneName: "Operational Subnet", zoneColor: "#D85A30", outputType: "server" },
  { prefix: "user",   zoneName: "User Subnet",        zoneColor: "#3B8BD4", outputType: "host"   },
];

// ── Entities ─────────────────────────────────────────────────────────────────
const ENTITIES = [
  { name: "def",     priority: 2, services: ["Brute"],                                      decoys: [] },

  { name: "ent0",    priority: 2, services: ["Brute"],                                      decoys: ["Apache","Tomcat","Vsftpd","Haraka"] },
  { name: "ent1",    priority: 2, services: ["HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"], decoys: ["Femitter"] },
  { name: "ent3",    priority: 2, services: ["Brute"],                                      decoys: ["Femitter"] },
  { name: "ent2",    priority: 2, services: ["HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"], decoys: ["Femitter"] },

  { name: "ophost0", priority: 1, services: ["Brute"],                                      decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },
  { name: "ophost1", priority: 1, services: ["Brute"],                                      decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },
  { name: "ophost2", priority: 1, services: ["Brute"],                                      decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },
  { name: "opserv",  priority: 3, services: ["Brute"],                                      decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },

  { name: "user0",   priority: 1, services: ["FTP","Brute"],                                decoys: ["Svchost","SMSS","Apache","Tomcat"] },
  { name: "user1",   priority: 1, services: ["FTP","Brute"],                                decoys: ["Svchost","SMSS","Apache","Tomcat"] },
  { name: "user2",   priority: 1, services: ["Eternal","Keep"],                             decoys: ["SSHD","Apache","Tomcat","Femitter"] },
  { name: "user3",   priority: 1, services: ["Haraka","SQL","HTTPSRFI","HTTPRFI","Keep"],    decoys: ["SSHD","Vsftpd"] },
  { name: "user4",   priority: 1, services: ["Haraka","SQL","HTTPSRFI","HTTPRFI","Keep"],    decoys: ["Vsftpd"] },
];

// ── Attack connectivity ───────────────────────────────────────────────────────
// Parallel to ENTITIES: which entities this entity can attack (by display name).
const CONNECTED_HOSTS = [
  null,       // def
  ["ent3","ent1","ent2"],   // ent0   → ent1,ent2,ent3
  ["ent3","ent0","ent2"],   // ent1   → ent0,ent2,ent3
  ["ent3","ent0","ent1"],   // ent2   → ent0, ent1,ent3
  ["opserv"], // ent3   → opserv (gateway to target)
  null,       // ophost0
  null,       // ophost1
  null,       // ophost2
  null,       // opserv (target)
  null,       // user0
  ["ent0"],   // user1  → ent0
  ["ent0","ent2"],   // user2  → ent0
  ["ent1","ent2"],   // user3  → ent1
  ["ent1"],   // user4  → ent1
];

// ── Canvas positions ──────────────────────────────────────────────────────────
const POSITIONS = {
  def:     { x: 350, y: 100 },
  ent0:    { x: 450, y: 100 },
  ent1:    { x: 350, y: 170 },
  ent2:    { x: 450, y: 170 },
  ent3:    { x: 350, y: 240 },
  ophost0: { x: 630, y: 100 },
  ophost1: { x: 730, y: 100 },
  ophost2: { x: 630, y: 170 },
  opserv:  { x: 730, y: 170 },
  user0:   { x: 50,  y: 100 },
  user1:   { x: 150, y: 100 },
  user2:   { x: 50,  y: 170 },
  user3:   { x: 150, y: 170 },
  user4:   { x: 100, y: 240 },
};

// ── Game-mechanics constants ──────────────────────────────────────────────────
const EXPLOITS      = ["FTP","Haraka","SQL","HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"];
const DECOYS        = ["Femitter","Vsftpd","Apache","Haraka","SSHD","SMSS","Tomcat","Svchost"];
const RED_ACTIONS   = ["sleep","remote","network","exploit","escalate","impact"];
const BLUE_ACTIONS  = ["sleep","analyse","decoy","remove","restore"];
const EXPLOIT_OUTCOMES  = { FTP:"root", Haraka:"root", SQL:"root", HTTPSRFI:"user", HTTPRFI:"user", Eternal:"root", Keep:"user", Brute:"user" };
const EXPLOIT_DECOY_MAP = { FTP:["Femitter","Vsftpd"], Haraka:["Haraka"], SQL:["Apache","Tomcat"], HTTPSRFI:["Tomcat"], HTTPRFI:["Apache"], Eternal:["SMSS"], Keep:["Svchost"], Brute:["SSHD"] };
const AGENT_LOCKOUT = { red:{ sleep:0,remote:0,network:0,exploit:0,escalate:0,impact:0 }, blue:{ sleep:0,analyse:0,decoy:0,remove:0,restore:0 } };
const HOST_LOCKOUT  = { red:{ sleep:0,remote:0,network:0,exploit:0,escalate:0,impact:0 }, blue:{ sleep:0,analyse:0,decoy:0,remove:0,restore:0 } };

// ── Build preset ──────────────────────────────────────────────────────────────
export const CAGE2_ADD_SERVER_PRESET = {
  name: "CAGE-2 Add Server",

  // Topology + scenario roles — fully derived from entities, connections and rules
  ...buildStateFromFlat({
    entities:       ENTITIES,
    connectedHosts: CONNECTED_HOSTS,
    redStart:       "user0",
    target:         "opserv",
    rules:          RULES,
    positions:      POSITIONS,
  }),

  // Actions
  redActions:  [...RED_ACTIONS],
  blueActions: [...BLUE_ACTIONS],

  // Services
  exploits:        [...EXPLOITS],
  decoys:          [...DECOYS],
  exploitOutcomes: { ...EXPLOIT_OUTCOMES },
  exploitDecoyMap: { ...EXPLOIT_DECOY_MAP },

  // Numeric params
  exploitPrio:    0.75,
  exploitObs:     0.95,
  removeSuccess:  1.0,
  restoreSuccess: 1.0,
  numSubnets:     3,

  // Lockouts
  agentLockout: AGENT_LOCKOUT,
  hostLockout:  HOST_LOCKOUT,

  // Per-host arrays (order matches export order, not entity definition order)
  rewardedExploits: ENTITIES.map(() => []),
  hostPriority:     ENTITIES.map(e => e.priority),
};

export function makeEmpty() {
  return {
    name:             "Custom",
    redActions:       [...RED_ACTIONS],
    blueActions:      [...BLUE_ACTIONS],
    exploits:         [...EXPLOITS],
    decoys:           [...DECOYS],
    exploitOutcomes:  { ...EXPLOIT_OUTCOMES },
    exploitDecoyMap:  { ...EXPLOIT_DECOY_MAP },
    exploitPrio:      0.75,
    exploitObs:       0.95,
    removeSuccess:    1.0,
    restoreSuccess:   1.0,
    numSubnets:       0,
    agentLockout:     { red: { ...AGENT_LOCKOUT.red  }, blue: { ...AGENT_LOCKOUT.blue  } },
    hostLockout:      { red: { ...HOST_LOCKOUT.red   }, blue: { ...HOST_LOCKOUT.blue  } },
    rewardedExploits: [],
    hostPriority:     [],
    target:           null,
    entryPoint:       null,
    targetGateway:    null,
    redStartHost:     null,
    defenderHosts:    [],
    users:            [],
    greenHosts:       [],
    zones:            [],
    hosts:            [],
    zoneConnections:  [],
    attackPaths:      [],
  };
}
