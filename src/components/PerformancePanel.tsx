"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSimulation } from "@/lib/simulation";
import { localHourMinute } from "@/lib/format";

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

export function PerformancePanel({ chartHeight = 150 }: { chartHeight?: number }) {
  const { perf, stats } = useSimulation();
  const data = perf.map((p) => ({ label: localHourMinute(p.t), accuracy: p.accuracy }));
  const lastIndex = data.length - 1;

  const LastPointDot = ({ cx, cy, index }: DotProps) => {
    if (index !== lastIndex || cx === undefined || cy === undefined) return <g />;
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill="#0891b2" opacity={0.18}>
          <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={3.5} fill="#0891b2" stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  };

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Model performance</h2>
          <p className="mt-1 text-[12.5px] text-muted">Accuracy over the current session</p>
        </div>
        <span className="rounded-md bg-sev-green/12 px-2 py-1 text-[11.5px] font-semibold text-sev-green tabular-nums">
          ▲ +{stats.sessionGain.toFixed(1)}%
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span key={stats.rewardScore} className="animate-count-bump text-[32px] font-bold tracking-tight text-ink tabular-nums">
          {stats.rewardScore.toFixed(1)}%
        </span>
        <span className="text-[12px] text-muted">current accuracy</span>
      </div>

      <div className="-mx-2 mt-3" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0891b2" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#0891b2" stopOpacity={0} />
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
            <YAxis hide domain={[88, 97]} />
            <Tooltip
              cursor={{ stroke: "#0891b2", strokeOpacity: 0.3 }}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e2e7ef",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
              }}
              labelStyle={{ color: "#5b6478", marginBottom: 2 }}
              itemStyle={{ color: "#0891b2", padding: 0 }}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "Accuracy"]}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#0891b2"
              strokeWidth={2}
              fill="url(#accFill)"
              isAnimationActive={false}
              dot={<LastPointDot />}
              activeDot={{ r: 4, fill: "#0891b2", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
