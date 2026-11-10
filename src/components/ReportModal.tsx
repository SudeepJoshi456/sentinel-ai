"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, LoaderCircle, Send, ShieldAlert, Sparkles, X } from "lucide-react";
import { CURRENT_USER, useSimulation } from "@/lib/simulation";
import { triageReport, type TriageResult } from "@/lib/triage";
import { ACTIONS } from "@/lib/bandit";
import { MAX_REPORT_CHARS } from "@/lib/security";
import type { Ticket } from "@/lib/types";
import { CategoryPill, DecisionPill, SeverityPill } from "./Pill";

type Phase = "idle" | "classifying" | "selecting" | "done";

const MIN_CLASSIFY_MS = 950;
const SELECT_MS = 850;
const CLOSE_AFTER_MS = 1000;
const CLOSE_AFTER_FLAGGED_MS = 2200;

const SUGGESTIONS = [
  "I got a weird email asking me to reset my password from an unfamiliar address",
  "I downloaded a file from a vendor and now my laptop is showing strange pop-ups",
  "A coworker is uploading confidential customer files to their personal Dropbox",
];

function StepRow({ state, label, doneLabel }: { state: "pending" | "active" | "done"; label: string; doneLabel?: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 ${state === "pending" ? "opacity-40" : "animate-fade-in"}`}>
      <div className="mt-px grid size-5 shrink-0 place-items-center">
        {state === "active" && <LoaderCircle className="size-4 animate-spin text-accent" />}
        {state === "done" && (
          <span className="grid size-4 place-items-center rounded-full bg-sev-green/20">
            <Check className="size-3 text-sev-green" strokeWidth={3} />
          </span>
        )}
        {state === "pending" && <span className="size-1.5 rounded-full bg-muted" />}
      </div>
      <div className="min-w-0 flex-1 text-[13px]">
        {state === "done" && doneLabel ? doneLabel : <span className={state === "active" ? "text-ink" : "text-muted"}>{label}</span>}
      </div>
    </div>
  );
}

export function ReportModal() {
  const { reportOpen, setReportOpen, submitReport } = useSimulation();
  if (!reportOpen) return null;
  return <ReportModalBody onClose={() => setReportOpen(false)} submitReport={submitReport} />;
}

type SubmitFn = ReturnType<typeof useSimulation>["submitReport"];

function ReportModalBody({ onClose, submitReport }: { onClose: () => void; submitReport: SubmitFn }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const timers = useRef<number[]>([]);
  const mounted = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = phase !== "idle";

  useEffect(() => {
    mounted.current = true;
    inputRef.current?.focus();
    const pending = timers.current;
    return () => {
      mounted.current = false;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setSubmitted(value);
    setText("");
    setPhase("classifying");

    const [triage] = await Promise.all([triageReport(value), new Promise((r) => setTimeout(r, MIN_CLASSIFY_MS))]);
    if (!mounted.current) return;
    setResult(triage);
    setPhase("selecting");

    later(() => {
      const created = submitReport(triage.text, triage.classification, triage.inputFlags);
      setTicket(created);
      setPhase("done");
      const needsAttention = created.decision === "PENDING APPROVAL" || created.inputFlags;
      later(onClose, needsAttention ? CLOSE_AFTER_FLAGGED_MS : CLOSE_AFTER_MS);
    }, SELECT_MS);
  };

  const classifierNote = (r: TriageResult) => {
    const c = r.classification;
    if (c.source === "llm" && c.llm) return `${c.llm.model} · ${c.llm.latencyMs} ms`;
    return `offline rules${c.fallbackReason ? ` (LLM ${c.fallbackReason})` : ""}`;
  };

  const stepState = (step: 0 | 1 | 2): "pending" | "active" | "done" => {
    const order: Phase[] = ["classifying", "selecting", "done"];
    const current = order.indexOf(phase);
    if (step === 2) return phase === "done" ? "done" : "pending";
    if (current > step) return "done";
    return current === step ? "active" : "pending";
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="animate-pop-in relative flex w-full max-w-[580px] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-slate-900/15">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-accent/12 ring-1 ring-accent/25">
              <Bot className="size-[18px] text-accent" />
            </div>
            <div>
              <div className="text-[14.5px] font-semibold text-ink">Submit an incident report</div>
              <div className="text-[11.5px] text-muted">SentinelAI triage assistant · classification + response in seconds</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-[260px] flex-col gap-4 px-5 py-5">
          <div className="flex max-w-[85%] items-start gap-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/12">
              <Sparkles className="size-3.5 text-accent" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-panel-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink/90">
              Hi {CURRENT_USER.firstName} — describe what you noticed in plain language. I&apos;ll classify it, pick a
              response, and add it to the live feed.
            </div>
          </div>

          {!submitted && (
            <div className="flex flex-col items-start gap-2 pl-[38px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setText(s);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-line px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {submitted && (
            <div className="animate-fade-in ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
              {submitted}
            </div>
          )}

          {submitted && (
            <div className="animate-pop-in flex max-w-[92%] items-start gap-2.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/12">
                <Sparkles className="size-3.5 text-accent" />
              </div>
              <div className="flex-1 space-y-2.5 rounded-2xl rounded-tl-sm bg-panel-2 px-3.5 py-3">
                <StepRow
                  state={stepState(0)}
                  label="LLM classifying report…"
                  doneLabel={
                    result && (
                      <span className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-ink">
                          Classified as <CategoryPill value={result.classification.category} />{" "}
                          <SeverityPill value={result.classification.severity} />
                          <span className="text-[12px] text-muted tabular-nums">
                            {result.classification.confidence.toFixed(1)}% confidence
                          </span>
                        </span>
                        <span className="text-[11px] text-subtle">via {classifierNote(result)}</span>
                        {result.inputFlags.length > 0 && (
                          <span className="flex items-start gap-1.5 text-[12px] text-sev-red">
                            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                            Untrusted input flagged ({result.inputFlags.join(", ")}) — treated as data, automation blocked.
                          </span>
                        )}
                      </span>
                    )
                  }
                />
                <StepRow
                  state={stepState(1)}
                  label="Bandit selecting action…"
                  doneLabel={
                    ticket && (
                      <span className="flex flex-wrap items-center gap-1.5 text-ink">
                        <span className="font-medium">{ACTIONS[ticket.actionId].label}</span> <DecisionPill value={ticket.decision} />
                        <span className="text-[12px] text-muted tabular-nums">
                          est. reward {(ticket.arms.find((a) => a.actionId === ticket.actionId)?.mean ?? 0).toFixed(2)}
                        </span>
                      </span>
                    )
                  }
                />
                <StepRow
                  state={stepState(2)}
                  label="Creating ticket…"
                  doneLabel={
                    ticket && (
                      <span className="text-ink">
                        Ticket <span className="font-mono font-semibold text-accent">{ticket.id}</span>{" "}
                        {ticket.decision === "PENDING APPROVAL"
                          ? "is waiting for your approval — open it in the feed to approve."
                          : "added to the live feed."}
                      </span>
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line p-4">
          <div
            className={`flex items-end gap-2 rounded-xl border bg-canvas/60 p-2 transition-colors ${
              busy ? "border-line opacity-60" : "border-line focus-within:border-accent/50"
            }`}
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={busy}
              rows={2}
              placeholder="e.g. I got a weird email asking me to reset my password…"
              className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ink placeholder:text-subtle focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || !text.trim()}
              aria-label="Submit report"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-strong disabled:bg-ink/10 disabled:text-subtle"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
          <div className="mt-2 px-1 text-[11px] text-subtle">Press Enter to submit · Shift + Enter for a new line</div>
        </div>
      </div>
    </div>
  );
}
