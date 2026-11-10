import type { ActionId, ArmScore, Category, Decision, Severity, Source } from "./types";

export interface ActionDef {
  id: ActionId;
  label: string;
  decision: Exclude<Decision, "PENDING APPROVAL">;
  /** High-impact actions change a user's or host's state and may need analyst approval. */
  highImpact: boolean;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  quarantine_email: { id: "quarantine_email", label: "Quarantined email", decision: "REMEDIATED", highImpact: false },
  reset_credentials: { id: "reset_credentials", label: "Reset credentials", decision: "REMEDIATED", highImpact: true },
  revoke_session: { id: "revoke_session", label: "Revoked session", decision: "REMEDIATED", highImpact: true },
  isolate_host: { id: "isolate_host", label: "Isolated host", decision: "REMEDIATED", highImpact: true },
  block_ip: { id: "block_ip", label: "Blocked IP", decision: "REMEDIATED", highImpact: false },
  block_transfer: { id: "block_transfer", label: "Blocked data transfer", decision: "REMEDIATED", highImpact: false },
  escalate: { id: "escalate", label: "Escalated ticket", decision: "ESCALATED", highImpact: false },
  watchlist: { id: "watchlist", label: "Added to watchlist", decision: "MONITORING", highImpact: false },
  close_benign: { id: "close_benign", label: "Closed as benign", decision: "AUTO-RESOLVED", highImpact: false },
};

/** Allow-list: the policy can only ever choose from these actions for a given category. */
export const CANDIDATES: Record<Category, ActionId[]> = {
  PHISHING: ["quarantine_email", "reset_credentials", "revoke_session", "escalate", "watchlist"],
  MALWARE: ["isolate_host", "block_ip", "escalate", "watchlist"],
  "POLICY VIOLATION": ["block_transfer", "escalate", "watchlist"],
  BENIGN: ["close_benign", "watchlist", "escalate"],
};

/** Static rule playbook used as the fixed baseline the bandit is compared against. */
export const PLAYBOOK: Record<Category, ActionId> = {
  PHISHING: "quarantine_email",
  MALWARE: "isolate_host",
  "POLICY VIOLATION": "escalate",
  BENIGN: "close_benign",
};

export const isAllowedAction = (category: Category, action: ActionId) => CANDIDATES[category].includes(action);

export interface Arm {
  a: number;
  b: number;
}

/** contextKey -> actionId -> Beta posterior */
export type BanditState = Record<string, Partial<Record<ActionId, Arm>>>;

const severityBucket = (s: Severity) => (s === "CRITICAL" || s === "HIGH" ? "high" : "low");

export const contextKey = (category: Category, source: Source, severity: Severity) =>
  `${category}|${source}|${severityBucket(severity)}`;

export function describeContext(key: string) {
  const [category, source, bucket] = key.split("|");
  return { category: category as Category, source: source as Source, bucket: bucket as "high" | "low" };
}

/**
 * Conservative cold start: escalation starts with a small optimistic prior (one reviewed
 * "worked" example), so with no history the policy defers to a human rather than acting.
 */
const prior = (action: ActionId): Arm => (action === "escalate" ? { a: 2, b: 1 } : { a: 1, b: 1 });

const EXPLORATION = 1.4;
/** Escalation picks after which an untried alternative is proposed instead. */
const LOCK_IN_OBSERVATIONS = 5;

export function armStats(arm: Arm) {
  const total = arm.a + arm.b;
  const mean = arm.a / total;
  const sd = Math.sqrt((arm.a * arm.b) / (total * total * (total + 1)));
  return { mean, sd };
}

export function getArm(state: BanditState, ctx: string, action: ActionId): Arm {
  return state[ctx]?.[action] ?? prior(action);
}

/** Observations beyond the prior. */
export function armObservations(state: BanditState, ctx: string, action: ActionId) {
  const arm = getArm(state, ctx, action);
  const p = prior(action);
  return Math.round(arm.a + arm.b - p.a - p.b);
}

/**
 * Deterministic Beta-UCB selection: same history + same context = same choice.
 * The escalation prior keeps cold starts conservative, but it must not lock a context into
 * escalation forever: if escalation wins while an allowed action has never been tried, that
 * action is proposed instead (high-impact ones still go through analyst approval).
 */
export function selectAction(state: BanditState, ctx: string, category: Category): { actionId: ActionId; arms: ArmScore[] } {
  const arms = CANDIDATES[category].map((actionId) => {
    const { mean, sd } = armStats(getArm(state, ctx, actionId));
    return { actionId, mean, n: armObservations(state, ctx, actionId), ucb: mean + EXPLORATION * sd };
  });
  const ranked = [...arms].sort((x, y) => y.ucb - x.ucb);
  const lockedIntoEscalation = ranked[0].actionId === "escalate" && ranked[0].n >= LOCK_IN_OBSERVATIONS;
  const untried = arms.find((a) => a.n === 0 && a.actionId !== "escalate" && a.actionId !== "watchlist");
  const choice = lockedIntoEscalation && untried ? untried.actionId : ranked[0].actionId;
  return { actionId: choice, arms: ranked };
}

export function updateBandit(state: BanditState, ctx: string, action: ActionId, reward: 0 | 1): BanditState {
  const arm = getArm(state, ctx, action);
  return {
    ...state,
    [ctx]: { ...state[ctx], [action]: { a: arm.a + reward, b: arm.b + (1 - reward) } },
  };
}

/** For the analytics view: the current best (exploit) action per context. */
export function learnedPolicy(state: BanditState) {
  return Object.keys(state)
    .map((ctx) => {
      const { category } = describeContext(ctx);
      const ranked = CANDIDATES[category]
        .map((actionId) => ({ actionId, mean: armStats(getArm(state, ctx, actionId)).mean, n: armObservations(state, ctx, actionId) }))
        .sort((x, y) => y.mean - x.mean);
      const total = ranked.reduce((s, r) => s + r.n, 0);
      return { ctx, best: ranked[0], runnerUp: ranked[1], total };
    })
    .sort((x, y) => y.total - x.total);
}
