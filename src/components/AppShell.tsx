"use client";

import type { ReactNode } from "react";
import { SimulationProvider } from "@/lib/simulation";
import { Sidebar } from "./Sidebar";
import { TicketDrawer } from "./TicketDrawer";
import { ReportModal } from "./ReportModal";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SimulationProvider fallback={<div className="min-h-screen bg-canvas" />}>
      <Sidebar />
      <main className="min-h-screen pl-[260px]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-7 py-6">{children}</div>
      </main>
      <TicketDrawer />
      <ReportModal />
    </SimulationProvider>
  );
}
