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
import type { ActionLogEntry, Category, Classification, Feedback, PerfPoint, Ticket } from "./types";
import {
  applyFeedback,
  autoResolveDue,
  createInitialState,
  processTicket,
  resolveApproval,
  rollingAverage,
  simulatedEventInput,
  type Metrics,
  type SimState,
} from "./engine";
import type { BanditState } from "./bandit";
import { REPORT_PROBS } from "./mockData";

export const CURRENT_USER = { name: "Sarah Kim", firstName: "Sarah", role: "Security Analyst", initials: "SK" };

const LIVE_MIN_MS = 8_000;
const LIVE_MAX_MS = 12_000;
const HIGHLIGHT_MS = 3_200;

/** "Previous period" baselines used to derive the green trend percentages. */
const BASELINE = { total: 1142, autoPct: 70.2, escalated: 151 };

const REPORT_TARGETS: Record<Category, string> = {
  PHISHING: "Reporter's mailbox · reported message",
  MALWARE: "Reporter's workstation",
  "POLICY VIOLATION": "Reported user · data transfer",
  BENIGN: "Reporter context",
};

export interface DerivedStats {
  totalProcessed: number;
  autoResolved: number;
  escalated: number;
  activeTickets: number;
  autoResolvedPct: number;
  rewardScore: number;
  baselineScore: number;
  pendingApprovals: Ticket[];
  trends: { total: number; autoPct: number; escalated: number; reward: number };
}

export type FeedbackInput = Omit<Feedback, "by" | "at">;

interface SimulationContextValue {
  now: number;
  tickets: Ticket[];
  actions: ActionLogEntry[];
  perf: PerfPoint[];
  bandit: BanditState;
  metrics: Metrics;
  stats: DerivedStats;
  highlighted: ReadonlySet<string>;
  paused: boolean;
  togglePaused: () => void;
  reportOpen: boolean;
  setReportOpen: (open: boolean) => void;
  submitReport: (text: string, classification: Classification, inputFlags: string[]) => Ticket;
  openTicketId: string | null;
  openTicket: (id: string) => void;
  closeTicket: () => void;
  decideApproval: (ticketId: string, approve: boolean) => void;
  recordFeedback: (ticketId: string, feedback: FeedbackInput) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used inside <SimulationProvider>");
  return ctx;
}

export function SimulationProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  // Built on mount (not during SSR) so relative timestamps never cause hydration mismatches.
  // The engine runs outside React updaters (stateRef is the source of truth), so random draws
  // and ID allocation happen exactly once per event even under StrictMode.
  const stateRef = useRef<SimState | null>(null);
  const [state, setState] = useState<SimState | null>(null);
  const [now, setNow] = useState(0);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const highlightTimers = useRef<number[]>([]);
  const pausedRef = useRef(paused);
  const openTicketRef = useRef(openTicketId);
  pausedRef.current = paused;
  openTicketRef.current = openTicketId;

  const commit = useCallback((next: SimState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const start = Date.now();
    commit(createInitialState(start));
    setNow(start);
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const current = stateRef.current;
      if (current && !pausedRef.current) {
        const next = autoResolveDue(current, t, Math.random, openTicketRef.current);
        if (next !== current) commit(next);
      }
    }, 1000);
    const timers = highlightTimers.current;
    return () => {
      window.clearInterval(id);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [commit]);

  const highlight = useCallback((id: string) => {
    setHighlighted((prev) => new Set(prev).add(id));
    const timer = window.setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, HIGHLIGHT_MS);
    highlightTimers.current.push(timer);
  }, []);

  const insert = useCallback(
    (input: Parameters<typeof processTicket>[1]): Ticket => {
      const current = stateRef.current!;
      const { state: next, ticket } = processTicket(current, input, Date.now(), Math.random, { addPerfPoint: true });
      commit(next);
      highlight(ticket.id);
      return ticket;
    },
    [commit, highlight],
  );

  // Live feed: one new ticket every 8-12s. Rescheduled after every insert and suspended while
  // paused or while the report modal is open, so a presenter's ticket lands on top.
  const ready = state !== null;
  const lastTicketId = state?.tickets[0]?.id;
  useEffect(() => {
    if (!ready || paused || reportOpen) return;
    const delay = LIVE_MIN_MS + Math.random() * (LIVE_MAX_MS - LIVE_MIN_MS);
    const id = window.setTimeout(() => insert(simulatedEventInput(Math.random)), delay);
    return () => window.clearTimeout(id);
  }, [ready, paused, reportOpen, lastTicketId, insert]);

  const submitReport = useCallback(
    (text: string, classification: Classification, inputFlags: string[]) =>
      insert({
        description: text,
        source: "User report",
        classification,
        target: REPORT_TARGETS[classification.category],
        trueProbs: REPORT_PROBS[classification.category],
        inputFlags,
        isReport: true,
      }),
    [insert],
  );

  const decideApproval = useCallback(
    (ticketId: string, approve: boolean) => {
      const current = stateRef.current;
      if (!current) return;
      commit(resolveApproval(current, ticketId, approve, CURRENT_USER.name, Date.now(), Math.random));
    },
    [commit],
  );

  const recordFeedback = useCallback(
    (ticketId: string, feedback: FeedbackInput) => {
      const current = stateRef.current;
      if (!current) return;
      commit(applyFeedback(current, ticketId, { ...feedback, by: CURRENT_USER.name, at: Date.now() }));
    },
    [commit],
  );

  const stats = useMemo<DerivedStats | null>(() => {
    if (!state) return null;
    const c = state.counts;
    const autoResolvedPct = (c.autoResolved / c.totalProcessed) * 100;
    const avg = rollingAverage(state.metrics.window);
    return {
      ...c,
      autoResolvedPct,
      rewardScore: avg.sentinel,
      baselineScore: avg.baseline,
      pendingApprovals: state.tickets.filter((t) => t.approval?.status === "pending").reverse(),
      trends: {
        total: (c.totalProcessed / BASELINE.total - 1) * 100,
        autoPct: autoResolvedPct - BASELINE.autoPct,
        escalated: (c.escalated / BASELINE.escalated - 1) * 100,
        reward: avg.sentinel - avg.baseline,
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
      bandit: state.bandit,
      metrics: state.metrics,
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
      decideApproval,
      recordFeedback,
    };
  }, [state, stats, now, highlighted, paused, reportOpen, submitReport, openTicketId, decideApproval, recordFeedback]);

  if (!value) return <>{fallback}</>;
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
