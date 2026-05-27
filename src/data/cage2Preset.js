// ─── Data Constants ───────────────────────────────────────────────
const CAGE2_EXPLOITS = ["FTP","Haraka","SQL","HTTPSRFI","HTTPRFI","Eternal","Keep","Brute"];
const CAGE2_DECOYS = ["Femitter","Vsftpd","Apache","Haraka","SSHD","SMSS","Tomcat","Svchost"];
const CAGE2_RED_ACTIONS = ["sleep","remote","network","exploit","escalate","impact"];
const CAGE2_BLUE_ACTIONS = ["sleep","analyse","decoy","remove","restore"];
const EXPLOIT_OUTCOMES = {FTP:"root",Haraka:"root",SQL:"root",HTTPSRFI:"user",HTTPRFI:"user",Eternal:"root",Keep:"user",Brute:"user"};

export const CAGE2_PRESET = {
  name: "CAGE-2 Original",
  redActions: [...CAGE2_RED_ACTIONS],
  blueActions: [...CAGE2_BLUE_ACTIONS],
  exploits: [...CAGE2_EXPLOITS],
  decoys: [...CAGE2_DECOYS],
  exploitOutcomes: {...EXPLOIT_OUTCOMES},
  zones: [
    { id: "z0", name: "User Subnet", color: "#3B8BD4", x: 60, y: 30 },
    { id: "z1", name: "Enterprise Subnet", color: "#1D9E75", x: 340, y: 30 },
    { id: "z2", name: "Operational Subnet", color: "#D85A30", x: 620, y: 30 },
  ],
  hosts: [
    { id: "h_def",     name: "def",     type: "server", zoneId: "z1", services: ["Brute"], decoys: [],                x: 350, y: 100 },
    { id: "h_ent0",    name: "ent0",    type: "host",   zoneId: "z1", services: ["Brute"], decoys: ["Haraka","Tomcat","Vsftpd","Apache"],               x: 450, y: 100 },
    { id: "h_ent1",    name: "ent1",    type: "host",   zoneId: "z1", services: ["Brute","Eternal","Keep","HTTPRFI","HTTPSRFI"], decoys: ["Femitter"], x: 350, y: 170 },
    { id: "h_ent2",    name: "ent2",    type: "host",   zoneId: "z1", services: ["Brute","Eternal","Keep","HTTPRFI","HTTPSRFI"], decoys: ["Femitter"], x: 450, y: 170 },
    { id: "h_ophost0", name: "ophost0", type: "host",   zoneId: "z2", services: ["Brute"], decoys: [],                x: 630, y: 100 },
    { id: "h_ophost1", name: "ophost1", type: "host",   zoneId: "z2", services: ["Brute"], decoys: [],                x: 730, y: 100 },
    { id: "h_ophost2", name: "ophost2", type: "host",   zoneId: "z2", services: ["Brute"], decoys: [],                x: 630, y: 170 },
    { id: "h_opserv",  name: "opserv",  type: "server", zoneId: "z2", services: ["Brute"], decoys: ["Haraka","Apache","Tomcat","Vsftpd"],               x: 730, y: 170 },
    { id: "h_user0",   name: "user0",   type: "host",   zoneId: "z0", services: [], decoys: [],                       x: 50, y: 100 },
    { id: "h_user1",   name: "user1",   type: "host",   zoneId: "z0", services: ["Brute","FTP"], decoys: ["Apache","Tomcat","SMSS","Svchost"],      x: 150, y: 100 },
    { id: "h_user2",   name: "user2",   type: "host",   zoneId: "z0", services: ["Eternal","Keep"], decoys: ["Femitter","Tomcat","Apache","SSHD"], x: 50, y: 170 },
    { id: "h_user3",   name: "user3",   type: "host",   zoneId: "z0", services: ["Keep","HTTPSRFI","HTTPRFI","Haraka"], decoys: ["Vsftpd","SSHD"],   x: 150, y: 170 },
    { id: "h_user4",   name: "user4",   type: "host",   zoneId: "z0", services: ["Keep","HTTPSRFI","HTTPRFI","Haraka","SQL"], decoys: ["Vsftpd"],   x: 100, y: 240 },
  ],
  zoneConnections: [
    { from: "z0", to: "z1" },
    { from: "z1", to: "z2" },
  ],
  attackPaths: [
    { from: "h_ent0", to: "h_ent2" },
    { from: "h_ent1", to: "h_ent2" },
    { from: "h_ent2", to: "h_opserv" },
    { from: "h_user1", to: "h_ent0" },
    { from: "h_user2", to: "h_ent0" },
    { from: "h_user3", to: "h_ent1" },
    { from: "h_user4", to: "h_ent1" },
  ],
};

export function makeEmpty() {
  return {
    name: "Custom",
    redActions: [...CAGE2_RED_ACTIONS],
    blueActions: [...CAGE2_BLUE_ACTIONS],
    exploits: [...CAGE2_EXPLOITS],
    decoys: [...CAGE2_DECOYS],
    exploitOutcomes: {...EXPLOIT_OUTCOMES},
    zones: [],
    hosts: [],
    zoneConnections: [],
    attackPaths: [],
  };
}