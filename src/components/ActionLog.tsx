"use client";

import { Check, CircleHelp } from "lucide-react";
import { useSimulation } from "@/lib/simulation";
import { relativeTime } from "@/lib/format";
import type { ActionLogEntry } from "@/lib/types";

const shortName = (name: string) => {
  const [first, ...rest] = name.split(" ");
  return rest.length ? `${first[0]}. ${rest.join(" ")}` : name;
};

function KindBadge({ entry }: { entry: ActionLogEntry }) {
  if (entry.kind === "ANALYST") {
    return (
      <span className="rounded-md bg-[#7c5cf0] px-1.5 py-[3px] text-[9.5px] leading-none font-bold tracking-[0.06em] whitespace-nowrap text-white uppercase">
        Analyst{entry.analyst ? ` · ${shortName(entry.analyst)}` : ""}
      </span>
    );
  }
  return (
    <span className="rounded-md border border-accent/45 px-1.5 py-[2px] text-[9.5px] leading-none font-bold tracking-[0.06em] text-accent uppercase">
      Automated
    </span>
  );
}

export function ActionLog({ limit = 5 }: { limit?: number }) {
  const { actions, now, highlighted, openTicket } = useSimulation();

  return (
    <section className="panel flex min-h-0 flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Action log</h2>
          <p className="mt-1 text-[12.5px] text-muted">Latest automated responses</p>
        </div>
        <span
          className="text-subtle hover:text-muted"
          title="Response actions chosen by the contextual bandit policy. Analyst entries show human overrides, escalations and feedback."
        >
          <CircleHelp className="size-4" />
        </span>
      </div>

      <ul className="mt-3 flex flex-col">
        {actions.slice(0, limit).map((a) => (
          <li
            key={a.id}
            onClick={() => openTicket(a.ticketId)}
            className={`-mx-2 flex cursor-pointer items-center gap-3 rounded-lg border-b border-line-soft px-2 py-2.5 transition-colors last:border-b-0 hover:bg-ink/[0.035] ${
              highlighted.has(a.ticketId) ? "animate-slide-down bg-accent/[0.05]" : ""
            }`}
          >
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-sev-green/12 ring-1 ring-sev-green/25">
              <Check className="size-3.5 text-sev-green" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{a.name}</div>
              <div className="truncate font-mono text-[11px] text-muted">{a.detail}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[10.5px] text-subtle tabular-nums">{relativeTime(a.createdAt, now)}</span>
              <KindBadge entry={a} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
