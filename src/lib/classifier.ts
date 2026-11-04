import type { Category, Decision, Severity, TicketDraft } from "./types";
import { hashString, mulberry32, randFloat, round1 } from "./random";

interface Rule {
  category: Exclude<Category, "BENIGN">;
  keywords: string[];
}

const RULES: Rule[] = [
  {
    category: "MALWARE",
    keywords: [
      "malware", "virus", "ransomware", "trojan", "infected", "download", "downloaded", "file",
      "exe", "attachment", "popup", "pop-up", "encrypted", "locked", "slow", "crash", "antivirus",
      "usb stick", "macro", "strange program", "weird program", "c2", "beacon",
    ],
  },
  {
    category: "PHISHING",
    keywords: [
      "email", "e-mail", "password", "login", "log in", "sign in", "sign-in", "reset", "credential",
      "link", "phish", "unfamiliar address", "sender", "verify", "account", "mfa", "2fa",
      "text message", "sms", "gift card", "invoice", "urgent", "ceo", "impersonat", "spoof",
    ],
  },
  {
    category: "POLICY VIOLATION",
    keywords: [
      "dropbox", "google drive", "personal", "upload", "uploaded", "usb", "copied", "copying",
      "confidential", "leak", "shared", "sharing", "customer data", "pii", "unapproved",
      "unauthorized software", "torrent", "policy",
    ],
  },
];

interface Outcome {
  severity: Severity;
  decision: Decision;
  actionName: string;
  actionDetail: string;
  confRange: [number, number];
  rationale: string;
}

function outcomeFor(category: Category, text: string): Outcome {
  const has = (...words: string[]) => words.some((w) => text.includes(w));

  switch (category) {
    case "MALWARE":
      if (has("ransom", "encrypted", "locked", "all my files")) {
        return {
          severity: "CRITICAL",
          decision: "REMEDIATED",
          actionName: "Isolated host",
          actionDetail: "Reporter's workstation · ransomware playbook",
          confRange: [95, 98.5],
          rationale: "Language indicates active file encryption. Immediate host isolation has the highest expected reward.",
        };
      }
      return {
        severity: "HIGH",
        decision: "REMEDIATED",
        actionName: "Isolated host",
        actionDetail: "Reporter's workstation · EDR scan queued",
        confRange: [89, 95],
        rationale: "Report describes a suspicious file or program execution consistent with a malware dropper. Isolating the endpoint pending a full EDR scan.",
      };
    case "PHISHING":
      if (has("clicked", "entered", "typed my password", "gave", "submitted")) {
        return {
          severity: "CRITICAL",
          decision: "ESCALATED",
          actionName: "Reset credentials",
          actionDetail: "Reporter's account · sessions revoked",
          confRange: [91, 96],
          rationale: "Reporter may have interacted with the lure. Credentials reset automatically and ticket escalated for exposure review.",
        };
      }
      return {
        severity: has("password", "credential", "mfa", "2fa", "login", "log in") ? "HIGH" : "MEDIUM",
        decision: "REMEDIATED",
        actionName: "Quarantined email",
        actionDetail: "Sender blocked · similar messages purged org-wide",
        confRange: [92, 97.5],
        rationale: "Message matches a credential-harvesting lure. Quarantining the email and blocking the sender neutralizes it for all recipients.",
      };
    case "POLICY VIOLATION":
      return {
        severity: has("customer", "pii", "confidential") ? "HIGH" : "MEDIUM",
        decision: "ESCALATED",
        actionName: "Escalated ticket",
        actionDetail: "Routed to insider-risk queue",
        confRange: [84, 91],
        rationale: "Potential data-handling violation involving a named individual. Human judgment is required, so the bandit prefers escalation over automated blocking.",
      };
    default:
      return {
        severity: "LOW",
        decision: "MONITORING",
        actionName: "Added to watchlist",
        actionDetail: "Reporter context captured for correlation",
        confRange: [72, 79],
        rationale: "No known indicators of compromise were found. Logging the report and monitoring for correlated signals.",
      };
  }
}

export interface Classification extends TicketDraft {
  matchedKeywords: string[];
}

/** Simulated LLM classification + bandit action selection for a free-text user report. */
export function classifyReport(rawText: string, assignee: string): Classification {
  const text = rawText.toLowerCase();

  let best: { category: Category; matches: string[] } = { category: "BENIGN", matches: [] };
  for (const rule of RULES) {
    const matches = rule.keywords.filter((k) => text.includes(k));
    if (matches.length > best.matches.length) best = { category: rule.category, matches };
  }

  const outcome = outcomeFor(best.category, text);
  const rng = mulberry32(hashString(text));
  const confidence = round1(randFloat(rng, ...outcome.confRange));
  const expectedReward = Math.round(randFloat(rng, 0.78, 0.95) * 100) / 100;

  const indicators = best.matches.length
    ? `Detected indicators: ${best.matches.slice(0, 4).map((m) => `"${m}"`).join(", ")}. `
    : "";
  const reasoning = `${indicators}Classified as ${best.category.toLowerCase()} (${outcome.severity.toLowerCase()} severity). ${outcome.rationale}`;

  return {
    description: rawText.trim().replace(/\s+/g, " "),
    source: "User report",
    category: best.category,
    severity: outcome.severity,
    decision: outcome.decision,
    confidence,
    reasoning,
    actionName: outcome.actionName,
    actionDetail: outcome.actionDetail,
    expectedReward,
    assignee: outcome.decision === "ESCALATED" ? assignee : undefined,
    matchedKeywords: best.matches,
  };
}
