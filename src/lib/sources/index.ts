import { sourceMode } from "@/lib/config";
import type { SourceContext, SourceKey, SourceResult } from "@/lib/types";
import { fetchBrightLocal } from "./brightlocal";
import { fetchGmail } from "./gmail";
import { fetchMonday } from "./monday";
import { fetchSemrush } from "./semrush";

const FETCHERS: Record<Exclude<SourceKey, "calendar">, (ctx: SourceContext) => Promise<unknown>> = {
  monday: fetchMonday,
  gmail: fetchGmail,
  semrush: fetchSemrush,
  brightlocal: fetchBrightLocal,
};

export function isDataSource(key: string): key is Exclude<SourceKey, "calendar"> {
  return key in FETCHERS;
}

/** Run one source and wrap the outcome so the UI never has to handle a thrown error. */
export async function runSource(
  source: Exclude<SourceKey, "calendar">,
  ctx: SourceContext,
): Promise<SourceResult> {
  const mode = sourceMode(source);
  try {
    const data = await FETCHERS[source](ctx);
    return { source, mode, ok: true, data, fetchedAt: new Date().toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { source, mode, ok: false, error: message, fetchedAt: new Date().toISOString() };
  }
}
