"use client";

import { FlaskConical } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PerformancePanel } from "@/components/PerformancePanel";
import { StatCards } from "@/components/StatCards";
import { useSimulation } from "@/lib/simulation";
import { ACTIONS, describeContext, learnedPolicy } from "@/lib/bandit";
import { AUTO_EXECUTE_CONFIDENCE, FEEDBACK_RATE, MIN_OBSERVATIONS, REVIEW_THRESHOLD } from "@/lib/engine";
import { CATEGORIES } from "@/lib/types";

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-ink/[0.03] px-3 py-2.5">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="mt-0.5 text-[18px] font-bold text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

export default function AnalyticsPage() {
  const { metrics: m, bandit, stats } = useSimulation();

  const rows = CATEGORIES.map((c) => {
    const tp = m.confusion[c][c];
    const actual = CATEGORIES.reduce((s, p) => s + m.confusion[c][p], 0);
    const predicted = CATEGORIES.reduce((s, t) => s + m.confusion[t][c], 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = actual ? tp / actual : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { c, tp, actual, predicted, precision, recall, f1 };
  });
  const totalLabeled = rows.reduce((s, r) => s + r.actual, 0);
  const correct = rows.reduce((s, r) => s + r.tp, 0);
  const errors = totalLabeled - correct;
  const policy = learnedPolicy(bandit).slice(0, 10);
  const totalFeedback = m.feedback.correct + m.feedback.wrong_action + m.feedback.wrong_category;
  const executed = m.execution.success + m.execution.retried + m.execution.failed;

  return (
    <>
      <TopBar title="Analytics" subtitle="Evaluation of the classifier, response policy and guardrails for this session." />

      <div className="flex items-start gap-3 rounded-xl border border-sev-amber/30 bg-sev-amber/[0.06] px-4 py-3 text-[12.5px] text-ink">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-sev-amber" />
        <p>
          <span className="font-semibold">Simulated evaluation.</span>{" "}
          <span className="text-muted">
            Metrics are computed against the simulator&apos;s hidden ground truth on {m.scored.toLocaleString("en-US")} synthetic
            alerts. They show the evaluation method and relative behavior, not field results; a real study would use a labeled alert
            set and compare analyst time and accuracy against the current workflow.
          </span>
        </p>
      </div>

      <StatCards />
      <PerformancePanel chartHeight={240} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Classifier quality" subtitle={`Precision and recall per category · ${totalLabeled} labeled alerts`}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">
                <th className="pb-2">Category</th>
                <th className="pb-2 text-right">Precision</th>
                <th className="pb-2 text-right">Recall</th>
                <th className="pb-2 text-right">F1</th>
                <th className="pb-2 text-right">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c} className="border-t border-line-soft">
                  <td className="py-2 font-semibold tracking-[0.04em] text-ink/90">{r.c}</td>
                  <td className="py-2 text-right tabular-nums">{(r.precision * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums">{(r.recall * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums">{r.f1.toFixed(2)}</td>
                  <td className="py-2 text-right text-muted tabular-nums">{r.actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="Overall accuracy" value={pct(correct, totalLabeled)} />
            <Metric label="Errors caught by review" value={`${m.errorsCaught} / ${errors}`} hint={`confidence < ${REVIEW_THRESHOLD}%`} />
            <Metric label="Confident errors" value={String(m.errorsMissed)} hint="slipped past the threshold" />
          </div>
        </Panel>

        <Panel title="Response policy" subtitle="Contextual bandit vs. fixed playbook on the same alerts">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="SentinelAI avg reward (session)" value={pct(m.cumSentinel, m.scored)} />
            <Metric label="Fixed playbook avg reward" value={pct(m.cumBaseline, m.scored)} />
            <Metric label="Policy updates from feedback" value={m.banditUpdates.toLocaleString("en-US")} hint={`${FEEDBACK_RATE * 100}% of automated decisions reviewed`} />
            <Metric
              label="Approvals"
              value={`${m.approvals.approved} ✓ · ${m.approvals.rejected} ✗`}
              hint={`${stats.pendingApprovals.length} waiting now`}
            />
          </div>
          <div className="mt-4 text-[12px] text-muted">
            Your feedback this session: <span className="font-medium text-ink">{totalFeedback}</span> ({m.feedback.correct} correct,{" "}
            {m.feedback.wrong_action} wrong action, {m.feedback.wrong_category} wrong category)
          </div>
        </Panel>

        <Panel title="What the policy has learned" subtitle="Current best action per context (category · source · severity)">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">
                <th className="pb-2">Context</th>
                <th className="pb-2">Best action</th>
                <th className="pb-2 text-right">Est. reward</th>
                <th className="pb-2 text-right">History</th>
              </tr>
            </thead>
            <tbody>
              {policy.map((p) => {
                const ctx = describeContext(p.ctx);
                return (
                  <tr key={p.ctx} className="border-t border-line-soft">
                    <td className="py-2 pr-2">
                      <div className="font-semibold tracking-[0.03em] text-ink/90">{ctx.category}</div>
                      <div className="text-[11px] text-muted">
                        {ctx.source} · {ctx.bucket === "high" ? "high/critical" : "medium/low"}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="text-ink">{ACTIONS[p.best.actionId].label}</div>
                      {p.runnerUp && <div className="text-[11px] text-subtle">next: {ACTIONS[p.runnerUp.actionId].label}</div>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.best.mean.toFixed(2)}</td>
                    <td className="py-2 text-right text-muted tabular-nums">{p.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Guardrails & reliability" subtitle="Human oversight and simulated execution outcomes">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Routed for low confidence" value={String(m.lowConfidenceRouted)} hint={`below ${REVIEW_THRESHOLD}%`} />
              <Metric label="Untrusted input flagged" value={String(m.inputFlagged)} hint="automation blocked" />
              <Metric
                label="Execution success"
                value={pct(m.execution.success + m.execution.retried, executed)}
                hint={`${m.execution.retried} needed a retry · ${m.execution.failed} failed`}
              />
              <Metric label="Auto-execute rule" value={`≥ ${AUTO_EXECUTE_CONFIDENCE}%`} hint={`and ≥ ${MIN_OBSERVATIONS} reviewed outcomes`} />
            </div>
          </Panel>

          <Panel title="LLM usage & cost" subtitle="Requests to the external model for submitted reports">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="LLM requests" value={String(m.llm.calls)} hint={`${m.llm.successes} succeeded`} />
              <Metric label="Fell back to offline rules" value={String(m.llm.fallbacks)} hint={m.llm.lastFallbackReason ? `last: ${m.llm.lastFallbackReason}` : undefined} />
              <Metric label="Avg latency" value={m.llm.successes ? `${Math.round(m.llm.totalLatencyMs / m.llm.successes)} ms` : "—"} />
              <Metric
                label="Est. cost"
                value={`$${m.llm.totalCostUsd.toFixed(4)}`}
                hint={m.llm.successes ? `$${(m.llm.totalCostUsd / m.llm.successes).toFixed(5)} per report` : "set OPENAI_API_KEY to enable"}
              />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
