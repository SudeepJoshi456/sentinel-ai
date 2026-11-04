export type Category = "PHISHING" | "MALWARE" | "POLICY VIOLATION" | "BENIGN";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Decision = "ESCALATED" | "REMEDIATED" | "MONITORING" | "AUTO-RESOLVED";
export type Source =
  | "Identity provider"
  | "EDR / endpoint"
  | "DLP monitor"
  | "Network sensor"
  | "Email gateway"
  | "User report";

export type Feedback = "confirmed" | "overridden";

export interface Ticket {
  id: string;
  num: number;
  createdAt: number;
  description: string;
  source: Source;
  category: Category;
  severity: Severity;
  decision: Decision;
  /** 0-100 */
  confidence: number;
  reasoning: string;
  actionName: string;
  actionDetail: string;
  /** Simulated bandit expected reward, 0-1 */
  expectedReward: number;
  assignee?: string;
  feedback?: Feedback;
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
}

export interface PerfPoint {
  t: number;
  accuracy: number;
}

/** Everything the classifier/bandit pipeline produces, before an ID/time is assigned. */
export type TicketDraft = Omit<Ticket, "id" | "num" | "createdAt">;
