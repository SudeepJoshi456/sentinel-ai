import type { ActionLogEntry, Ticket, TicketDraft } from "./types";
import { mulberry32, pick, randFloat, randInt, round1, type Rng } from "./random";

export const ANALYSTS = ["Sarah Kim", "Marcus Chen", "Priya Patel", "Diego Alvarez"] as const;

const USERS = ["j.alvarez", "m.chen", "a.okafor", "l.nguyen", "r.patel", "t.brooks", "k.schmidt", "e.rossi", "d.kim", "s.haddad"];
const HOSTS = ["WS-FIN-0142", "LT-ENG-2231", "LT-MKT-0917", "SRV-DB-07", "WS-HR-0388", "LT-EXEC-0012", "SRV-APP-14", "WS-OPS-0559"];
const FILES = ["invoice_Q3.xlsm", "scan_0921.pdf.exe", "payroll_update.docm", "setup_x64.msi", "shipping_label.zip"];
const PHISH_DOMAINS = ["m1crosoft-verify.com", "okta-sso-login.net", "docusign-secure.co", "payroll-portal.io", "sharepoint-files.app"];
const COUNTRIES = ["Lagos, NG", "Bucharest, RO", "São Paulo, BR", "Hanoi, VN", "Kyiv, UA"];

const externalIp = (rng: Rng) =>
  `${pick(rng, [185, 45, 194, 91, 103, 212])}.${randInt(rng, 10, 250)}.${randInt(rng, 1, 254)}.${randInt(rng, 2, 254)}`;

const conf = (rng: Rng, min: number, max: number) => round1(randFloat(rng, min, max));
const reward = (rng: Rng, min = 0.72, max = 0.94) => Math.round(randFloat(rng, min, max) * 100) / 100;

interface Template {
  weight: number;
  build: (rng: Rng) => TicketDraft;
}

/**
 * Pool of realistic events. Weights keep automated outcomes (REMEDIATED / AUTO-RESOLVED)
 * slightly above the seeded auto-resolve rate so that stat drifts upward during a demo.
 */
const TEMPLATES: Template[] = [
  {
    weight: 1,
    build: (rng) => {
      const user = pick(rng, USERS);
      const where = pick(rng, COUNTRIES);
      return {
        description: `Impossible-travel sign-in for ${user}@corp — ${where} 14 min after Chicago, US`,
        source: "Identity provider",
        category: "PHISHING",
        severity: "HIGH",
        decision: "ESCALATED",
        confidence: conf(rng, 87, 94),
        reasoning: `Sign-in geolocation (${where}) is physically unreachable from the previous session. Token reuse pattern matches session-hijack after credential phishing. Recommend analyst verification before account lockout.`,
        actionName: "Revoked session",
        actionDetail: `${user}@corp · all active tokens`,
        expectedReward: reward(rng),
        assignee: pick(rng, ANALYSTS),
      };
    },
  },
  {
    weight: 3,
    build: (rng) => {
      const n = randInt(rng, 6, 48);
      const domain = pick(rng, PHISH_DOMAINS);
      return {
        description: `Credential-harvesting email impersonating Microsoft 365 delivered to ${n} mailboxes from ${domain}`,
        source: "Email gateway",
        category: "PHISHING",
        severity: "HIGH",
        decision: "REMEDIATED",
        confidence: conf(rng, 93, 98.5),
        reasoning: `Lookalike sender domain (${domain}, registered 3 days ago), urgent password-reset language, and a link to a non-Microsoft login page. Classic credential-harvesting pattern.`,
        actionName: "Quarantined email",
        actionDetail: `${n} mailboxes · ${domain}`,
        expectedReward: reward(rng, 0.85, 0.96),
      };
    },
  },
  {
    weight: 1,
    build: (rng) => {
      const user = pick(rng, USERS);
      const n = randInt(rng, 9, 27);
      return {
        description: `${n} MFA push requests denied for ${user}@corp within 5 minutes`,
        source: "Identity provider",
        category: "PHISHING",
        severity: "HIGH",
        decision: "ESCALATED",
        confidence: conf(rng, 88, 95),
        reasoning: `Burst of denied push notifications indicates an MFA-fatigue attack; the attacker likely already holds the password. Escalating so an analyst can confirm with the user and force a credential reset.`,
        actionName: "Escalated ticket",
        actionDetail: `${user}@corp · MFA fatigue`,
        expectedReward: reward(rng),
        assignee: pick(rng, ANALYSTS),
      };
    },
  },
  {
    weight: 3,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      const file = pick(rng, FILES);
      return {
        description: `Emotet loader signature detected in ${file} on ${host}`,
        source: "EDR / endpoint",
        category: "MALWARE",
        severity: "CRITICAL",
        decision: "REMEDIATED",
        confidence: conf(rng, 95, 99.2),
        reasoning: `File hash matches a known Emotet loader family and the process attempted to write to a Run registry key for persistence. Host isolation prevents lateral movement.`,
        actionName: "Isolated host",
        actionDetail: `${host} · ${file}`,
        expectedReward: reward(rng, 0.88, 0.97),
      };
    },
  },
  {
    weight: 1,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      return {
        description: `Encoded PowerShell command spawned by WINWORD.EXE on ${host}`,
        source: "EDR / endpoint",
        category: "MALWARE",
        severity: "HIGH",
        decision: "ESCALATED",
        confidence: conf(rng, 84, 92),
        reasoning: `Office application spawning powershell.exe with a base64-encoded payload is a strong macro-dropper indicator, but the payload has not yet executed network calls. Analyst review requested.`,
        actionName: "Escalated ticket",
        actionDetail: `${host} · powershell.exe -enc`,
        expectedReward: reward(rng),
        assignee: pick(rng, ANALYSTS),
      };
    },
  },
  {
    weight: 3,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      const ip = externalIp(rng);
      return {
        description: `Suspicious outbound beaconing to ${ip}:443 from ${host} every 60s`,
        source: "Network sensor",
        category: "MALWARE",
        severity: "CRITICAL",
        decision: "REMEDIATED",
        confidence: conf(rng, 92, 97.5),
        reasoning: `Fixed-interval TLS connections with low jitter to an IP on two threat-intel feeds. Beacon timing is consistent with Cobalt Strike default profiles.`,
        actionName: "Blocked IP",
        actionDetail: `${ip} · perimeter firewall`,
        expectedReward: reward(rng, 0.84, 0.95),
      };
    },
  },
  {
    weight: 2,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      const n = randInt(rng, 800, 2400);
      return {
        description: `Mass file rename (*.locked) — ${n.toLocaleString("en-US")} files in 90s on ${host}`,
        source: "EDR / endpoint",
        category: "MALWARE",
        severity: "CRITICAL",
        decision: "REMEDIATED",
        confidence: conf(rng, 96.5, 99.5),
        reasoning: `High-entropy writes and extension changes across thousands of files match ransomware encryption behavior. Immediate isolation is the highest-reward action for this context.`,
        actionName: "Isolated host",
        actionDetail: `${host} · ransomware behavior`,
        expectedReward: reward(rng, 0.9, 0.98),
      };
    },
  },
  {
    weight: 1,
    build: (rng) => {
      const user = pick(rng, USERS);
      const n = randInt(rng, 12, 140);
      return {
        description: `${n} files tagged Confidential uploaded to personal Dropbox by ${user}@corp`,
        source: "DLP monitor",
        category: "POLICY VIOLATION",
        severity: "MEDIUM",
        decision: "ESCALATED",
        confidence: conf(rng, 82, 91),
        reasoning: `Bulk upload of classified documents to an unsanctioned cloud service. User has an active resignation flag in HR system — insider-risk context requires human judgment.`,
        actionName: "Escalated ticket",
        actionDetail: `${user}@corp · ${n} files`,
        expectedReward: reward(rng, 0.7, 0.88),
        assignee: pick(rng, ANALYSTS),
      };
    },
  },
  {
    weight: 2,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      return {
        description: `Unencrypted USB mass-storage device mounted on ${host}; customer PII copy attempted`,
        source: "DLP monitor",
        category: "POLICY VIOLATION",
        severity: "HIGH",
        decision: "REMEDIATED",
        confidence: conf(rng, 90, 96),
        reasoning: `Removable-media policy forbids unencrypted devices; content inspection matched 212 records with PII patterns. Blocking the device is a low-risk, high-reward action.`,
        actionName: "Blocked device",
        actionDetail: `${host} · USB VID 0781`,
        expectedReward: reward(rng, 0.82, 0.94),
      };
    },
  },
  {
    weight: 2,
    build: (rng) => {
      const user = pick(rng, USERS);
      return {
        description: `Outbound email to personal Gmail with 3 attachments containing SSNs from ${user}@corp`,
        source: "DLP monitor",
        category: "POLICY VIOLATION",
        severity: "MEDIUM",
        decision: "REMEDIATED",
        confidence: conf(rng, 88, 95),
        reasoning: `Attachments matched the SSN detector with high confidence and the recipient is an external consumer domain. Message was held and the sender notified.`,
        actionName: "Blocked email",
        actionDetail: `${user}@corp → gmail.com`,
        expectedReward: reward(rng),
      };
    },
  },
  {
    weight: 3,
    build: (rng) => ({
      description: `Port scan from internal vulnerability scanner 10.0.4.12 across 10.0.${randInt(rng, 2, 30)}.0/24`,
      source: "Network sensor",
      category: "BENIGN",
      severity: "LOW",
      decision: "AUTO-RESOLVED",
      confidence: conf(rng, 96, 99.5),
      reasoning: `Source is the registered Nessus scanner and the scan falls inside its approved maintenance window. No action required.`,
      actionName: "Closed as benign",
      actionDetail: "10.0.4.12 · approved scanner",
      expectedReward: reward(rng, 0.9, 0.98),
    }),
  },
  {
    weight: 2,
    build: (rng) => ({
      description: `Scheduled backup job generated ${randInt(rng, 18, 64)} GB outbound transfer to AWS S3`,
      source: "Network sensor",
      category: "BENIGN",
      severity: "LOW",
      decision: "AUTO-RESOLVED",
      confidence: conf(rng, 95, 99),
      reasoning: `Destination bucket and service account match the nightly backup job definition. Volume is within the 30-day baseline.`,
      actionName: "Closed as benign",
      actionDetail: "svc-backup · s3://corp-backups",
      expectedReward: reward(rng, 0.88, 0.97),
    }),
  },
  {
    weight: 2,
    build: (rng) => {
      const user = pick(rng, USERS);
      return {
        description: `3 failed logins for ${user}@corp followed by successful self-service password reset`,
        source: "Identity provider",
        category: "BENIGN",
        severity: "LOW",
        decision: "AUTO-RESOLVED",
        confidence: conf(rng, 92, 97),
        reasoning: `Failures originated from the user's known device and IP, followed by a verified SSO reset. Consistent with a forgotten password, not credential stuffing.`,
        actionName: "Closed as benign",
        actionDetail: `${user}@corp · known device`,
        expectedReward: reward(rng, 0.85, 0.95),
      };
    },
  },
  {
    weight: 1,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      return {
        description: `Unusual DNS query volume to newly registered domain from ${host}`,
        source: "Network sensor",
        category: "MALWARE",
        severity: "MEDIUM",
        decision: "MONITORING",
        confidence: conf(rng, 74, 84),
        reasoning: `Domain is 2 days old with no reputation yet; query pattern could be DGA activity or a new SaaS tool. Adding host to watchlist while more telemetry accumulates.`,
        actionName: "Added to watchlist",
        actionDetail: `${host} · DNS anomaly`,
        expectedReward: reward(rng, 0.6, 0.78),
      };
    },
  },
  {
    weight: 1,
    build: (rng) => {
      const user = pick(rng, USERS);
      return {
        description: `Global admin role granted to ${user}@corp outside approved change window`,
        source: "Identity provider",
        category: "POLICY VIOLATION",
        severity: "MEDIUM",
        decision: "MONITORING",
        confidence: conf(rng, 76, 86),
        reasoning: `Privilege change lacks a matching change ticket but was performed by an authorized IT admin. Monitoring for follow-on privileged activity.`,
        actionName: "Added to watchlist",
        actionDetail: `${user}@corp · role change`,
        expectedReward: reward(rng, 0.62, 0.8),
      };
    },
  },
  {
    weight: 2,
    build: (rng) => {
      const user = pick(rng, USERS);
      const domain = pick(rng, PHISH_DOMAINS);
      return {
        description: `User ${user}@corp clicked link in phishing email and submitted credentials to ${domain}`,
        source: "Email gateway",
        category: "PHISHING",
        severity: "HIGH",
        decision: "REMEDIATED",
        confidence: conf(rng, 91, 97),
        reasoning: `Proxy logs show a POST to a known phishing kit endpoint seconds after the click. Forcing a credential reset and revoking sessions contains the exposure.`,
        actionName: "Reset credentials",
        actionDetail: `${user}@corp · ${domain}`,
        expectedReward: reward(rng, 0.86, 0.96),
      };
    },
  },
  {
    weight: 2,
    build: (rng) => {
      const host = pick(rng, HOSTS);
      return {
        description: `Defender heuristic alert on signed vendor updater binary on ${host}`,
        source: "EDR / endpoint",
        category: "BENIGN",
        severity: "LOW",
        decision: "AUTO-RESOLVED",
        confidence: conf(rng, 91, 96),
        reasoning: `Binary is signed by a trusted vendor certificate and matches the hash published for the latest release. Known false-positive pattern after signature updates.`,
        actionName: "Closed as false positive",
        actionDetail: `${host} · vendor updater`,
        expectedReward: reward(rng, 0.84, 0.94),
      };
    },
  },
  {
    weight: 2,
    build: (rng) => {
      const ip = externalIp(rng);
      return {
        description: `RDP brute-force attempts (${randInt(rng, 300, 1800)}) from Tor exit node ${ip}`,
        source: "Network sensor",
        category: "MALWARE",
        severity: "HIGH",
        decision: "REMEDIATED",
        confidence: conf(rng, 93, 98),
        reasoning: `Source IP is a listed Tor exit node attempting sequential usernames against an exposed RDP gateway. Blocking at the perimeter has near-zero business impact.`,
        actionName: "Blocked IP",
        actionDetail: `${ip} · Tor exit node`,
        expectedReward: reward(rng, 0.88, 0.97),
      };
    },
  },
];

const TOTAL_WEIGHT = TEMPLATES.reduce((s, t) => s + t.weight, 0);

export function randomDraft(rng: Rng = Math.random): TicketDraft {
  let r = rng() * TOTAL_WEIGHT;
  for (const t of TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t.build(rng);
  }
  return TEMPLATES[0].build(rng);
}

export const formatTicketId = (num: number) => `SEC-${num}`;

/** Fixed template order so the opening screen shows a good mix of categories. */
const SEED_ORDER = [3, 1, 7, 10, 2, 5, 13, 0, 11, 8, 6, 16, 4, 15];
const SEED_MINUTES_AGO = [1, 2, 4, 6, 8, 11, 13, 15, 17, 19, 22, 24, 27, 29];
export const SEED_FIRST_NUM = 4812;

export function buildSeedTickets(now: number): Ticket[] {
  const rng = mulberry32(20260929);
  const count = SEED_ORDER.length;
  return SEED_ORDER.map((templateIdx, i) => {
    const num = SEED_FIRST_NUM + count - 1 - i;
    return {
      ...TEMPLATES[templateIdx].build(rng),
      id: formatTicketId(num),
      num,
      createdAt: now - SEED_MINUTES_AGO[i] * 60_000 - Math.floor(rng() * 40_000),
    };
  });
}

export function actionFromTicket(t: Ticket, createdAt = t.createdAt): ActionLogEntry | null {
  if (t.decision === "MONITORING") return null;
  const isAnalyst = t.decision === "ESCALATED";
  return {
    id: `act-${t.id}-${createdAt}`,
    ticketId: t.id,
    name: t.actionName,
    detail: t.actionDetail,
    createdAt,
    kind: isAnalyst ? "ANALYST" : "AUTOMATED",
    analyst: isAnalyst ? t.assignee : undefined,
  };
}

/** Accuracy curve for the session so far: noisy but trending upward into the low 90s. */
export const SEED_ACCURACY_START = 90.1;
export const SEED_ACCURACY_END = 94.2;

export function buildSeedPerformance(now: number, points = 24, stepMs = 2 * 60_000) {
  const rng = mulberry32(7);
  const out: { t: number; accuracy: number }[] = [];
  const span = SEED_ACCURACY_END - SEED_ACCURACY_START;
  for (let i = 0; i < points; i++) {
    const progress = Math.pow(i / (points - 1), 0.75);
    const noise = i === 0 || i === points - 1 ? 0 : randFloat(rng, -0.35, 0.35);
    out.push({
      t: now - (points - 1 - i) * stepMs,
      accuracy: round1(SEED_ACCURACY_START + span * progress + noise),
    });
  }
  return out;
}
