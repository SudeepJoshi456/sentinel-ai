import { TopBar } from "@/components/TopBar";
import { StatCards } from "@/components/StatCards";
import { TicketFeed } from "@/components/TicketFeed";
import { PerformancePanel } from "@/components/PerformancePanel";
import { ActionLog } from "@/components/ActionLog";
import { ReportBanner } from "@/components/ReportBanner";

export default function DashboardPage() {
  return (
    <>
      <TopBar />
      <StatCards />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2.15fr)_minmax(340px,1fr)]">
        <TicketFeed />
        <div className="flex flex-col gap-5">
          <PerformancePanel />
          <ActionLog />
        </div>
      </div>
      <ReportBanner />
    </>
  );
}
