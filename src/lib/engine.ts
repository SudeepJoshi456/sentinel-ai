import type {
  ActionId,
  ActionLogEntry,
  Category,
  Classification,
  Execution,
  Feedback,
  FeedbackKind,
  Guardrail,
  PerfPoint,
  Source,
  Ticket,
} from "./types";
import { CATEGORIES } from "./types";
import {
  ACTIONS,
  PLAYBOOK,
  armObservations,
  contextKey,
  isAllowedAction,
  selectAction,
  updateBandit,
  type BanditState,
} from "./bandit";
import { REVIEWERS, formatTicketId, randomEvent, trueProb } from "./mockData";
import { simulateClassification } from "./classifier";
import { clamp, mulberry32, pick, randFloat, round1, type Rng } from "./random";

/** Below this classifier confidence, the ticket goes to an analyst instead of being auto-actioned. */
export const REVIEW_THRESHOLD = 80;
/** High-impact actions run without approval only above this confidence... */
export const AUTO_EXECUTE_CONFIDENCE = 95;
/** ...and only once the policy has this much feedback for the action in this context. */
export const MIN_OBSERVATIONS = 15;
/** Share of automatic decisions that receive (simulated) analyst feedback. */
export const FEEDBACK_RATE = 0.7;
export const ROLLING_WINDOW = 50;

const MAX_TICKETS = 80;
const MAX_ACTIONS = 40;
const MAX_PERF_POINTS = 40;
const WARMUP_TICKETS = 320;
const WARMUP_SPACING_MS = 11_000;
const FIRST_TICKET_NUM = 4506;
const BASE_COUNTS = { total: 964, autoResolved: 742, escalated: 52 };

type Confusion = Record<Category, Record<Category, number>>;

export interface Metrics {
  window: { sentinel: number; baseline: number }[];
  scored: number;
  cumSentinel: number;
  cumBaseline: number;
  confusion: Confusion;
  lowConfidenceRouted: number;
  errorsCaught: number;
  errorsMissed: number;
  inputFlagged: number;
  feedback: Record<FeedbackKind, number>;
  approvals: { approved: number; rejected: number };
  execution: { success: number; retried: number; failed: number };
  llm: { calls: number; successes: number; fallbacks: number; totalLatencyMs: number; totalCostUsd: number; lastFallbackReason?: string };
  banditUpdates: number;
}

export interface Counts {
  totalProcessed: number;
  autoResolved: number;
  escalated: number;
  activeTickets: number;
}

export interface SimState {
  tickets: Ticket[];
  actions: ActionLogEntry[];
  perf: PerfPoint[];
  bandit: BanditState;
  metrics: Metrics;
  counts: Counts;
  nextNum: number;
}

export interface TicketInput {
  description: string;
  source: Source;
  classification: Classification;
  target: string;
  trueCategory?: Category;
  trueProbs?: Partial<Record<ActionId, number>>;
  inputFlags?: string[];
  isReport: boolean;
}

const emptyConfusion = (): Confusion =>
  Object.fromEntries(CATEGORIES.map((t) => [t, Object.fromEntries(CATEGORIES.map((p) => [p, 0]))])) as Confusion;

function emptyMetrics(): Metrics {
  return {
    window: [],
    scored: 0,
    cumSentinel: 0,
    cumBaseline: 0,
    confusion: emptyConfusion(),
    lowConfidenceRouted: 0,
    errorsCaught: 0,
    errorsMissed: 0,
    inputFlagged: 0,
    feedback: { correct: 0, wrong_action: 0, wrong_category: 0 },
    approvals: { approved: 0, rejected: 0 },
    execution: { success: 0, retried: 0, failed: 0 },
    llm: { calls: 0, successes: 0, fallbacks: 0, totalLatencyMs: 0, totalCostUsd: 0 },
    banditUpdates: 0,
  };
}

/** Mock execution: no live system is touched. Remediations fail ~6% of the time and get one retry. */
function execute(action: ActionId, rng: Rng): Execution | undefined {
  if (ACTIONS[action].decision !== "REMEDIATED") return undefined;
  if (rng() > 0.06) return { status: "success", attempts: 1 };
  return rng() < 0.8 ? { status: "retried", attempts: 2 } : { status: "failed", attempts: 2 };
}

const isAutomatedDecision = (d: Ticket["decision"]) => d === "REMEDIATED" || d === "AUTO-RESOLVED";

function rollingAverage(window: Metrics["window"]) {
  const n = window.length || 1;
  return {
    sentinel: (window.reduce((s, w) => s + w.sentinel, 0) / n) * 100,
    baseline: (window.reduce((s, w) => s + w.baseline, 0) / n) * 100,
  };
}

function executionLogEntry(t: Ticket, now: number, analyst?: string, prefix = ""): ActionLogEntry {
  const exec = t.execution;
  const failed = exec?.status === "failed";
  return {
    id: `act-${t.id}-${now}-${prefix}`,
    ticketId: t.id,
    name: `${prefix}${ACTIONS[t.actionId].label}${failed ? " failed" : ""}`,
    detail: failed ? `${t.actionDetail} · escalated after retry` : t.actionDetail,
    createdAt: now,
    kind: analyst || t.decision === "ESCALATED" ? "ANALYST" : "AUTOMATED",
    analyst: analyst ?? (t.decision === "ESCALATED" ? t.assignee : undefined),
    execution: exec,
  };
}

function trackExecution(m: Metrics, exec?: Execution): Metrics {
  if (!exec) return m;
  return { ...m, execution: { ...m.execution, [exec.status]: m.execution[exec.status] + 1 } };
}

function trackLlm(m: Metrics, c: Classification): Metrics {
  if (c.source === "llm" && c.llm) {
    return {
      ...m,
      llm: {
        ...m.llm,
        calls: m.llm.calls + 1,
        successes: m.llm.successes + 1,
        totalLatencyMs: m.llm.totalLatencyMs + c.llm.latencyMs,
        totalCostUsd: m.llm.totalCostUsd + c.llm.costUsd,
      },
    };
  }
  if (c.fallbackReason) {
    const attempted = c.fallbackReason !== "not configured";
    return {
      ...m,
      llm: { ...m.llm, calls: m.llm.calls + (attempted ? 1 : 0), fallbacks: m.llm.fallbacks + 1, lastFallbackReason: c.fallbackReason },
    };
  }
  return m;
}

export function processTicket(
  state: SimState,
  input: TicketInput,
  now: number,
  rng: Rng,
  opts: { addPerfPoint: boolean },
): { state: SimState; ticket: Ticket } {
  const c = input.classification;
  const ctx = contextKey(c.category, input.source, c.severity);
  const { actionId: recommended, arms } = selectAction(state.bandit, ctx, c.category);

  let guardrail: Guardrail | undefined;
  if (input.inputFlags?.length) guardrail = "input_flagged";
  else if (c.confidence < REVIEW_THRESHOLD) guardrail = "low_confidence";
  const actionId: ActionId = guardrail ? "escalate" : recommended;

  const needsApproval =
    !guardrail &&
    ACTIONS[actionId].highImpact &&
    (c.confidence < AUTO_EXECUTE_CONFIDENCE || armObservations(state.bandit, ctx, actionId) < MIN_OBSERVATIONS);

  const approvalReason =
    c.confidence < AUTO_EXECUTE_CONFIDENCE
      ? `High-impact action with ${c.confidence.toFixed(1)}% confidence (auto-execute requires ≥ ${AUTO_EXECUTE_CONFIDENCE}%).`
      : `High-impact action with limited history in this context (< ${MIN_OBSERVATIONS} reviewed outcomes).`;

  const execution = needsApproval ? undefined : execute(actionId, rng);
  const decision = needsApproval
    ? "PENDING APPROVAL"
    : execution?.status === "failed"
      ? "ESCALATED"
      : ACTIONS[actionId].decision;

  const num = state.nextNum;
  const ticket: Ticket = {
    id: formatTicketId(num),
    num,
    createdAt: now,
    description: input.description,
    source: input.source,
    category: c.category,
    severity: c.severity,
    confidence: c.confidence,
    reasoning: c.reasoning,
    classifierSource: c.source,
    llm: c.llm,
    fallbackReason: c.fallbackReason,
    contextKey: ctx,
    recommendedAction: recommended,
    actionId,
    actionDetail: input.target,
    arms,
    guardrail,
    inputFlags: input.inputFlags?.length ? input.inputFlags : undefined,
    decision,
    approval: needsApproval
      ? {
          reason: approvalReason,
          status: "pending",
          autoDecideAt: input.isReport ? undefined : now + randFloat(rng, 25_000, 45_000),
        }
      : undefined,
    execution,
    assignee: decision === "ESCALATED" || needsApproval ? pick(rng, REVIEWERS) : undefined,
    trueCategory: input.trueCategory,
    trueProbs: input.trueProbs,
  };

  let metrics = trackLlm(trackExecution(state.metrics, execution), c);
  if (guardrail === "low_confidence") metrics = { ...metrics, lowConfidenceRouted: metrics.lowConfidenceRouted + 1 };
  if (guardrail === "input_flagged") metrics = { ...metrics, inputFlagged: metrics.inputFlagged + 1 };

  if (input.trueCategory && !input.isReport) {
    const confusion = { ...metrics.confusion, [input.trueCategory]: { ...metrics.confusion[input.trueCategory] } };
    confusion[input.trueCategory][c.category] += 1;
    const wrong = input.trueCategory !== c.category;
    metrics = {
      ...metrics,
      confusion,
      errorsCaught: metrics.errorsCaught + (wrong && guardrail ? 1 : 0),
      errorsMissed: metrics.errorsMissed + (wrong && !guardrail ? 1 : 0),
    };
  }

  let perf = state.perf;
  if (input.trueProbs && !input.isReport) {
    const sentinel = trueProb(input.trueProbs, actionId);
    const baseline = trueProb(input.trueProbs, PLAYBOOK[c.category]);
    metrics = {
      ...metrics,
      window: [...metrics.window, { sentinel, baseline }].slice(-ROLLING_WINDOW),
      scored: metrics.scored + 1,
      cumSentinel: metrics.cumSentinel + sentinel,
      cumBaseline: metrics.cumBaseline + baseline,
    };
    if (opts.addPerfPoint) {
      const avg = rollingAverage(metrics.window);
      perf = [...perf, { t: now, sentinel: round1(avg.sentinel), baseline: round1(avg.baseline) }].slice(-MAX_PERF_POINTS);
    }
  }

  // Simulated analysts review most automatic decisions; that feedback is the bandit's reward.
  let bandit = state.bandit;
  if (!guardrail && !needsApproval && !input.isReport && input.trueProbs && rng() < FEEDBACK_RATE) {
    const reward: 0 | 1 = rng() < trueProb(input.trueProbs, actionId) ? 1 : 0;
    bandit = updateBandit(bandit, ctx, actionId, reward);
    metrics = { ...metrics, banditUpdates: metrics.banditUpdates + 1 };
  }

  const resolvedElsewhere = state.counts.activeTickets > 30 ? 2 : rng() < 0.35 ? 1 : 0;
  const counts: Counts = {
    totalProcessed: state.counts.totalProcessed + 1,
    autoResolved: state.counts.autoResolved + (isAutomatedDecision(decision) ? 1 : 0),
    escalated: state.counts.escalated + (decision === "ESCALATED" ? 1 : 0),
    activeTickets: clamp(state.counts.activeTickets + 1 - resolvedElsewhere, 18, 38),
  };

  const logEntry = needsApproval || decision === "MONITORING" ? null : executionLogEntry(ticket, now);

  return {
    ticket,
    state: {
      tickets: [ticket, ...state.tickets].slice(0, MAX_TICKETS),
      actions: logEntry ? [logEntry, ...state.actions].slice(0, MAX_ACTIONS) : state.actions,
      perf,
      bandit,
      metrics,
      counts,
      nextNum: num + 1,
    },
  };
}

function replaceTicket(state: SimState, ticket: Ticket): SimState {
  return { ...state, tickets: state.tickets.map((t) => (t.id === ticket.id ? ticket : t)) };
}

export function resolveApproval(state: SimState, ticketId: string, approve: boolean, by: string, now: number, rng: Rng): SimState {
  const t = state.tickets.find((x) => x.id === ticketId);
  if (!t || t.approval?.status !== "pending") return state;

  const approval = { ...t.approval, status: approve ? ("approved" as const) : ("rejected" as const), by, at: now };
  let updated: Ticket;
  if (approve) {
    const execution = execute(t.actionId, rng);
    updated = {
      ...t,
      approval,
      execution,
      decision: execution?.status === "failed" ? "ESCALATED" : ACTIONS[t.actionId].decision,
    };
  } else {
    updated = { ...t, approval, actionId: "escalate", decision: "ESCALATED", assignee: by };
  }

  const bandit = updateBandit(state.bandit, t.contextKey, t.recommendedAction, approve ? 1 : 0);
  const metrics = trackExecution(
    {
      ...state.metrics,
      approvals: {
        approved: state.metrics.approvals.approved + (approve ? 1 : 0),
        rejected: state.metrics.approvals.rejected + (approve ? 0 : 1),
      },
      banditUpdates: state.metrics.banditUpdates + 1,
    },
    updated.execution,
  );

  const entry: ActionLogEntry = approve
    ? executionLogEntry(updated, now, by, "Approved · ")
    : {
        id: `rej-${t.id}-${now}`,
        ticketId: t.id,
        name: `Rejected · ${ACTIONS[t.recommendedAction].label}`,
        detail: `${t.actionDetail} · escalated instead`,
        createdAt: now,
        kind: "ANALYST",
        analyst: by,
      };

  return {
    ...replaceTicket(state, updated),
    bandit,
    metrics,
    actions: [entry, ...state.actions].slice(0, MAX_ACTIONS),
    counts: {
      ...state.counts,
      autoResolved: state.counts.autoResolved + (isAutomatedDecision(updated.decision) ? 1 : 0),
      escalated: state.counts.escalated + (updated.decision === "ESCALATED" ? 1 : 0),
    },
  };
}

/** Simulated reviewers work through their approval queue; they approve when the action is actually right. */
export function autoResolveDue(state: SimState, now: number, rng: Rng, skipTicketId?: string | null): SimState {
  let next = state;
  for (const t of state.tickets) {
    if (t.id === skipTicketId || t.approval?.status !== "pending" || !t.approval.autoDecideAt || t.approval.autoDecideAt > now) {
      continue;
    }
    const approve = rng() < (t.trueProbs ? trueProb(t.trueProbs, t.actionId) : 0.8);
    next = resolveApproval(next, t.id, approve, t.assignee ?? pick(rng, REVIEWERS), t.approval.autoDecideAt, rng);
  }
  return next;
}

export function applyFeedback(state: SimState, ticketId: string, feedback: Feedback): SimState {
  const t = state.tickets.find((x) => x.id === ticketId);
  if (!t || t.feedback) return state;

  let bandit = updateBandit(state.bandit, t.contextKey, t.actionId, feedback.kind === "correct" ? 1 : 0);
  let updates = 1;
  if (feedback.kind === "wrong_action" && feedback.correctAction && isAllowedAction(t.category, feedback.correctAction)) {
    bandit = updateBandit(bandit, t.contextKey, feedback.correctAction, 1);
    updates++;
  }

  const detail =
    feedback.kind === "correct"
      ? `${t.id} · reward 1 → ${ACTIONS[t.actionId].label}`
      : feedback.kind === "wrong_action"
        ? `${t.id} · should have been ${feedback.correctAction ? ACTIONS[feedback.correctAction].label : "different"}`
        : `${t.id} · actually ${feedback.correctCategory?.toLowerCase() ?? "different category"}`;

  const entry: ActionLogEntry = {
    id: `fb-${t.id}-${feedback.at}`,
    ticketId: t.id,
    name: feedback.kind === "correct" ? "Confirmed AI response" : feedback.kind === "wrong_action" ? "Corrected AI response" : "Corrected classification",
    detail,
    createdAt: feedback.at,
    kind: "ANALYST",
    analyst: feedback.by,
  };

  return {
    ...replaceTicket(state, { ...t, feedback }),
    bandit,
    metrics: {
      ...state.metrics,
      feedback: { ...state.metrics.feedback, [feedback.kind]: state.metrics.feedback[feedback.kind] + 1 },
      banditUpdates: state.metrics.banditUpdates + updates,
    },
    actions: [entry, ...state.actions].slice(0, MAX_ACTIONS),
  };
}

export function simulatedEventInput(rng: Rng): TicketInput {
  const spec = randomEvent(rng);
  return {
    description: spec.description,
    source: spec.source,
    classification: simulateClassification(spec, rng),
    target: spec.target,
    trueCategory: spec.trueCategory,
    trueProbs: spec.probs,
    isReport: false,
  };
}

/**
 * Replays ~an hour of history with a fixed seed, so the dashboard opens with a policy that has
 * learned from reviewed examples (cold start) and looks identical on every load.
 */
export function createInitialState(now: number): SimState {
  const rng = mulberry32(20261109);
  let state: SimState = {
    tickets: [],
    actions: [],
    perf: [],
    bandit: {},
    metrics: emptyMetrics(),
    counts: { totalProcessed: BASE_COUNTS.total, autoResolved: BASE_COUNTS.autoResolved, escalated: BASE_COUNTS.escalated, activeTickets: 24 },
    nextNum: FIRST_TICKET_NUM,
  };
  for (let i = 0; i < WARMUP_TICKETS; i++) {
    const ts = now - (WARMUP_TICKETS - 1 - i) * WARMUP_SPACING_MS - Math.floor(rng() * 4000);
    state = autoResolveDue(state, ts, rng);
    state = processTicket(state, simulatedEventInput(rng), ts, rng, { addPerfPoint: i % 10 === 9 }).state;
  }
  return { ...state, counts: { ...state.counts, activeTickets: 24 } };
}

export { rollingAverage };
