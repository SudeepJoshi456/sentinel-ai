"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, LayoutDashboard, Settings, ShieldCheck, Ticket, type LucideIcon } from "lucide-react";
import { CURRENT_USER, useSimulation } from "@/lib/simulation";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { stats, paused } = useSimulation();

  const nav: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tickets", label: "Tickets", icon: Ticket, badge: stats.activeTickets },
    { href: "/analytics", label: "Analytics", icon: ChartLine },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-line bg-panel px-4 py-6">
      <Link href="/" className="flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-xl bg-accent/12 ring-1 ring-accent/30">
          <ShieldCheck className="size-5 text-accent" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <div className="text-[17px] font-bold tracking-tight text-ink">
            Sentinel<span className="text-accent">AI</span>
          </div>
          <div className="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted">SECURITY OPERATIONS</div>
        </div>
      </Link>

      <div className="eyebrow mt-9 mb-2.5 px-3">Workspace</div>
      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                active ? "bg-accent/10 text-ink ring-1 ring-accent/20" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              <Icon className={`size-[18px] ${active ? "text-accent" : "text-muted group-hover:text-ink"}`} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span
                  key={item.badge}
                  className="animate-fade-in rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent"
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="eyebrow mt-8 mb-2.5 px-3">System</div>
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center gap-2.5">
          <span className={`pulse-dot ${paused ? "is-paused text-muted" : "text-sev-green"}`} />
          <span className="text-[13px] font-semibold text-ink">
            System Learning: {paused ? "Paused" : "Active"}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          {paused
            ? "Live simulation is paused. Feedback will resume processing shortly."
            : "Reinforcement loop is processing feedback in real time."}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-xl border border-line bg-panel/60 px-3 py-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-sev-purple text-[12px] font-bold text-white">
          {CURRENT_USER.initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-ink">{CURRENT_USER.name}</div>
          <div className="truncate text-[11.5px] text-muted">{CURRENT_USER.role}</div>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </aside>
  );
}
