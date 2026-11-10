import type { Category, Classification, Severity } from "./types";
import type { EventSpec } from "./mockData";
import { hashString, mulberry32, randFloat, round1, type Rng } from "./random";

interface Rule {
  category: Exclude<Category, "BENIGN">;
  keywords: string[];
}

const RULES: Rule[] = [
  {
    category: "MALWARE",
    keywords: [
      "malware", "virus", "ransomware", "trojan", "infected", "download", "downloaded", "file",
      ".exe", "attachment", "popup", "pop-up", "encrypted", "locked", "slow", "crash", "antivirus",
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

interface Profile {
  severity: Severity;
  confRange: [number, number];
  rationale: string;
}

function profileFor(category: Category, text: string): Profile {
  const has = (...words: string[]) => words.some((w) => text.includes(w));
  switch (category) {
    case "MALWARE":
      return has("ransom", "encrypted", "locked", "all my files")
        ? { severity: "CRITICAL", confRange: [95, 98.5], rationale: "Language indicates active file encryption on the reporter's device." }
        : { severity: "HIGH", confRange: [89, 94.5], rationale: "Report describes suspicious file or program execution consistent with a malware dropper." };
    case "PHISHING":
      if (has("clicked", "entered", "typed my password", "gave", "submitted")) {
        return { severity: "CRITICAL", confRange: [91, 96], rationale: "Reporter may have interacted with the lure, so credentials should be treated as exposed." };
      }
      return {
        severity: has("password", "credential", "mfa", "2fa", "login", "log in") ? "HIGH" : "MEDIUM",
        confRange: [92, 97.5],
        rationale: "Message matches a credential-harvesting lure.",
      };
    case "POLICY VIOLATION":
      return {
        severity: has("customer", "pii", "confidential") ? "HIGH" : "MEDIUM",
        confRange: [84, 91],
        rationale: "Potential data-handling violation involving a named individual.",
      };
    default:
      return { severity: "LOW", confRange: [70, 79], rationale: "No known indicators of compromise were found in the description." };
  }
}

/** Offline keyword classifier for free-text reports. Deterministic: same text, same result. */
export function classifyReportRules(text: string): Classification & { matchedKeywords: string[] } {
  const lower = text.toLowerCase();
  let best: { category: Category; matches: string[] } = { category: "BENIGN", matches: [] };
  for (const rule of RULES) {
    const matches = rule.keywords.filter((k) => lower.includes(k));
    if (matches.length > best.matches.length) best = { category: rule.category, matches };
  }

  const profile = profileFor(best.category, lower);
  const rng = mulberry32(hashString(lower));
  const indicators = best.matches.length
    ? `Detected indicators: ${best.matches.slice(0, 4).map((m) => `"${m}"`).join(", ")}. `
    : "";

  return {
    category: best.category,
    severity: profile.severity,
    confidence: round1(randFloat(rng, ...profile.confRange)),
    reasoning: `${indicators}${profile.rationale}`,
    source: "rules",
    matchedKeywords: best.matches,
  };
}

const CONFUSABLE: Record<Category, Category> = {
  PHISHING: "POLICY VIOLATION",
  MALWARE: "BENIGN",
  "POLICY VIOLATION": "PHISHING",
  BENIGN: "MALWARE",
};

export const MISCLASSIFY_RATE = 0.07;

/**
 * Stand-in for the LLM on automatic events. It is wrong ~7% of the time, and its
 * mistakes usually come with lower confidence, which is what the review threshold exploits.
 */
export function simulateClassification(spec: EventSpec, rng: Rng): Classification {
  if (rng() < MISCLASSIFY_RATE) {
    const category = CONFUSABLE[spec.trueCategory];
    // Most errors are low-confidence; a few are confidently wrong.
    const confidence = round1(rng() < 0.75 ? randFloat(rng, 58, 79) : randFloat(rng, 81, 90));
    return {
      category,
      severity: category === "BENIGN" ? "LOW" : spec.severity,
      confidence,
      reasoning: `Signals are ambiguous; ${spec.source.toLowerCase()} telemetry leans ${category.toLowerCase()}, but key indicators are missing.`,
      source: "simulated",
    };
  }
  const ambiguous = rng() < 0.04;
  return {
    category: spec.trueCategory,
    severity: spec.severity,
    confidence: round1(ambiguous ? randFloat(rng, 70, 79.5) : randFloat(rng, ...spec.confRange)),
    reasoning: spec.reasoning,
    source: "simulated",
  };
}
