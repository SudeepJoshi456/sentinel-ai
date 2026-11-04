"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSimulation } from "@/lib/simulation";
import { TicketTable } from "./TicketTable";
import { applyFilters, EMPTY_FILTERS, FiltersButton } from "./Filters";

const VISIBLE_ROWS = 7;

export function TicketFeed() {
  const { tickets, stats, paused } = useSimulation();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const visible = applyFilters(tickets, filters).slice(0, VISIBLE_ROWS);

  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-ink">Live ticket feed</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                paused ? "bg-ink/5 text-muted" : "bg-sev-green/12 text-sev-green"
              }`}
            >
              <span className={`pulse-dot size-1.5! ${paused ? "is-paused" : ""}`} />
              {paused ? "Paused" : "Streaming"}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted">AI-triaged security events from the last 30 minutes</p>
        </div>
        <FiltersButton value={filters} onChange={setFilters} />
      </div>

      <div className="flex-1">
        <TicketTable tickets={visible} />
      </div>

      <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
        <span className="text-[12px] text-muted tabular-nums">
          Showing {visible.length} of {stats.activeTickets} active tickets
        </span>
        <Link
          href="/tickets"
          className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:text-accent-strong"
        >
          View all tickets
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
