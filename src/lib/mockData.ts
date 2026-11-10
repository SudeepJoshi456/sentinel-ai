import type { ActionId, Category, Severity, Source } from "./types";
import { pick, randInt, type Rng } from "./random";

export const ANALYSTS = ["Sarah Kim", "Marcus Chen", "Priya Patel", "Diego Alvarez"] as const;
export const REVIEWERS = ["Marcus Chen", "Priya Patel", "Diego Alvarez"] as const;

const USERS = ["j.alvarez", "m.chen", "a.okafor", "l.nguyen", "r.patel", "t.brooks", "k.schmidt", "e.rossi", "d.kim", "s.haddad"];
const HOSTS = ["WS-FIN-0142", "LT-ENG-2231", "LT-MKT-0917", "SRV-DB-07", "WS-HR-0388", "LT-EXEC-0012", "SRV-APP-14", "WS-OPS-0559"];
const FILES = ["invoice_Q3.xlsm", "scan_0921.pdf.exe", "payroll_update.docm", "setup_x64.msi", "shipping_label.zip"];
const PHISH_DOMAINS = ["m1crosoft-verify.com", "okta-sso-login.net", "docusign-secure.co", "payroll-portal.io", "sharepoint-files.app"];
const COUNTRIES = ["Lagos, NG", "Bucharest, RO", "São Paulo, BR", "Hanoi, VN", "Kyiv, UA"];

const externalIp = (rng: Rng) =>
  `${pick(rng, [185, 45, 194, 91, 103, 212])}.${randInt(rng, 10, 250)}.${randInt(rng, 1, 254)}.${randInt(rng, 2, 254)}`;

/**
 * A simulated security event plus hidden ground truth: the real category and how likely
 * each response is to be judged correct by an analyst. The bandit never sees `probs`
 * directly; it only learns from sampled feedback.
 */
export interface EventSpec {
  description: string;
  source: Source;
  trueCategory: Category;
  severity: Severity;
  confRange: [number, number];
  reasoning: string;
  target: string;
  probs: Partial<Record<ActionId, number>>;
}

/** Success probability for actions an event doesn't list (e.g. after a misclassification). */
export const DEFAULT_PROB: Partial<Record<ActionId, number>> = { escalate: 0.55, watchlist: 0.2 };
export const OTHER_ACTION_PROB = 0.08;

export const trueProb = (probs: Partial<Record<ActionId, number>>, action: ActionId) =>
  probs[action] ?? DEFAULT_PROB[action] ?? OTHER_ACTION_PROB;

interface Template {
  weight: number;
  build: (rng: Rng) => EventSpec;
}

const TEMPLATES: Template[] = [
  {
    weight: 1,
    build: (rng) => {
      const user = pick(rng, USERS);
      const where = pick(rng, COUNTRIES);
      return {
        description: `Impossible-travel sign-in for ${user}@corp — ${where} 14 min after Chicago, US`,
        source: "Identity provider",
        trueCategory: "PHISHING",
        severity: "HIGH",
        confRange: [87, 94],
        reasoning: `Sign-in geolocation (${where}) is physically unreachable from the previous session, and the token reuse pattern matches session hijacking after credential phishing.`,
        target: `${user}@corp · all active tokens`,
        probs: { revoke_session: 0.9, reset_credentials: 0.8, escalate: 0.7, quarantine_email: 0.1, watchlist: 0.25 },
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
        trueCategory: "PHISHING",
        severity: "HIGH",
        confRange: [93, 98.5],
        reasoning: `Lookalike sender domain (${domain}, registered 3 days ago), urgent password-reset language, and a link to a non-Microsoft login page. Classic credential-harvesting pattern.`,
        target: `${n} mailboxes · ${domain}`,
        probs: { quarantine_email: 0.95, escalate: 0.6, reset_credentials: 0.4, revoke_session: 0.3, watchlist: 0.15 },
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
        trueCategory: "PHISHING",
        severity: "HIGH",
        confRange: [88, 95],
        reasoning: `A burst of denied push notifications indicates an MFA-fatigue attack; the attacker likely already holds the password.`,
        target: `${user}@corp · MFA fatigue`,
        probs: { reset_credentials: 0.88, revoke_session: 0.8, escalate: 0.75, watchlist: 0.2, quarantine_email: 0.05 },
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
        trueCategory: "MALWARE",
        severity: "CRITICAL",
        confRange: [95, 99.2],
        reasoning: `File hash matches a known Emotet loader family and the process attempted to write a Run registry key for persistence.`,
        target: `${host} · ${file}`,
        probs: { isolate_host: 0.96, escalate: 0.65, block_ip: 0.35, watchlist: 0.1 },
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
        trueCategory: "MALWARE",
        severity: "HIGH",
        confRange: [84, 92],
        reasoning: `An Office application spawning powershell.exe with a base64-encoded payload is a strong macro-dropper indicator, though no network calls have been observed yet.`,
        target: `${host} · powershell.exe -enc`,
        probs: { escalate: 0.85, isolate_host: 0.8, watchlist: 0.3, block_ip: 0.2 },
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
        trueCategory: "MALWARE",
        severity: "CRITICAL",
        confRange: [92, 97.5],
        reasoning: `Fixed-interval TLS connections with low jitter to an IP listed on two threat-intel feeds. Timing is consistent with Cobalt Strike default profiles.`,
        target: `${ip} · ${host}`,
        probs: { block_ip: 0.94, isolate_host: 0.85, escalate: 0.6, watchlist: 0.15 },
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
        trueCategory: "MALWARE",
        severity: "CRITICAL",
        confRange: [96.5, 99.5],
        reasoning: `High-entropy writes and extension changes across thousands of files match ransomware encryption behavior.`,
        target: `${host} · ransomware behavior`,
        probs: { isolate_host: 0.99, escalate: 0.5, block_ip: 0.2, watchlist: 0.02 },
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
        trueCategory: "POLICY VIOLATION",
        severity: "MEDIUM",
        confRange: [82, 91],
        reasoning: `Bulk upload of classified documents to an unsanctioned cloud service by a user with an active resignation flag — an insider-risk pattern.`,
        target: `${user}@corp · ${n} files`,
        probs: { escalate: 0.9, block_transfer: 0.7, watchlist: 0.3 },
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
        trueCategory: "POLICY VIOLATION",
        severity: "HIGH",
        confRange: [90, 96],
        reasoning: `Removable-media policy forbids unencrypted devices; content inspection matched 212 records with PII patterns.`,
        target: `${host} · USB VID 0781`,
        probs: { block_transfer: 0.95, escalate: 0.7, watchlist: 0.15 },
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
        trueCategory: "POLICY VIOLATION",
        severity: "MEDIUM",
        confRange: [88, 95],
        reasoning: `Attachments matched the SSN detector with high confidence and the recipient is an external consumer domain.`,
        target: `${user}@corp → gmail.com`,
        probs: { block_transfer: 0.92, escalate: 0.7, watchlist: 0.2 },
      };
    },
  },
  {
    weight: 3,
    build: (rng) => ({
      description: `Port scan from internal vulnerability scanner 10.0.4.12 across 10.0.${randInt(rng, 2, 30)}.0/24`,
      source: "Network sensor",
      trueCategory: "BENIGN",
      severity: "LOW",
      confRange: [96, 99.5],
      reasoning: `Source is the registered Nessus scanner and the scan falls inside its approved maintenance window.`,
      target: "10.0.4.12 · approved scanner",
      probs: { close_benign: 0.97, watchlist: 0.5, escalate: 0.3, block_ip: 0.05 },
    }),
  },
  {
    weight: 2,
    build: (rng) => ({
      description: `Scheduled backup job generated ${randInt(rng, 18, 64)} GB outbound transfer to AWS S3`,
      source: "Network sensor",
      trueCategory: "BENIGN",
      severity: "LOW",
      confRange: [95, 99],
      reasoning: `Destination bucket and service account match the nightly backup job definition; volume is within the 30-day baseline.`,
      target: "svc-backup · s3://corp-backups",
      probs: { close_benign: 0.96, watchlist: 0.45, escalate: 0.25 },
    }),
  },
  {
    weight: 2,
    build: (rng) => {
      const user = pick(rng, USERS);
      return {
        description: `3 failed logins for ${user}@corp followed by successful self-service password reset`,
        source: "Identity provider",
        trueCategory: "BENIGN",
        severity: "LOW",
        confRange: [92, 97],
        reasoning: `Failures came from the user's known device and IP, followed by a verified SSO reset — consistent with a forgotten password, not credential stuffing.`,
        target: `${user}@corp · known device`,
        probs: { close_benign: 0.93, watchlist: 0.55, escalate: 0.3 },
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
        trueCategory: "MALWARE",
        severity: "MEDIUM",
        confRange: [74, 84],
        reasoning: `The domain is 2 days old with no reputation yet; the query pattern could be DGA activity or a new SaaS tool.`,
        target: `${host} · DNS anomaly`,
        probs: { watchlist: 0.85, escalate: 0.6, block_ip: 0.55, isolate_host: 0.2 },
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
        trueCategory: "POLICY VIOLATION",
        severity: "MEDIUM",
        confRange: [76, 86],
        reasoning: `The privilege change lacks a matching change ticket but was performed by an authorized IT admin.`,
        target: `${user}@corp · role change`,
        probs: { watchlist: 0.8, escalate: 0.75, block_transfer: 0.1 },
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
        trueCategory: "PHISHING",
        severity: "HIGH",
        confRange: [91, 97],
        reasoning: `Proxy logs show a POST to a known phishing-kit endpoint seconds after the click, so the password should be considered exposed.`,
        target: `${user}@corp · ${domain}`,
        probs: { reset_credentials: 0.95, revoke_session: 0.85, escalate: 0.7, quarantine_email: 0.5, watchlist: 0.1 },
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
        trueCategory: "BENIGN",
        severity: "LOW",
        confRange: [91, 96],
        reasoning: `The binary is signed by a trusted vendor certificate and matches the published hash for the latest release — a known false-positive pattern.`,
        target: `${host} · vendor updater`,
        probs: { close_benign: 0.92, watchlist: 0.5, escalate: 0.35 },
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
        trueCategory: "MALWARE",
        severity: "HIGH",
        confRange: [93, 98],
        reasoning: `The source IP is a listed Tor exit node attempting sequential usernames against an exposed RDP gateway.`,
        target: `${ip} · Tor exit node`,
        probs: { block_ip: 0.96, escalate: 0.6, isolate_host: 0.3, watchlist: 0.2 },
      };
    },
  },
  // Employee-submitted reports, so the policy has history for the "User report" contexts.
  {
    weight: 1,
    build: (rng) => ({
      description: `Employee reported a password-reset email from an unfamiliar sender (${pick(rng, PHISH_DOMAINS)})`,
      source: "User report",
      trueCategory: "PHISHING",
      severity: "HIGH",
      confRange: [90, 96],
      reasoning: `Reporter describes an unsolicited credential-reset request from an unknown domain — a common phishing lure.`,
      target: "Reported message · sender domain",
      probs: { quarantine_email: 0.93, escalate: 0.65, reset_credentials: 0.45, revoke_session: 0.3, watchlist: 0.15 },
    }),
  },
  {
    weight: 1,
    build: (rng) => ({
      description: `Employee reported pop-ups and slowness on ${pick(rng, HOSTS)} after opening a downloaded file`,
      source: "User report",
      trueCategory: "MALWARE",
      severity: "HIGH",
      confRange: [86, 94],
      reasoning: `Symptoms began right after executing a downloaded file, consistent with adware or a malware dropper.`,
      target: "Reporter's workstation",
      probs: { isolate_host: 0.92, escalate: 0.7, block_ip: 0.25, watchlist: 0.15 },
    }),
  },
  {
    weight: 1,
    build: () => ({
      description: `Employee reported a coworker copying confidential customer files to a personal account`,
      source: "User report",
      trueCategory: "POLICY VIOLATION",
      severity: "HIGH",
      confRange: [84, 91],
      reasoning: `Report names an individual moving classified data to an unsanctioned destination — requires insider-risk handling.`,
      target: "Reported user · personal cloud storage",
      probs: { escalate: 0.92, block_transfer: 0.7, watchlist: 0.25 },
    }),
  },
];

const TOTAL_WEIGHT = TEMPLATES.reduce((s, t) => s + t.weight, 0);

export function randomEvent(rng: Rng): EventSpec {
  let r = rng() * TOTAL_WEIGHT;
  for (const t of TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t.build(rng);
  }
  return TEMPLATES[0].build(rng);
}

/**
 * Plausible ground truth for presenter-submitted reports, keyed by the predicted category,
 * used only for the simulated analyst; reports are excluded from evaluation metrics.
 */
export const REPORT_PROBS: Record<Category, Partial<Record<ActionId, number>>> = {
  PHISHING: { quarantine_email: 0.93, escalate: 0.65, reset_credentials: 0.5, revoke_session: 0.3, watchlist: 0.15 },
  MALWARE: { isolate_host: 0.92, escalate: 0.7, block_ip: 0.25, watchlist: 0.15 },
  "POLICY VIOLATION": { escalate: 0.92, block_transfer: 0.7, watchlist: 0.25 },
  BENIGN: { watchlist: 0.8, close_benign: 0.6, escalate: 0.5 },
};

export const formatTicketId = (num: number) => `SEC-${num}`;
