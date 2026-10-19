import type { SourceKey, SourceMode } from "@/lib/types";

/**
 * Each source runs in "mock" or "live" mode, chosen by an env var.
 * Example in .env.local:  MONDAY_MODE=live
 * Anything other than "live" falls back to mock, so the demo always works.
 */
const ENV_KEYS: Record<SourceKey, string> = {
  calendar: "CALENDAR_MODE",
  monday: "MONDAY_MODE",
  gmail: "GMAIL_MODE",
  semrush: "SEMRUSH_MODE",
  brightlocal: "BRIGHTLOCAL_MODE",
};

export function sourceMode(source: SourceKey): SourceMode {
  return process.env[ENV_KEYS[source]] === "live" ? "live" : "mock";
}

export function summaryMode(): SourceMode {
  return process.env.SUMMARY_MODE === "live" ? "live" : "mock";
}

/** Which env vars a live source needs. Shown on the Settings page. */
export const REQUIRED_ENV: Record<SourceKey | "summary", string[]> = {
  calendar: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  gmail: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  monday: ["MONDAY_API_TOKEN"],
  semrush: ["SEMRUSH_API_KEY"],
  brightlocal: ["BRIGHTLOCAL_API_KEY"],
  summary: ["ANTHROPIC_API_KEY"],
};

export function envStatus(keys: string[]): { key: string; set: boolean }[] {
  return keys.map((key) => ({ key, set: Boolean(process.env[key]) }));
}
