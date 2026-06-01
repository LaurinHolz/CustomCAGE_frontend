const CAGE2_EXPLOITS = ["FTP","Haraka","SQL","HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"];
const CAGE2_DECOYS = ["Femitter","Vsftpd","Apache","Haraka","SSHD","SMSS","Tomcat","Svchost"];
const CAGE2_RED_ACTIONS = ["sleep","remote","network","exploit","escalate","impact"];
const CAGE2_BLUE_ACTIONS = ["sleep","analyse","decoy","remove","restore"];
const EXPLOIT_OUTCOMES = {FTP:"root",Haraka:"root",SQL:"root",HTTPSRFI:"user",HTTPRFI:"user",Eternal:"root",Keep:"user",Brute:"user"};

const EXPLOIT_DECOY_MAP = {
  FTP:      ["Femitter","Vsftpd"],
  Haraka:   ["Haraka"],
  SQL:      ["Apache","Tomcat"],
  HTTPSRFI: ["Tomcat"],
  HTTPRFI:  ["Apache"],
  Eternal:  ["SMSS"],
  Keep:     ["Svchost"],
  Brute:    ["SSHD"],
};

const AGENT_LOCKOUT = {
  red:  { sleep: 0, remote: 0, network: 0, exploit: 0, escalate: 0, impact: 0 },
  blue: { sleep: 0, analyse: 0, decoy: 0, remove: 0, restore: 0 },
};

const HOST_LOCKOUT = {
  red:  { sleep: 0, remote: 0, network: 0, exploit: 0, escalate: 0, impact: 0 },
  blue: { sleep: 0, analyse: 0, decoy: 0, remove: 0, restore: 0 },
};

export const CAGE2_PRESET = {
  name: "CAGE-2 Original",

  // ── Actions ──────────────────────────────────────────────────────
  redActions:     [...CAGE2_RED_ACTIONS],
  blueActions:    [...CAGE2_BLUE_ACTIONS],

  // ── Services ─────────────────────────────────────────────────────
  exploits:        [...CAGE2_EXPLOITS],
  decoys:          [...CAGE2_DECOYS],
  exploitOutcomes: {...EXPLOIT_OUTCOMES},
  exploitDecoyMap: {...EXPLOIT_DECOY_MAP},

  // ── Numeric params ────────────────────────────────────────────────
  exploitPrio:    0.75,
  exploitObs:     0.95,
  removeSuccess:  1.0,
  restoreSuccess: 1.0,
  numSubnets:     3,

  // ── Lockouts ─────────────────────────────────────────────────────
  agentLockout: AGENT_LOCKOUT,
  hostLockout:  HOST_LOCKOUT,

  // ── Rewarded exploits (one entry per host, in HOSTS order) ───────
  rewardedExploits: [
    [], [], [], [], [], [], [], [], [], [], [], [], [],
  ],

  // ── Host priorities (in HOSTS order) ─────────────────────────────
  hostPriority: [2, 2, 2, 2, 1, 1, 1, 3, 1, 1, 1, 1, 1],

  // ── Scenario roles ───────────────────────────────────────────────
  target:        "h_server4",
  entryPoint:    "h_server1",
  targetGateway: "h_server3",
  redStartHost:  "h_host3",
  defenderHosts: ["h_server0"],
  users:         ["h_host3","h_host4","h_host5","h_host6","h_host7"],
  greenHosts:    ["h_server1","h_server2","h_server3","h_host3","h_host4","h_host5","h_host6","h_host7"],

  // ── Zones ─────────────────────────────────────────────────────────
  zones: [
    { id: "zone0", name: "Enterprise Subnet",  color: "#1D9E75", x: 340, y: 30 },
    { id: "zone1", name: "Operational Subnet", color: "#D85A30", x: 620, y: 30 },
    { id: "zone2", name: "User Subnet",        color: "#3B8BD4", x: 60,  y: 30 },
  ],

  // ── Hosts ─────────────────────────────────────────────────────────
  hosts: [
    // Enterprise (zone0)
    { id: "h_server0", name: "server0", type: "server", zoneId: "zone0",
      services: ["Brute"],
      decoys: [],
      connectedHosts: [],
      priority: 2,
      x: 350, y: 100 },

    { id: "h_server1", name: "server1", type: "server", zoneId: "zone0",
      services: ["Brute"],
      decoys: ["Haraka","Tomcat","Vsftpd","Apache"],
      connectedHosts: ["server3"],
      priority: 2,
      x: 450, y: 100 },

    { id: "h_server2", name: "server2", type: "server", zoneId: "zone0",
      services: ["Brute","Eternal","Keep","HTTPRFI","HTTPSRFI"],
      decoys: ["Femitter"],
      connectedHosts: ["server3"],
      priority: 2,
      x: 350, y: 170 },

    { id: "h_server3", name: "server3", type: "server", zoneId: "zone0",
      services: ["Brute"],
      decoys: ["Femitter"],
      connectedHosts: ["server4"],
      priority: 2,
      x: 450, y: 170 },

    // Operational (zone1)
    { id: "h_host0", name: "host0", type: "host", zoneId: "zone1",
      services: ["Brute"],
      decoys: [],
      connectedHosts: [],
      priority: 1,
      x: 630, y: 100 },

    { id: "h_host1", name: "host1", type: "host", zoneId: "zone1",
      services: ["Brute"],
      decoys: [],
      connectedHosts: [],
      priority: 1,
      x: 730, y: 100 },

    { id: "h_host2", name: "host2", type: "host", zoneId: "zone1",
      services: ["Brute"],
      decoys: [],
      connectedHosts: [],
      priority: 1,
      x: 630, y: 170 },

    { id: "h_server4", name: "server4", type: "server", zoneId: "zone1",
      services: ["Brute"],
      decoys: ["Haraka","Apache","Tomcat","Vsftpd"],
      connectedHosts: [],
      priority: 3,
      x: 730, y: 170 },

    // User (zone2)
    { id: "h_host3", name: "host3", type: "host", zoneId: "zone2",
      services: [],
      decoys: [],
      connectedHosts: [],
      priority: 1,
      x: 50,  y: 100 },

    { id: "h_host4", name: "host4", type: "host", zoneId: "zone2",
      services: ["Brute","FTP"],
      decoys: ["Apache","Tomcat","SMSS","Svchost"],
      connectedHosts: ["server1"],
      priority: 1,
      x: 150, y: 100 },

    { id: "h_host5", name: "host5", type: "host", zoneId: "zone2",
      services: ["Eternal","Keep"],
      decoys: ["Femitter","Tomcat","Apache","SSHD"],
      connectedHosts: ["server1"],
      priority: 1,
      x: 50,  y: 170 },

    { id: "h_host6", name: "host6", type: "host", zoneId: "zone2",
      services: ["Keep","HTTPSRFI","HTTPRFI","Haraka"],
      decoys: ["Vsftpd","SSHD"],
      connectedHosts: ["server2"],
      priority: 1,
      x: 150, y: 170 },

    { id: "h_host7", name: "host7", type: "host", zoneId: "zone2",
      services: ["Keep","HTTPSRFI","HTTPRFI","Haraka","SQL"],
      decoys: ["Vsftpd"],
      connectedHosts: ["server2"],
      priority: 1,
      x: 100, y: 240 },
  ],

  // ── Connections ───────────────────────────────────────────────────
  zoneConnections: [
    { from: "zone2", to: "zone0" },
    { from: "zone0", to: "zone1" },
  ],
  attackPaths: [
    { from: "h_server1", to: "h_server3" },
    { from: "h_server2", to: "h_server3" },
    { from: "h_server3", to: "h_server4" },
    { from: "h_host4",   to: "h_server1" },
    { from: "h_host5",   to: "h_server1" },
    { from: "h_host6",   to: "h_server2" },
    { from: "h_host7",   to: "h_server2" },
  ],
};

export function makeEmpty() {
  return {
    name: "Custom",
    redActions:      [...CAGE2_RED_ACTIONS],
    blueActions:     [...CAGE2_BLUE_ACTIONS],
    exploits:        [...CAGE2_EXPLOITS],
    decoys:          [...CAGE2_DECOYS],
    exploitOutcomes: {...EXPLOIT_OUTCOMES},
    exploitDecoyMap: {...EXPLOIT_DECOY_MAP},
    exploitPrio:     0.75,
    exploitObs:      0.95,
    removeSuccess:   1.0,
    restoreSuccess:  1.0,
    numSubnets:      0,
    agentLockout:    { red: {...AGENT_LOCKOUT.red},  blue: {...AGENT_LOCKOUT.blue} },
    hostLockout:     { red: {...HOST_LOCKOUT.red},   blue: {...HOST_LOCKOUT.blue} },
    rewardedExploits: [],
    hostPriority:    [],
    target:          null,
    entryPoint:      null,
    targetGateway:   null,
    redStartHost:    null,
    defenderHosts:   [],
    users:           [],
    greenHosts:      [],
    zones:           [],
    hosts:           [],
    zoneConnections: [],
    attackPaths:     [],
  };
}