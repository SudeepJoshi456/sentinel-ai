"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { TicketTable } from "@/components/TicketTable";
import { applyFilters, EMPTY_FILTERS, FiltersButton } from "@/components/Filters";
import { useSimulation } from "@/lib/simulation";

export default function TicketsPage() {
  const { tickets } = useSimulation();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const visible = applyFilters(tickets, filters);

  return (
    <>
      <TopBar title="Tickets" subtitle="Every event triaged by SentinelAI during this session." />
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">All tickets</h2>
            <p className="mt-1 text-[12.5px] text-muted tabular-nums">
              {visible.length} of {tickets.length} tickets in this session
            </p>
          </div>
          <FiltersButton value={filters} onChange={setFilters} />
        </div>
        <TicketTable tickets={visible} />
      </section>
    </>
  );
}
