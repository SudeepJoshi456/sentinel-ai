import { Settings } from "lucide-react";
import { TopBar } from "@/components/TopBar";

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Workspace, integrations and response-policy configuration." />
      <section className="panel grid place-items-center px-6 py-24 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-accent/12 ring-1 ring-accent/25">
          <Settings className="size-5 text-accent" />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-ink">Coming soon</h2>
        <p className="mt-1.5 max-w-sm text-[13px] text-muted">
          Integration credentials, playbook thresholds and bandit exploration settings will live here.
        </p>
      </section>
    </>
  );
}
