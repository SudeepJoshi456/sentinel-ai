"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Category, Severity, Ticket } from "@/lib/types";

const CATEGORIES: Category[] = ["PHISHING", "MALWARE", "POLICY VIOLATION", "BENIGN"];
const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export interface FilterState {
  categories: Category[];
  severities: Severity[];
}

export const EMPTY_FILTERS: FilterState = { categories: [], severities: [] };

export function applyFilters(tickets: Ticket[], f: FilterState) {
  return tickets.filter(
    (t) =>
      (f.categories.length === 0 || f.categories.includes(t.category)) &&
      (f.severities.length === 0 || f.severities.includes(t.severity)),
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FiltersButton({ value, onChange }: { value: FilterState; onChange: (f: FilterState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = value.categories.length + value.severities.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-[0.05em] transition-colors ${
        active ? "bg-accent/15 text-accent ring-1 ring-accent/40" : "bg-ink/[0.05] text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
          open || activeCount ? "border-accent/40 text-ink" : "border-line text-muted hover:border-subtle hover:text-ink"
        }`}
      >
        <SlidersHorizontal className="size-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="rounded bg-accent px-1.5 text-[10.5px] font-bold text-white">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="animate-pop-in absolute top-full right-0 z-20 mt-2 w-[280px] rounded-xl border border-line bg-panel-2 p-4 shadow-2xl shadow-slate-900/12">
          <div className="eyebrow mb-2">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) =>
              chip(c, value.categories.includes(c), () => onChange({ ...value, categories: toggle(value.categories, c) })),
            )}
          </div>
          <div className="eyebrow mt-4 mb-2">Severity</div>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) =>
              chip(s, value.severities.includes(s), () => onChange({ ...value, severities: toggle(value.severities, s) })),
            )}
          </div>
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              disabled={activeCount === 0}
              className="text-[12px] font-medium text-accent disabled:text-subtle"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
