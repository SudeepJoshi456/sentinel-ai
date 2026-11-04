import type { Category, Decision, Severity } from "@/lib/types";

type Tone = "red" | "amber" | "blue" | "green" | "purple" | "teal";

const TONE_CLASSES: Record<Tone, string> = {
  red: "bg-sev-red/15 text-sev-red",
  amber: "bg-sev-amber/15 text-sev-amber",
  blue: "bg-sev-blue/15 text-sev-blue",
  green: "bg-sev-green/15 text-sev-green",
  purple: "bg-sev-purple/15 text-sev-purple",
  teal: "bg-accent/15 text-accent",
};

const CATEGORY_TONE: Record<Category, Tone> = {
  PHISHING: "amber",
  MALWARE: "red",
  "POLICY VIOLATION": "amber",
  BENIGN: "green",
};

const SEVERITY_TONE: Record<Severity, Tone> = {
  CRITICAL: "red",
  HIGH: "amber",
  MEDIUM: "blue",
  LOW: "green",
};

const DECISION_TONE: Record<Decision, Tone> = {
  ESCALATED: "purple",
  REMEDIATED: "green",
  MONITORING: "blue",
  "AUTO-RESOLVED": "green",
};

export function Pill({ tone, children, className = "" }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-[3px] text-[10px] font-bold leading-none tracking-[0.06em] uppercase ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const CategoryPill = ({ value }: { value: Category }) => <Pill tone={CATEGORY_TONE[value]}>{value}</Pill>;
export const SeverityPill = ({ value }: { value: Severity }) => <Pill tone={SEVERITY_TONE[value]}>{value}</Pill>;
export const DecisionPill = ({ value }: { value: Decision }) => <Pill tone={DECISION_TONE[value]}>{value}</Pill>;
