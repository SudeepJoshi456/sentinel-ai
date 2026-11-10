"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  CircleAlert,
  CircleCheckBig,
  FlaskConical,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Tag,
  UserCheck,
  X,
} from "lucide-react";
import { useSimulation } from "@/lib/simulation";
import { localClock, relativeTime } from "@/lib/format";
import { ACTIONS, CANDIDATES, armObservations, armStats, getArm } from "@/lib/bandit";
import { AUTO_EXECUTE_CONFIDENCE, REVIEW_THRESHOLD } from "@/lib/engine";
import { CATEGORIES, type ActionId, type Category, type Ticket } from "@/lib/types";
import { CategoryPill, DecisionPill, SeverityPill } from "./Pill";
import { SourceTag } from "./SourceTag";

function Section({ icon: Icon, title, aside, children }: { icon: typeof Brain; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-canvas/40 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <span className="eyebrow flex-1 text-ink/80">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function ClassifierBadge({ t }: { t: Ticket }) {
  if (t.classifierSource === "llm" && t.llm) {
    return (
      <span className="text-[11px] text-muted tabular-nums">
        {t.llm.model} · {t.llm.latencyMs} ms · ${t.llm.costUsd.toFixed(5)}
      </span>
    );
  }
  if (t.classifierSource === "rules") {
    return <span className="text-[11px] text-muted">Offline rules{t.fallbackReason ? ` · LLM ${t.fallbackReason}` : ""}</span>;
  }
  return <span className="text-[11px] text-muted">Simulated model</span>;
}

function ApprovalBox({ t }: { t: Ticket }) {
  const { decideApproval } = useSimulation();
  const a = t.approval!;
  if (a.status !== "pending") {
    return (
      <div
        className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium ${
          a.status === "approved" ? "bg-sev-green/10 text-sev-green" : "bg-sev-purple/10 text-sev-purple"
        }`}
      >
        <UserCheck className="size-4" />
        {a.status === "approved" ? "Approved" : "Rejected — escalated instead"} by {a.by}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-sev-amber/35 bg-sev-amber/[0.07] p-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-sev-amber" />
        <div className="text-[12.5px] text-ink">
          <span className="font-semibold">Human approval required.</span> <span className="text-muted">{a.reason}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => decideApproval(t.id, true)}
          className="rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Approve &amp; execute
        </button>
        <button
          type="button"
          onClick={() => decideApproval(t.id, false)}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
        >
          Reject → escalate
        </button>
      </div>
    </div>
  );
}

function FeedbackBox({ t }: { t: Ticket }) {
  const { recordFeedback, bandit } = useSimulation();
  const [mode, setMode] = useState<"idle" | "wrong_action" | "wrong_category">("idle");
  const [choice, setChoice] = useState<string>("");

  if (t.feedback) {
    const arm = getArm(bandit, t.contextKey, t.actionId);
    return (
      <div className="animate-fade-in mt-3 rounded-lg bg-sev-green/10 px-3 py-2.5 text-[12.5px] text-sev-green">
        <div className="flex items-center gap-2 font-medium">
          <CircleCheckBig className="size-4" /> Feedback recorded — reward sent to the bandit
        </div>
        <div className="mt-1 pl-6 text-[11.5px] text-muted tabular-nums">
          Policy now rates “{ACTIONS[t.actionId].label}” here at {armStats(arm).mean.toFixed(2)} (
          {armObservations(bandit, t.contextKey, t.actionId)} reviewed outcomes)
        </div>
      </div>
    );
  }

  if (t.approval?.status === "pending") {
    return <p className="mt-2 text-[12px] text-subtle">Available after the approval decision.</p>;
  }

  if (mode !== "idle") {
    const options =
      mode === "wrong_action"
        ? CANDIDATES[t.category].filter((a) => a !== t.actionId).map((a) => ({ value: a, label: ACTIONS[a].label }))
        : CATEGORIES.filter((c) => c !== t.category).map((c) => ({ value: c, label: c }));
    return (
      <div className="mt-3 space-y-2">
        <label className="block text-[12px] font-medium text-ink">
          {mode === "wrong_action" ? "What should the response have been?" : "What is the correct category?"}
        </label>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] text-ink focus:border-accent/50 focus:outline-none"
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setMode("idle")} className="px-3 py-1.5 text-[12px] text-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            disabled={!choice}
            onClick={() =>
              recordFeedback(
                t.id,
                mode === "wrong_action"
                  ? { kind: "wrong_action", correctAction: choice as ActionId }
                  : { kind: "wrong_category", correctCategory: choice as Category },
              )
            }
            className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white disabled:bg-ink/10 disabled:text-subtle"
          >
            Submit feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => recordFeedback(t.id, { kind: "correct" })}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-sev-green/30 bg-sev-green/10 px-2 py-2 text-[12px] font-semibold text-sev-green transition-colors hover:bg-sev-green/15"
      >
        <ThumbsUp className="size-3.5" /> Correct
      </button>
      <button
        type="button"
        onClick={() => setMode("wrong_action")}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-ink/[0.04] px-2 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ThumbsDown className="size-3.5" /> Wrong action
      </button>
      <button
        type="button"
        onClick={() => setMode("wrong_category")}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-ink/[0.04] px-2 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <Tag className="size-3.5" /> Wrong category
      </button>
    </div>
  );
}

export function TicketDrawer() {
  const { tickets, openTicketId, closeTicket, now } = useSimulation();
  const ticket = openTicketId ? tickets.find((t) => t.id === openTicketId) : undefined;

  useEffect(() => {
    if (!openTicketId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTicket();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTicketId, closeTicket]);

  if (!ticket) return null;
  const t = ticket;
  const overridden = t.recommendedAction !== t.actionId;

  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={closeTicket} />
      <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-[500px] max-w-full flex-col border-l border-line bg-panel shadow-2xl shadow-slate-900/15">
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <div className="font-mono text-[15px] font-semibold text-accent">{t.id}</div>
            <div className="mt-1 text-[12px] text-muted tabular-nums">
              Received {localClock(t.createdAt)} · {relativeTime(t.createdAt, now)}
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
            <CategoryPill value={t.category} />
            <SeverityPill value={t.severity} />
            <DecisionPill value={t.decision} />
          </div>

          <div>
            <div className="eyebrow mb-1.5">Event description</div>
            <p className="text-[14px] leading-relaxed break-words text-ink">{t.description}</p>
            <div className="mt-2">
              <SourceTag source={t.source} />
            </div>
          </div>

          {t.inputFlags && (
            <div className="flex items-start gap-2 rounded-lg border border-sev-red/30 bg-sev-red/[0.06] px-3 py-2.5 text-[12.5px]">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-sev-red" />
              <div>
                <span className="font-semibold text-ink">Untrusted input flagged:</span>{" "}
                <span className="text-muted">
                  {t.inputFlags.join(", ")}. The text was treated as data, not instructions; automated actions were blocked and the
                  ticket was routed to an analyst.
                </span>
              </div>
            </div>
          )}

          <Section icon={Brain} title="Classification" aside={<ClassifierBadge t={t} />}>
            <p className="text-[13px] leading-relaxed text-ink/90">{t.reasoning}</p>
            <div className="mt-3.5 flex items-center gap-3">
              <span className="text-[11.5px] text-muted">Confidence</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <div
                  className={`h-full rounded-full ${t.confidence < REVIEW_THRESHOLD ? "bg-sev-amber" : "bg-accent"}`}
                  style={{ width: `${t.confidence}%` }}
                />
              </div>
              <span className="text-[12.5px] font-semibold text-ink tabular-nums">{t.confidence.toFixed(1)}%</span>
            </div>
            {t.guardrail === "low_confidence" && (
              <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-sev-amber">
                <CircleAlert className="size-3.5" /> Below the {REVIEW_THRESHOLD}% review threshold — routed to an analyst instead of
                auto-acting.
              </p>
            )}
          </Section>

          <Section icon={GitBranch} title="Bandit response">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-sev-green/12 ring-1 ring-sev-green/25">
                <CircleCheckBig className="size-4 text-sev-green" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">{ACTIONS[t.actionId].label}</div>
                <div className="truncate font-mono text-[11.5px] text-muted">{t.actionDetail}</div>
              </div>
            </div>
            {overridden && (
              <p className="mt-2 text-[11.5px] text-muted">
                Bandit recommended <span className="font-medium text-ink">{ACTIONS[t.recommendedAction].label}</span>; a guardrail
                replaced it with escalation.
              </p>
            )}

            <div className="mt-3.5">
              <div className="mb-1.5 flex justify-between text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">
                <span>Options considered</span>
                <span>Est. reward · history</span>
              </div>
              <ul className="space-y-1.5">
                {t.arms.slice(0, 4).map((arm) => (
                  <li key={arm.actionId} className="flex items-center gap-2 text-[12px]">
                    <span className={`w-36 truncate ${arm.actionId === t.recommendedAction ? "font-semibold text-ink" : "text-muted"}`}>
                      {ACTIONS[arm.actionId].label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                      <div
                        className={`h-full rounded-full ${arm.actionId === t.recommendedAction ? "bg-accent" : "bg-subtle/50"}`}
                        style={{ width: `${arm.mean * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-muted tabular-nums">
                      {arm.mean.toFixed(2)} · n={arm.n}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-subtle">
                Beta-UCB policy for context <span className="font-mono">{t.contextKey.replaceAll("|", " · ")}</span>. Only allow-listed
                actions for this category can be chosen.
              </p>
            </div>

            {t.approval && <ApprovalBox t={t} />}
            {t.assignee && (t.decision === "ESCALATED" || t.approval?.status === "pending") && (
              <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
                <UserCheck className="size-4 text-sev-purple" />
                Assigned to <span className="font-medium text-ink">{t.assignee}</span>
              </div>
            )}
          </Section>

          {(t.execution || t.approval?.status === "pending") && (
            <Section
              icon={FlaskConical}
              title="Execution"
              aside={<span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted">SIMULATED</span>}
            >
              {t.execution ? (
                <p className="text-[12.5px] text-ink/90">
                  {t.execution.status === "success" && "Succeeded on the first attempt."}
                  {t.execution.status === "retried" && "First attempt timed out; succeeded on retry (1 retry max)."}
                  {t.execution.status === "failed" && "Failed after 1 retry — escalated to an analyst for manual action."}
                </p>
              ) : (
                <p className="text-[12.5px] text-muted">Waiting for approval. Nothing has been executed.</p>
              )}
              <p className="mt-1.5 text-[11px] text-subtle">Mock connector — no live system was changed.</p>
            </Section>
          )}

          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" />
              <span className="eyebrow text-ink/80">Analyst feedback</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Judge whether the response was <span className="font-medium text-ink">right for this threat</span> — not whether it was
              fast. Your answer becomes the bandit&apos;s reward signal.
            </p>
            <FeedbackBox key={t.id} t={t} />
          </div>

          <p className="text-[11px] text-subtle">
            Auto-execution policy: high-impact actions need ≥ {AUTO_EXECUTE_CONFIDENCE}% confidence and enough reviewed history;
            otherwise an analyst approves first.
          </p>
        </div>
      </aside>
    </div>
  );
}
