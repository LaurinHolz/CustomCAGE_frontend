import { buildStateFromFlat } from "../utils/buildState";

const RULES = [
  { prefix: "def",    zoneName: "Enterprise Subnet",  zoneColor: "#1D9E75", outputType: "server" },
  { prefix: "ent",    zoneName: "Enterprise Subnet",  zoneColor: "#1D9E75", outputType: "server" },
  { prefix: "ophost", zoneName: "Operational Subnet", zoneColor: "#D85A30", outputType: "host"   },
  { prefix: "opserv", zoneName: "Operational Subnet", zoneColor: "#D85A30", outputType: "server" },
  { prefix: "user",   zoneName: "User Subnet",        zoneColor: "#3B8BD4", outputType: "host"   },
];

const ENTITIES = [
  { name: "def",     priority: 2, services: ["Brute"],                                       decoys: [] },
  { name: "ent0",    priority: 2, services: ["Brute"],                                       decoys: ["Haraka","Tomcat","Vsftpd","Apache"] },
  { name: "ent1",    priority: 2, services: ["Brute","Eternal","Keep","HTTPRFI","HTTPSRFI"], decoys: ["Femitter"] },
  { name: "ent2",    priority: 2, services: ["Brute"],                                       decoys: ["Femitter"] },
  { name: "ent3",    priority: 2, services: ["Brute"],                                       decoys: ["Femitter"] },
  { name: "ent4",    priority: 2, services: ["Brute"],                                       decoys: ["Femitter"] },
  { name: "ent5",    priority: 2, services: ["Brute"],                                       decoys: ["Femitter"] },
  { name: "ophost0", priority: 1, services: ["Brute"],                                       decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },
  { name: "ophost1", priority: 1, services: ["Brute"],                                       decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },
  { name: "ophost2", priority: 1, services: ["Brute"],                                       decoys: ["Vsftpd","Haraka","Tomcat","Apache"] },
  { name: "opserv",  priority: 3, services: ["Brute"],                                       decoys: ["Haraka","Apache","Tomcat","Vsftpd"] },
  { name: "user0",   priority: 1, services: [],                                              decoys: [] },
  { name: "user1",   priority: 1, services: ["Brute","FTP"],                                 decoys: ["Apache","Tomcat","SMSS","Svchost"] },
  { name: "user2",   priority: 1, services: ["Eternal","Keep"],                              decoys: ["Femitter","Tomcat","Apache","SSHD"] },
  { name: "user3",   priority: 1, services: ["Keep","HTTPSRFI","HTTPRFI","Haraka"],          decoys: ["Vsftpd","SSHD"] },
  { name: "user4",   priority: 1, services: ["Keep","HTTPSRFI","HTTPRFI","Haraka","SQL"],    decoys: ["Vsftpd"] },
  { name: "user5",   priority: 1, services: ["Brute","FTP"],                                 decoys: ["Apache","Tomcat"] },
  { name: "user6",   priority: 1, services: ["Eternal","Keep"],                              decoys: ["Femitter","SSHD"] },
  { name: "user7",   priority: 1, services: ["Keep","HTTPSRFI","HTTPRFI","Haraka"],          decoys: ["Vsftpd","SSHD"] },
  { name: "user8",   priority: 1, services: ["Keep","HTTPSRFI","HTTPRFI","Haraka","SQL"],    decoys: ["Vsftpd"] },
  { name: "user9",   priority: 1, services: ["Brute","FTP"],                                 decoys: ["Apache","Tomcat"] },
];

const CONNECTED_HOSTS = [
  null,                                    // def
  ["ent1","ent2","ent3","ent4","ent5"],    // ent0
  ["ent0","ent2","ent3","ent4","ent5"],    // ent1
  ["ent0","ent1","ent3","ent4","ent5"],    // ent2
  ["ent0","ent1","ent2","ent4","ent5"],    // ent3
  ["ent0","ent1","ent2","ent3","ent5"],    // ent4
  ["opserv"],                              // ent5 -> opserv (gateway)
  null,                                    // ophost0
  null,                                    // ophost1
  null,                                    // ophost2
  null,                                    // opserv (target)
  null,                                    // user0 red start
  ["ent0"],                                // user1 -> ent0
  ["ent0"],                                // user2 -> ent0
  ["ent1"],                                // user3 -> ent1
  ["ent1"],                                // user4 -> ent1
  ["ent2"],                                // user5 -> ent2
  ["ent2"],                                // user6 -> ent2
  ["ent3"],                                // user7 -> ent3
  ["ent3"],                                // user8 -> ent3
  ["ent4"],                                // user9 -> ent4
];

const POSITIONS = {
  def:     { x: 350, y: 100 },
  ent0:    { x: 450, y: 100 },
  ent1:    { x: 350, y: 170 },
  ent2:    { x: 450, y: 170 },
  ent3:    { x: 350, y: 240 },
  ent4:    { x: 450, y: 240 },
  ent5:    { x: 350, y: 310 },
  ophost0: { x: 630, y: 100 },
  ophost1: { x: 730, y: 100 },
  ophost2: { x: 630, y: 170 },
  opserv:  { x: 730, y: 170 },
  user0:   { x: 50,  y: 100 },
  user1:   { x: 150, y: 100 },
  user2:   { x: 50,  y: 170 },
  user3:   { x: 150, y: 170 },
  user4:   { x: 50,  y: 240 },
  user5:   { x: 150, y: 240 },
  user6:   { x: 50,  y: 310 },
  user7:   { x: 150, y: 310 },
  user8:   { x: 50,  y: 380 },
  user9:   { x: 150, y: 380 },
};

const EXPLOITS     = ["FTP","Haraka","SQL","HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"];
const DECOYS       = ["Femitter","Vsftpd","Apache","Haraka","SSHD","SMSS","Tomcat","Svchost"];
const RED_ACTIONS  = ["sleep","remote","network","exploit","escalate","impact"];
const BLUE_ACTIONS = ["sleep","analyse","decoy","remove","restore"];

const EXPLOIT_OUTCOMES = {
  FTP: "root",
  Haraka: "root",
  SQL: "root",
  HTTPSRFI: "user",
  HTTPRFI: "user",
  Eternal: "root",
  Keep: "user",
  Brute: "user",
};

const EXPLOIT_DECOY_MAP = {
  FTP: ["Femitter","Vsftpd"],
  Haraka: ["Haraka"],
  SQL: ["Apache","Tomcat"],
  HTTPSRFI: ["Tomcat"],
  HTTPRFI: ["Apache"],
  Eternal: ["SMSS"],
  Keep: ["Svchost"],
  Brute: ["SSHD"],
};

const AGENT_LOCKOUT = {
  red:  { sleep:0, remote:0, network:0, exploit:0, escalate:0, impact:0 },
  blue: { sleep:0, analyse:0, decoy:0, remove:0, restore:0 },
};

const HOST_LOCKOUT = {
  red:  { sleep:0, remote:0, network:0, exploit:0, escalate:0, impact:0 },
  blue: { sleep:0, analyse:0, decoy:0, remove:0, restore:0 },
};

export const CAGE2_200_PRESET = {
  name: "2.0x CAGE-2",

  ...buildStateFromFlat({
    entities:       ENTITIES,
    connectedHosts: CONNECTED_HOSTS,
    redStart:       "user0",
    target:         "opserv",
    rules:          RULES,
    positions:      POSITIONS,
  }),

  redActions:  [...RED_ACTIONS],
  blueActions: [...BLUE_ACTIONS],

  exploits:        [...EXPLOITS],
  decoys:          [...DECOYS],
  exploitOutcomes: { ...EXPLOIT_OUTCOMES },
  exploitDecoyMap: { ...EXPLOIT_DECOY_MAP },

  exploitPrio:    0.75,
  exploitObs:     0.95,
  removeSuccess:  1.0,
  restoreSuccess: 1.0,
  restoreResetsDecoys: false,
  numSubnets:     3,

  agentLockout: AGENT_LOCKOUT,
  hostLockout:  HOST_LOCKOUT,

  rewardedExploits: ENTITIES.map(() => []),
  hostPriority:     ENTITIES.map(e => e.priority),
};