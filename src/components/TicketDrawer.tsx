"use client";

import { useEffect } from "react";
import { Brain, CircleCheckBig, GitBranch, ThumbsDown, ThumbsUp, UserCheck, X } from "lucide-react";
import { useSimulation } from "@/lib/simulation";
import { localClock, relativeTime } from "@/lib/format";
import { CategoryPill, DecisionPill, SeverityPill } from "./Pill";
import { SourceTag } from "./SourceTag";

function Section({ icon: Icon, title, children }: { icon: typeof Brain; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-canvas/40 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <span className="eyebrow text-ink/80">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function TicketDrawer() {
  const { tickets, openTicketId, closeTicket, now, recordFeedback } = useSimulation();
  const ticket = openTicketId ? tickets.find((t) => t.id === openTicketId) : undefined;

  useEffect(() => {
    if (!openTicketId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTicket();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTicketId, closeTicket]);

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={closeTicket} />
      <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-[480px] max-w-full flex-col border-l border-line bg-panel shadow-2xl shadow-slate-900/15">
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <div className="font-mono text-[15px] font-semibold text-accent">{ticket.id}</div>
            <div className="mt-1 text-[12px] text-muted tabular-nums">
              Received {localClock(ticket.createdAt)} · {relativeTime(ticket.createdAt, now)}
            </div>
          </div>
          <button
            type="button"
            onClick={closeTicket}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <CategoryPill value={ticket.category} />
            <SeverityPill value={ticket.severity} />
            <DecisionPill value={ticket.decision} />
          </div>

          <div>
            <div className="eyebrow mb-1.5">Event description</div>
            <p className="text-[14px] leading-relaxed text-ink">{ticket.description}</p>
            <div className="mt-2">
              <SourceTag source={ticket.source} />
            </div>
          </div>

          <Section icon={Brain} title="LLM classification">
            <p className="text-[13px] leading-relaxed text-ink/90">{ticket.reasoning}</p>
            <div className="mt-3.5 flex items-center gap-3">
              <span className="text-[11.5px] text-muted">Confidence</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <div className="h-full rounded-full bg-accent" style={{ width: `${ticket.confidence}%` }} />
              </div>
              <span className="text-[12.5px] font-semibold text-ink tabular-nums">{ticket.confidence.toFixed(1)}%</span>
            </div>
          </Section>

          <Section icon={GitBranch} title="Bandit response">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-sev-green/12 ring-1 ring-sev-green/25">
                <CircleCheckBig className="size-4 text-sev-green" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">{ticket.actionName}</div>
                <div className="truncate font-mono text-[11.5px] text-muted">{ticket.actionDetail}</div>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-lg bg-ink/[0.04] px-3 py-2">
                <dt className="text-muted">Expected reward</dt>
                <dd className="mt-0.5 font-semibold text-ink tabular-nums">{ticket.expectedReward.toFixed(2)}</dd>
              </div>
              <div className="rounded-lg bg-ink/[0.04] px-3 py-2">
                <dt className="text-muted">Policy</dt>
                <dd className="mt-0.5 font-semibold text-ink">LinUCB · ε 0.05</dd>
              </div>
            </dl>
            {ticket.assignee && (
              <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
                <UserCheck className="size-4 text-sev-purple" />
                Assigned to <span className="font-medium text-ink">{ticket.assignee}</span>
              </div>
            )}
          </Section>

          <div className="rounded-xl border border-line p-4">
            <div className="eyebrow mb-1">Analyst feedback</div>
            <p className="text-[12.5px] text-muted">Your feedback is used as a reward signal to improve the response policy.</p>
            {ticket.feedback ? (
              <div className="animate-fade-in mt-3 flex items-center gap-2 rounded-lg bg-sev-green/10 px-3 py-2.5 text-[12.5px] font-medium text-sev-green">
                <CircleCheckBig className="size-4" />
                {ticket.feedback === "confirmed" ? "Decision confirmed" : "Decision overridden"} — reward signal sent to bandit
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => recordFeedback(ticket.id, "confirmed")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-sev-green/30 bg-sev-green/10 px-3 py-2 text-[12.5px] font-semibold text-sev-green transition-colors hover:bg-sev-green/15"
                >
                  <ThumbsUp className="size-4" /> Confirm decision
                </button>
                <button
                  type="button"
                  onClick={() => recordFeedback(ticket.id, "overridden")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-line bg-ink/[0.04] px-3 py-2 text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
                >
                  <ThumbsDown className="size-4" /> Override
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
