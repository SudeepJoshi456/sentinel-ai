"use client";

import { MessageSquare, Plus } from "lucide-react";
import { useSimulation } from "@/lib/simulation";

export function ReportBanner() {
  const { setReportOpen } = useSimulation();

  return (
    <section className="panel relative flex flex-wrap items-center justify-between gap-4 overflow-hidden px-6 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-accent/[0.07] to-transparent" />
      <div className="relative flex items-center gap-4">
        <div className="grid size-11 place-items-center rounded-xl bg-accent/12 ring-1 ring-accent/25">
          <MessageSquare className="size-5 text-accent" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink">See something suspicious?</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">Submit an incident report and let SentinelAI triage it instantly.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="relative flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-accent/15 transition-colors hover:bg-accent-strong"
      >
        <Plus className="size-4" strokeWidth={2.6} />
        Submit a report
      </button>
    </section>
  );
}
