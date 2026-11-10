"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSimulation } from "@/lib/simulation";
import { localHourMinute } from "@/lib/format";
import { ROLLING_WINDOW } from "@/lib/engine";

const ACCENT = "#0891b2";
const BASELINE = "#8a93a6";

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

export function PerformancePanel({ chartHeight = 150 }: { chartHeight?: number }) {
  const { perf, stats } = useSimulation();
  const data = perf.map((p) => ({ label: localHourMinute(p.t), sentinel: p.sentinel, baseline: p.baseline }));
  const lastIndex = data.length - 1;
  const values = data.flatMap((d) => [d.sentinel, d.baseline]);
  const domain = [Math.floor(Math.min(...values) - 3), Math.min(100, Math.ceil(Math.max(...values) + 2))];
  const gain = stats.rewardScore - stats.baselineScore;

  const LastPointDot = ({ cx, cy, index }: DotProps) => {
    if (index !== lastIndex || cx === undefined || cy === undefined) return <g />;
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill={ACCENT} opacity={0.18}>
          <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={3.5} fill={ACCENT} stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  };

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Model performance</h2>
          <p className="mt-1 text-[12.5px] text-muted">Response reward vs. fixed playbook · rolling {ROLLING_WINDOW}</p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap tabular-nums ${
            gain >= 0 ? "bg-sev-green/12 text-sev-green" : "bg-sev-red/12 text-sev-red"
          }`}
        >
          {gain >= 0 ? "▲ +" : "▼ "}
          {gain.toFixed(1)} pts
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span key={stats.rewardScore.toFixed(1)} className="animate-count-bump text-[32px] font-bold tracking-tight text-ink tabular-nums">
          {stats.rewardScore.toFixed(1)}%
        </span>
        <span className="text-[12px] text-muted">SentinelAI</span>
        <span className="ml-2 text-[12px] text-muted tabular-nums">
          <span className="mr-1 inline-block h-0.5 w-3 bg-subtle align-middle" />
          Playbook {stats.baselineScore.toFixed(1)}%
        </span>
      </div>

      <div className="-mx-2 mt-3" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e7ef" strokeDasharray="3 4" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
              tickMargin={8}
            />
            <YAxis hide domain={domain} />
            <Tooltip
              cursor={{ stroke: ACCENT, strokeOpacity: 0.3 }}
              contentStyle={{ background: "#ffffff", border: "1px solid #e2e7ef", borderRadius: 8, fontSize: 12, padding: "6px 10px" }}
              labelStyle={{ color: "#5b6478", marginBottom: 2 }}
              itemStyle={{ padding: 0 }}
              formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name === "sentinel" ? "SentinelAI" : "Fixed playbook"]}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              stroke={BASELINE}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="sentinel"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#accFill)"
              isAnimationActive={false}
              dot={<LastPointDot />}
              activeDot={{ r: 4, fill: ACCENT, stroke: "#ffffff", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
