import { fetchBrightLocalForClient } from "@/lib/brightlocal/client";
import { sourceMode } from "@/lib/config";
import { MOCK_BRIGHTLOCAL } from "@/lib/mock/data";
import type { BrightLocalData, SourceContext } from "@/lib/types";
import { delay, requireClient } from "./shared";

/**
 * BrightLocal source.
 * mock: returns demo local SEO data for the matched client.
 * live: legacy API with BRIGHTLOCAL_API_KEY (see lib/brightlocal/client.ts).
 */
export async function fetchBrightLocal(ctx: SourceContext): Promise<BrightLocalData> {
  const client = requireClient(ctx);
  if (sourceMode("brightlocal") === "live") return fetchBrightLocalForClient(client);

  await delay(1800);
  const data = MOCK_BRIGHTLOCAL[client.id];
  if (!data) throw new Error(`No BrightLocal location for ${client.name}.`);
  return data;
}
