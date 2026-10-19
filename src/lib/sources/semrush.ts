import { sourceMode } from "@/lib/config";
import { MOCK_SEMRUSH } from "@/lib/mock/data";
import { fetchSemrushForDomain } from "@/lib/semrush/client";
import type { SemrushData, SourceContext } from "@/lib/types";
import { delay, requireClient } from "./shared";

/**
 * Semrush source.
 * mock: returns demo domain metrics for the matched client.
 * live: Analytics API v3 with SEMRUSH_API_KEY (see lib/semrush/client.ts). Costs API units.
 */
export async function fetchSemrush(ctx: SourceContext): Promise<SemrushData> {
  const client = requireClient(ctx);
  if (sourceMode("semrush") === "live") {
    const domain = client.website || client.domain;
    if (!domain) {
      throw new Error(`${client.name} has no website domain. Add a contact with a company email on the Monday Accounts board.`);
    }
    return fetchSemrushForDomain(domain);
  }

  await delay(1500);
  const data = MOCK_SEMRUSH[client.id];
  if (!data) throw new Error(`No Semrush data for ${client.domain}.`);
  return data;
}
