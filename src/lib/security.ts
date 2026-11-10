export const MAX_REPORT_CHARS = 1000;

/** Strip control characters, collapse whitespace and cap length before anything touches the text. */
export function sanitizeReport(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_REPORT_CHARS);
}

const INJECTION_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "Instruction override attempt", re: /\b(ignore|disregard|forget|override)\b.{0,30}\b(previous|prior|above|earlier|all|your)\b.{0,20}\b(instructions?|rules?|prompts?|guidelines?)\b/i },
  { label: "Prompt probing", re: /\b(system prompt|developer (message|prompt)|hidden instructions?|reveal your (prompt|instructions))\b/i },
  { label: "Role manipulation", re: /\b(you are now|act as|pretend (to be|you are)|roleplay as|new persona)\b/i },
  {
    label: "Attempt to steer the decision",
    re: /\b((mark|classify|label|treat|tag) (this|it|the (ticket|report|alert))( report| ticket)? as (benign|safe|low|resolved|false positive)|(do not|don't|never) (escalate|alert|flag|isolate|notify)|auto[- ]?(approve|close|resolve)|approve (this|it|all))\b/i,
  },
  { label: "Script or markup content", re: /<\s*\/?\s*(script|iframe|img|svg|object)\b|javascript:|on(error|load)\s*=/i },
];

/** Heuristic prompt-injection scan. Matches are treated as data to review, never as instructions. */
export function scanForInjection(text: string): string[] {
  return INJECTION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}
