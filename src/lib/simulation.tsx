"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionLogEntry, Feedback, PerfPoint, Ticket, TicketDraft } from "./types";
import {
  actionFromTicket,
  buildSeedPerformance,
  buildSeedTickets,
  formatTicketId,
  randomDraft,
  SEED_ACCURACY_END,
  SEED_ACCURACY_START,
} from "./mockData";
import { classifyReport } from "./classifier";
import { clamp, randFloat, round1 } from "./random";

export const CURRENT_USER = { name: "Sarah Kim", firstName: "Sarah", role: "Security Analyst", initials: "SK" };

const MAX_TICKETS = 80;
const MAX_ACTIONS = 30;
const MAX_PERF_POINTS = 30;
const LIVE_MIN_MS = 8_000;
const LIVE_MAX_MS = 12_000;
const HIGHLIGHT_MS = 3_200;

/** "Previous period" baselines used to derive the green trend percentages. */
const BASELINE = { total: 1142, autoPct: 74.3, escalated: 91 };

interface Stats {
  totalProcessed: number;
  autoResolved: number;
  escalated: number;
  activeTickets: number;
}

interface SimState {
  tickets: Ticket[];
  actions: ActionLogEntry[];
  perf: PerfPoint[];
  stats: Stats;
  sessionTicks: number;
}

function initialState(now: number): SimState {
  const tickets = buildSeedTickets(now);
  const actions = tickets
    .map((t) => actionFromTicket(t))
    .filter((a): a is ActionLogEntry => a !== null);
  return {
    tickets,
    actions,
    perf: buildSeedPerformance(now),
    stats: { totalProcessed: 1284, autoResolved: 1007, escalated: 96, activeTickets: 24 },
    sessionTicks: 0,
  };
}

interface InsertRandoms {
  accuracyNoise: number;
  resolveRoll: number;
}

function applyTicket(prev: SimState, ticket: Ticket, r: InsertRandoms): SimState {
  const action = actionFromTicket(ticket);
  const automated = ticket.decision === "AUTO-RESOLVED" || ticket.decision === "REMEDIATED";

  const resolvedElsewhere = prev.stats.activeTickets > 30 ? 2 : r.resolveRoll < 0.35 ? 1 : 0;
  const activeTickets = clamp(prev.stats.activeTickets + 1 - resolvedElsewhere, 18, 38);

  // Accuracy mean-reverts toward a slowly rising target, so it drifts up without leaving 90-96.5%.
  const last = prev.perf[prev.perf.length - 1].accuracy;
  const target = Math.min(95.8, SEED_ACCURACY_END + 0.06 * (prev.sessionTicks + 1));
  const accuracy = round1(clamp(last + 0.3 * (target - last) + r.accuracyNoise, 90.2, 96.4));

  return {
    tickets: [ticket, ...prev.tickets].slice(0, MAX_TICKETS),
    actions: action ? [action, ...prev.actions].slice(0, MAX_ACTIONS) : prev.actions,
    perf: [...prev.perf, { t: ticket.createdAt, accuracy }].slice(-MAX_PERF_POINTS),
    stats: {
      totalProcessed: prev.stats.totalProcessed + 1,
      autoResolved: prev.stats.autoResolved + (automated ? 1 : 0),
      escalated: prev.stats.escalated + (ticket.decision === "ESCALATED" ? 1 : 0),
      activeTickets,
    },
    sessionTicks: prev.sessionTicks + 1,
  };
}

export interface DerivedStats extends Stats {
  autoResolvedPct: number;
  rewardScore: number;
  trends: { total: number; autoPct: number; escalated: number; reward: number };
  sessionGain: number;
}

interface SimulationContextValue {
  now: number;
  tickets: Ticket[];
  actions: ActionLogEntry[];
  perf: PerfPoint[];
  stats: DerivedStats;
  highlighted: ReadonlySet<string>;
  paused: boolean;
  togglePaused: () => void;
  reportOpen: boolean;
  setReportOpen: (open: boolean) => void;
  submitReport: (text: string) => Ticket;
  openTicketId: string | null;
  openTicket: (id: string) => void;
  closeTicket: () => void;
  recordFeedback: (ticketId: string, feedback: Feedback) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used inside <SimulationProvider>");
  return ctx;
}

export function SimulationProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  // Built on mount (not during SSR) so relative timestamps never cause hydration mismatches.
  const [state, setState] = useState<SimState | null>(null);
  const [now, setNow] = useState(0);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const nextNumRef = useRef(0);
  const highlightTimers = useRef<number[]>([]);

  useEffect(() => {
    const start = Date.now();
    const seeded = initialState(start);
    nextNumRef.current = Math.max(...seeded.tickets.map((t) => t.num)) + 1;
    setState(seeded);
    setNow(start);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const timers = highlightTimers.current;
    return () => {
      window.clearInterval(id);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const insertDraft = useCallback((draft: TicketDraft): Ticket => {
    const num = nextNumRef.current++;
    const ticket: Ticket = { ...draft, id: formatTicketId(num), num, createdAt: Date.now() };
    const randoms: InsertRandoms = { accuracyNoise: randFloat(Math.random, -0.28, 0.28), resolveRoll: Math.random() };
    setState((prev) => (prev ? applyTicket(prev, ticket, randoms) : prev));
    setHighlighted((prev) => new Set(prev).add(ticket.id));
    const timer = window.setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }, HIGHLIGHT_MS);
    highlightTimers.current.push(timer);
    return ticket;
  }, []);

  // Live feed: one new ticket every 8-12s. Rescheduled after every insert (auto or reported)
  // and suspended while paused or while the report modal is open, so a presenter's ticket
  // always lands on top and stays there for a few seconds.
  const ready = state !== null;
  const lastTicketId = state?.tickets[0]?.id;
  useEffect(() => {
    if (!ready || paused || reportOpen) return;
    const delay = LIVE_MIN_MS + Math.random() * (LIVE_MAX_MS - LIVE_MIN_MS);
    const id = window.setTimeout(() => insertDraft(randomDraft()), delay);
    return () => window.clearTimeout(id);
  }, [ready, paused, reportOpen, lastTicketId, insertDraft]);

  const submitReport = useCallback(
    (text: string) => {
      const { matchedKeywords: _unused, ...draft } = classifyReport(text, "Marcus Chen");
      return insertDraft(draft);
    },
    [insertDraft],
  );

  const recordFeedback = useCallback((ticketId: string, feedback: Feedback) => {
    setState((prev) => {
      if (!prev) return prev;
      const ticket = prev.tickets.find((t) => t.id === ticketId);
      if (!ticket || ticket.feedback) return prev;
      const createdAt = Date.now();
      const entry: ActionLogEntry = {
        id: `fb-${ticketId}-${createdAt}`,
        ticketId,
        name: feedback === "confirmed" ? "Confirmed AI decision" : "Overrode AI decision",
        detail: `${ticketId} · reward signal sent to bandit`,
        createdAt,
        kind: "ANALYST",
        analyst: CURRENT_USER.name,
      };
      return {
        ...prev,
        tickets: prev.tickets.map((t) => (t.id === ticketId ? { ...t, feedback } : t)),
        actions: [entry, ...prev.actions].slice(0, MAX_ACTIONS),
      };
    });
  }, []);

  const stats = useMemo<DerivedStats | null>(() => {
    if (!state) return null;
    const s = state.stats;
    const autoResolvedPct = (s.autoResolved / s.totalProcessed) * 100;
    const rewardScore = state.perf[state.perf.length - 1].accuracy;
    const sessionGain = rewardScore - SEED_ACCURACY_START;
    return {
      ...s,
      autoResolvedPct,
      rewardScore,
      sessionGain,
      trends: {
        total: (s.totalProcessed / BASELINE.total - 1) * 100,
        autoPct: autoResolvedPct - BASELINE.autoPct,
        escalated: (s.escalated / BASELINE.escalated - 1) * 100,
        reward: sessionGain,
      },
    };
  }, [state]);

  const value = useMemo<SimulationContextValue | null>(() => {
    if (!state || !stats) return null;
    return {
      now,
      tickets: state.tickets,
      actions: state.actions,
      perf: state.perf,
      stats,
      highlighted,
      paused,
      togglePaused: () => setPaused((p) => !p),
      reportOpen,
      setReportOpen,
      submitReport,
      openTicketId,
      openTicket: setOpenTicketId,
      closeTicket: () => setOpenTicketId(null),
      recordFeedback,
    };
  }, [state, stats, now, highlighted, paused, reportOpen, submitReport, openTicketId, recordFeedback]);

  if (!value) return <>{fallback}</>;
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
