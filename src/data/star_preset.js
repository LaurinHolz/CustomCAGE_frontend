import { buildStateFromFlat } from "../utils/buildState";

// ── Translation rules ────────────────────────────────────────────────────────
// All entities belong to one common subnet.
const RULES = [
  { prefix: "def",    zoneName: "Star Subnet", zoneColor: "#3B8BD4", outputType: "server" },
  { prefix: "ent",    zoneName: "Star Subnet", zoneColor: "#3B8BD4", outputType: "server" },
  { prefix: "ophost", zoneName: "Star Subnet", zoneColor: "#3B8BD4", outputType: "host"   },
  { prefix: "opserv", zoneName: "Star Subnet", zoneColor: "#3B8BD4", outputType: "server" },
  { prefix: "user",   zoneName: "Star Subnet", zoneColor: "#3B8BD4", outputType: "host"   },
];

// ── Entities ─────────────────────────────────────────────────────────────────
// Same entities, services, priorities, and decoy capabilities as CAGE-2.
const ENTITIES = [
  {
    name: "def",
    priority: 2,
    services: ["Brute"],
    decoys: [],
  },

  {
    name: "ent0",
    priority: 2,
    services: ["Brute"],
    decoys: ["Apache", "Tomcat", "Vsftpd", "Haraka"],
  },
  {
    name: "ent1",
    priority: 2,
    services: ["HTTPSRFI", "HTTPRFI", "Eternal", "Keep", "Brute"],
    decoys: ["Femitter"],
  },
  {
    name: "ent2",
    priority: 2,
    services: ["Brute"],
    decoys: ["Femitter"],
  },

  {
    name: "ophost0",
    priority: 1,
    services: ["Brute"],
    decoys: ["Vsftpd", "Haraka", "Tomcat", "Apache"],
  },
  {
    name: "ophost1",
    priority: 1,
    services: ["Brute"],
    decoys: ["Vsftpd", "Haraka", "Tomcat", "Apache"],
  },
  {
    name: "ophost2",
    priority: 1,
    services: ["Brute"],
    decoys: ["Vsftpd", "Haraka", "Tomcat", "Apache"],
  },
  {
    name: "opserv",
    priority: 3,
    services: ["Brute"],
    decoys: ["Vsftpd", "Haraka", "Tomcat", "Apache"],
  },

  // Initial-access / Red-start host.
  {
    name: "user0",
    priority: 1,
    services: ["FTP", "Brute"],
    decoys: ["Svchost", "SMSS", "Apache", "Tomcat"],
  },

  {
    name: "user1",
    priority: 1,
    services: ["FTP", "Brute"],
    decoys: ["Svchost", "SMSS", "Apache", "Tomcat"],
  },
  {
    name: "user2",
    priority: 1,
    services: ["Eternal", "Keep"],
    decoys: ["SSHD", "Apache", "Tomcat", "Femitter"],
  },
  {
    name: "user3",
    priority: 1,
    services: ["Haraka", "SQL", "HTTPSRFI", "HTTPRFI", "Keep"],
    decoys: ["SSHD", "Vsftpd"],
  },
  {
    name: "user4",
    priority: 1,
    services: ["Haraka", "SQL", "HTTPSRFI", "HTTPRFI", "Keep"],
    decoys: ["Vsftpd"],
  },
];

// ── Attack connectivity ───────────────────────────────────────────────────────
//
// CAGE-4-like star:
//
// user0 represents the initial-access point.
// Once Red has initial access on user0, every relevant attack-graph
// entity can be attacked directly, including the Operational Server.
//
//                  user1
//                    |
//          user2 --- user0 --- ent0
//                 /  |  \
//             user3  |   ent1
//                    |
//                  user4
//
//             + ent2
//             + opserv
//
// def and ophost0-2 remain physical entities, but are intentionally
// outside the Red attack graph.
//
const CONNECTED_HOSTS = [
  null, // def

  null, // ent0
  null, // ent1
  null, // ent2

  null, // ophost0
  null, // ophost1
  null, // ophost2
  null, // opserv

  [
    "user1",
    "user2",
    "user3",
    "user4",
    "ent0",
    "ent1",
    "ent2",
    "opserv",
  ], // user0 = initial-access hub

  null, // user1
  null, // user2
  null, // user3
  null, // user4
];

// ── Canvas positions ──────────────────────────────────────────────────────────
const POSITIONS = {
  // Star centre
  user0: { x: 450, y: 300 },

  // Evenly distributed around user0
  user1: { x: 350, y: 175 },
  user2: { x: 275, y: 230 },
  user3: { x: 250, y: 300 },
  user4: { x: 275, y: 370 },

  ent0: { x: 450, y: 150 },
  ent1: { x: 550, y: 175 },
  ent2: { x: 625, y: 230 },

  opserv: { x: 650, y: 300 },

  def:     { x: 625, y: 370 },
  ophost0: { x: 550, y: 425 },
  ophost1: { x: 450, y: 450 },
  ophost2: { x: 350, y: 425 },
};

// ── Game-mechanics constants ──────────────────────────────────────────────────
const EXPLOITS = [
  "FTP",
  "Haraka",
  "SQL",
  "HTTPSRFI",
  "HTTPRFI",
  "Eternal",
  "Keep",
  "Brute",
];

const DECOYS = [
  "Femitter",
  "Vsftpd",
  "Apache",
  "Haraka",
  "SSHD",
  "SMSS",
  "Tomcat",
  "Svchost",
];

const RED_ACTIONS = [
  "sleep",
  "remote",
  "network",
  "exploit",
  "escalate",
  "impact",
];

const BLUE_ACTIONS = [
  "sleep",
  "analyse",
  "decoy",
  "remove",
  "restore",
];

const EXPLOIT_OUTCOMES = {
  FTP:      "root",
  Haraka:   "root",
  SQL:      "root",
  HTTPSRFI: "user",
  HTTPRFI:  "user",
  Eternal:  "root",
  Keep:     "user",
  Brute:    "user",
};

const EXPLOIT_DECOY_MAP = {
  FTP:      ["Femitter", "Vsftpd"],
  Haraka:   ["Haraka"],
  SQL:      ["Apache", "Tomcat"],
  HTTPSRFI: ["Tomcat"],
  HTTPRFI:  ["Apache"],
  Eternal:  ["SMSS"],
  Keep:     ["Svchost"],
  Brute:    ["SSHD"],
};

const AGENT_LOCKOUT = {
  red: {
    sleep: 0,
    remote: 0,
    network: 0,
    exploit: 0,
    escalate: 0,
    impact: 0,
  },
  blue: {
    sleep: 0,
    analyse: 0,
    decoy: 0,
    remove: 0,
    restore: 0,
  },
};

const HOST_LOCKOUT = {
  red: {
    sleep: 0,
    remote: 0,
    network: 0,
    exploit: 0,
    escalate: 0,
    impact: 0,
  },
  blue: {
    sleep: 0,
    analyse: 0,
    decoy: 0,
    remove: 0,
    restore: 0,
  },
};

// ── Build topology ─────────────────────────────────────────────────────────────
const STAR_TOPOLOGY = buildStateFromFlat({
  entities:       ENTITIES,
  connectedHosts: CONNECTED_HOSTS,
  redStart:       "user0",
  target:         "opserv",
  rules:          RULES,
  positions:      POSITIONS,
});

// ── Build preset ──────────────────────────────────────────────────────────────
export const STAR_PRESET = {
  name: "CAGE-4-like Star",

  ...STAR_TOPOLOGY,

  // In this scenario Red already has initial access on its start host.
  // The backend requires ENTRY_POINT to reference a valid entity.
  entryPoint: STAR_TOPOLOGY.redStartHost,

  // Actions
  redActions:  [...RED_ACTIONS],
  blueActions: [...BLUE_ACTIONS],

  // Services
  exploits:        [...EXPLOITS],
  decoys:          [...DECOYS],
  exploitOutcomes: { ...EXPLOIT_OUTCOMES },
  exploitDecoyMap: { ...EXPLOIT_DECOY_MAP },

  // Numeric parameters
  exploitPrio:         0.75,
  exploitObs:          0.95,
  removeSuccess:       1.0,
  restoreSuccess:      1.0,
  restoreResetsDecoys: false,

  // Entire scenario is contained in one subnet.
  numSubnets: 1,

  // Lockouts
  agentLockout: AGENT_LOCKOUT,
  hostLockout:  HOST_LOCKOUT,

  // Per-host arrays
  rewardedExploits: ENTITIES.map(() => []),
  hostPriority:     ENTITIES.map(entity => entity.priority),
};