"use client";

import { ShieldAlert } from "lucide-react";
import { CURRENT_USER, useSimulation } from "@/lib/simulation";
import { greeting, utcClock } from "@/lib/format";

export function TopBar({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { now, paused, togglePaused, stats, openTicket } = useSimulation();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">
          {title ?? `${greeting(now)}, ${CURRENT_USER.firstName}`}
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {subtitle ?? "Here's what SentinelAI has triaged across your environment today."}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {stats.pendingApprovals.length > 0 && (
          <button
            type="button"
            onClick={() => openTicket(stats.pendingApprovals[0].id)}
            title="Open the oldest ticket awaiting approval"
            className="animate-fade-in flex items-center gap-2 rounded-full bg-sev-amber/12 px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] text-sev-amber ring-1 ring-sev-amber/35 transition-colors hover:bg-sev-amber/20"
          >
            <ShieldAlert className="size-3.5" />
            {stats.pendingApprovals.length} AWAITING APPROVAL
          </button>
        )}
        <button
          type="button"
          onClick={togglePaused}
          title={paused ? "Resume live simulation" : "Pause live simulation"}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-[0.1em] ring-1 transition-colors ${
            paused
              ? "bg-ink/5 text-muted ring-line hover:text-ink"
              : "bg-accent/12 text-accent ring-accent/30 hover:bg-accent/18"
          }`}
        >
          <span className={`pulse-dot ${paused ? "is-paused text-muted" : "text-sev-green"}`} />
          {paused ? "PAUSED" : "LEARNING LIVE"}
          <span className={`wave ${paused ? "is-paused" : ""}`} aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="text-[12px] text-muted">
          Last sync <span className="font-mono text-ink/90 tabular-nums">{utcClock(now)}</span> UTC
        </div>
      </div>
    </header>
  );
}
