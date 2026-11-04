import { Fingerprint, FileLock, Laptop, Mail, MessageSquareWarning, Network, type LucideIcon } from "lucide-react";
import type { Source } from "@/lib/types";

const SOURCE_ICONS: Record<Source, LucideIcon> = {
  "Identity provider": Fingerprint,
  "EDR / endpoint": Laptop,
  "DLP monitor": FileLock,
  "Network sensor": Network,
  "Email gateway": Mail,
  "User report": MessageSquareWarning,
};

export function SourceTag({ source }: { source: Source }) {
  const Icon = SOURCE_ICONS[source];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
      <Icon className="size-3 shrink-0" strokeWidth={2} />
      {source}
    </span>
  );
}
