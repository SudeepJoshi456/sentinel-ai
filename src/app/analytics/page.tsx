"use client";

import { TopBar } from "@/components/TopBar";
import { PerformancePanel } from "@/components/PerformancePanel";
import { StatCards } from "@/components/StatCards";
import { useSimulation } from "@/lib/simulation";
import type { Category, Decision } from "@/lib/types";

const CATEGORY_COLORS: Record<Category, string> = {
  PHISHING: "bg-sev-amber",
  MALWARE: "bg-sev-red",
  "POLICY VIOLATION": "bg-sev-amber/60",
  BENIGN: "bg-sev-green",
};

const DECISION_COLORS: Record<Decision, string> = {
  ESCALATED: "bg-sev-purple",
  REMEDIATED: "bg-sev-green",
  MONITORING: "bg-sev-blue",
  "AUTO-RESOLVED": "bg-sev-green/60",
};

function Breakdown<K extends string>({ title, counts, colors }: { title: string; counts: Record<K, number>; colors: Record<K, string> }) {
  const total = Object.values<number>(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <section className="panel p-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-[12.5px] text-muted">Share of tickets in the current session</p>
      <div className="mt-4 space-y-3.5">
        {(Object.keys(counts) as K[]).map((k) => {
          const pct = (counts[k] / total) * 100;
          return (
            <div key={k}>
              <div className="mb-1.5 flex justify-between text-[12px]">
                <span className="font-semibold tracking-[0.05em] text-ink/90">{k}</span>
                <span className="text-muted tabular-nums">
                  {counts[k]} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                <div className={`h-full rounded-full transition-all duration-500 ${colors[k]}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const { tickets } = useSimulation();
  const byCategory: Record<Category, number> = { PHISHING: 0, MALWARE: 0, "POLICY VIOLATION": 0, BENIGN: 0 };
  const byDecision: Record<Decision, number> = { ESCALATED: 0, REMEDIATED: 0, MONITORING: 0, "AUTO-RESOLVED": 0 };
  for (const t of tickets) {
    byCategory[t.category]++;
    byDecision[t.decision]++;
  }

  return (
    <>
      <TopBar title="Analytics" subtitle="Model and response-policy performance for this session." />
      <StatCards />
      <PerformancePanel chartHeight={260} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Breakdown title="Tickets by category" counts={byCategory} colors={CATEGORY_COLORS} />
        <Breakdown title="AI decisions" counts={byDecision} colors={DECISION_COLORS} />
      </div>
    </>
  );
}
