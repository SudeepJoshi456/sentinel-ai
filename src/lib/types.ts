export type Category = "PHISHING" | "MALWARE" | "POLICY VIOLATION" | "BENIGN";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Decision = "ESCALATED" | "REMEDIATED" | "MONITORING" | "AUTO-RESOLVED" | "PENDING APPROVAL";
export type Source =
  | "Identity provider"
  | "EDR / endpoint"
  | "DLP monitor"
  | "Network sensor"
  | "Email gateway"
  | "User report";

export const CATEGORIES: Category[] = ["PHISHING", "MALWARE", "POLICY VIOLATION", "BENIGN"];
export const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export type ActionId =
  | "quarantine_email"
  | "reset_credentials"
  | "revoke_session"
  | "isolate_host"
  | "block_ip"
  | "block_transfer"
  | "escalate"
  | "watchlist"
  | "close_benign";

/** Where the category/severity/confidence came from. */
export type ClassifierSource = "simulated" | "rules" | "llm";

export interface LlmMeta {
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface Classification {
  category: Category;
  severity: Severity;
  /** 0-100 */
  confidence: number;
  reasoning: string;
  source: ClassifierSource;
  llm?: LlmMeta;
  /** Why the LLM path was skipped, when it was. */
  fallbackReason?: string;
}

/** Policy guardrail that overrode the bandit's choice. */
export type Guardrail = "low_confidence" | "input_flagged";

export interface ArmScore {
  actionId: ActionId;
  mean: number;
  n: number;
  ucb: number;
}

export interface Approval {
  reason: string;
  status: "pending" | "approved" | "rejected";
  by?: string;
  at?: number;
  /** Simulated analysts resolve their own queue; presenter-submitted reports wait for a human. */
  autoDecideAt?: number;
}

export interface Execution {
  status: "success" | "retried" | "failed";
  attempts: number;
}

export type FeedbackKind = "correct" | "wrong_action" | "wrong_category";

export interface Feedback {
  kind: FeedbackKind;
  correctAction?: ActionId;
  correctCategory?: Category;
  by: string;
  at: number;
}

export interface Ticket {
  id: string;
  num: number;
  createdAt: number;
  description: string;
  source: Source;
  category: Category;
  severity: Severity;
  confidence: number;
  reasoning: string;
  classifierSource: ClassifierSource;
  llm?: LlmMeta;
  fallbackReason?: string;

  contextKey: string;
  /** What the bandit recommended (before guardrails). */
  recommendedAction: ActionId;
  /** What the system actually did / will do. */
  actionId: ActionId;
  actionDetail: string;
  arms: ArmScore[];
  guardrail?: Guardrail;
  inputFlags?: string[];

  decision: Decision;
  approval?: Approval;
  execution?: Execution;
  assignee?: string;
  feedback?: Feedback;

  /** Simulation-only ground truth (absent for user reports). */
  trueCategory?: Category;
  trueProbs?: Partial<Record<ActionId, number>>;
}

export type ActionKind = "AUTOMATED" | "ANALYST";

export interface ActionLogEntry {
  id: string;
  ticketId: string;
  name: string;
  detail: string;
  createdAt: number;
  kind: ActionKind;
  analyst?: string;
  execution?: Execution;
}

export interface PerfPoint {
  t: number;
  /** Rolling expected reward of SentinelAI's actions, 0-100. */
  sentinel: number;
  /** Rolling expected reward of the fixed playbook on the same tickets, 0-100. */
  baseline: number;
}
