import { sourceMode } from "@/lib/config";
import { MOCK_MONDAY } from "@/lib/mock/data";
import { fetchMondayForClient } from "@/lib/monday/client";
import type { MondayData, SourceContext } from "@/lib/types";
import { delay, requireClient } from "./shared";

/**
 * Monday.com source.
 * mock: returns the demo board for the matched client.
 * live: GraphQL API with MONDAY_API_TOKEN (see lib/monday/client.ts).
 */
export async function fetchMonday(ctx: SourceContext): Promise<MondayData> {
  const client = requireClient(ctx);
  if (sourceMode("monday") === "live") return fetchMondayForClient(client);

  await delay(900);
  const data = MOCK_MONDAY[client.id];
  if (!data) throw new Error(`No Monday board found for ${client.name}.`);
  return data;
}
