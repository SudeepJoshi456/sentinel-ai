"use client";

import { ChevronRight } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { useSimulation } from "@/lib/simulation";
import { relativeTime } from "@/lib/format";
import { CategoryPill, DecisionPill, GuardrailTag, SeverityPill } from "./Pill";
import { SourceTag } from "./SourceTag";

const TH = "px-3 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase";

export function TicketTable({ tickets, emptyLabel = "No tickets match the current filters." }: { tickets: Ticket[]; emptyLabel?: string }) {
  const { now, highlighted, openTicket } = useSimulation();

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-[96px]" />
        <col />
        <col className="w-[126px]" />
        <col className="w-[84px]" />
        <col className="w-[114px]" />
        <col className="w-[92px]" />
        <col className="w-[32px]" />
      </colgroup>
      <thead>
        <tr className="border-y border-line bg-ink/[0.025]">
          <th className={`${TH} pl-5`}>Ticket</th>
          <th className={TH}>Event description</th>
          <th className={TH}>Category</th>
          <th className={TH}>Severity</th>
          <th className={TH}>AI decision</th>
          <th className={TH}>Confidence</th>
          <th className={TH} aria-label="Details" />
        </tr>
      </thead>
      <tbody>
        {tickets.length === 0 && (
          <tr>
            <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-muted">
              {emptyLabel}
            </td>
          </tr>
        )}
        {tickets.map((t) => (
          <tr
            key={t.id}
            onClick={() => openTicket(t.id)}
            className={`group cursor-pointer border-b border-line-soft transition-colors last:border-b-0 hover:bg-ink/[0.035] ${
              highlighted.has(t.id) ? "animate-row-enter" : ""
            }`}
          >
            <td className="py-3.5 pr-3 pl-5 align-middle">
              <div className="font-mono text-[12.5px] font-semibold text-accent group-hover:underline">{t.id}</div>
              <div className="mt-0.5 text-[11px] text-muted tabular-nums">{relativeTime(t.createdAt, now)}</div>
            </td>
            <td className="px-3 py-3.5 align-middle">
              <div className="truncate text-[13px] text-ink" title={t.description}>
                {t.description}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <SourceTag source={t.source} />
                {t.guardrail && <GuardrailTag kind={t.guardrail} />}
              </div>
            </td>
            <td className="px-3 py-3.5 align-middle">
              <CategoryPill value={t.category} />
            </td>
            <td className="px-3 py-3.5 align-middle">
              <SeverityPill value={t.severity} />
            </td>
            <td className="px-3 py-3.5 align-middle">
              <DecisionPill value={t.decision} />
            </td>
            <td className="px-3 py-3.5 align-middle">
              <div className="text-[12.5px] font-semibold text-ink tabular-nums">{t.confidence.toFixed(1)}%</div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink/[0.08]">
                <div className="h-full rounded-full bg-accent" style={{ width: `${t.confidence}%` }} />
              </div>
            </td>
            <td className="py-3.5 pr-4 align-middle">
              <ChevronRight className="size-4 text-subtle transition-colors group-hover:text-accent" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
