import type { Classification } from "./types";
import { classifyReportRules } from "./classifier";
import { sanitizeReport, scanForInjection } from "./security";

const CLIENT_TIMEOUT_MS = 9_000;

export interface TriageResult {
  text: string;
  classification: Classification;
  inputFlags: string[];
}

/**
 * Classify a free-text report: try the server-side LLM (if configured), and fall back to the
 * offline keyword classifier on any failure, so the demo never breaks.
 */
export async function triageReport(raw: string): Promise<TriageResult> {
  const text = sanitizeReport(raw);
  const inputFlags = scanForInjection(text);

  let fallbackReason = "unavailable";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.classification) {
        const flags = data.injectionSuspected && !inputFlags.length ? ["LLM flagged instruction-like content"] : inputFlags;
        return { text, classification: data.classification as Classification, inputFlags: flags };
      }
      fallbackReason = typeof data?.reason === "string" ? data.reason : fallbackReason;
    } else {
      fallbackReason = res.status === 404 ? "not configured" : `server error ${res.status}`;
    }
  } catch (err) {
    fallbackReason = err instanceof Error && err.name === "AbortError" ? "timed out" : "offline";
  }

  const { matchedKeywords: _matched, ...rules } = classifyReportRules(text);
  return { text, classification: { ...rules, fallbackReason }, inputFlags };
}
