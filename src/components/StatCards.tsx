"use client";

import { CircleCheckBig, Inbox, Target, UserCheck, type LucideIcon } from "lucide-react";
import { useSimulation } from "@/lib/simulation";
import { formatInt } from "@/lib/format";

interface CardProps {
  label: string;
  value: string;
  trend: number;
  trendSuffix?: string;
  caption: string;
  icon: LucideIcon;
}

function StatCard({ label, value, trend, trendSuffix = "%", caption, icon: Icon }: CardProps) {
  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <div className="grid size-9 place-items-center rounded-lg bg-accent/10 ring-1 ring-accent/15">
          <Icon className="size-[18px] text-accent" strokeWidth={2} />
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2.5">
        <span key={value} className="animate-count-bump text-[30px] font-bold tracking-tight text-ink tabular-nums">
          {value}
        </span>
        <span className={`text-[12px] font-semibold tabular-nums ${trend >= 0 ? "text-sev-green" : "text-sev-red"}`}>
          {trend >= 0 ? "▲ +" : "▼ "}
          {trend.toFixed(1)}
          {trendSuffix}
        </span>
      </div>
      <span className="mt-1 text-[11.5px] text-subtle">{caption}</span>
    </div>
  );
}

export function StatCards() {
  const { stats } = useSimulation();
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label="Total Tickets Processed"
        value={formatInt(stats.totalProcessed)}
        trend={stats.trends.total}
        caption="vs. previous 24 hours"
        icon={Inbox}
      />
      <StatCard
        label="Auto-Resolved"
        value={`${stats.autoResolvedPct.toFixed(1)}%`}
        trend={stats.trends.autoPct}
        caption="Handled without analyst touch"
        icon={CircleCheckBig}
      />
      <StatCard
        label="Escalated to Analyst"
        value={formatInt(stats.escalated)}
        trend={stats.trends.escalated}
        caption="Routed for human review"
        icon={UserCheck}
      />
      <StatCard
        label="Model Reward Score"
        value={`${stats.rewardScore.toFixed(1)}%`}
        trend={stats.trends.reward}
        trendSuffix=" pts"
        caption="vs. fixed playbook · last 50 decisions"
        icon={Target}
      />
    </section>
  );
}
