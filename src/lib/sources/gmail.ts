import { sourceMode } from "@/lib/config";
import { searchGmailThreads } from "@/lib/google/gmail";
import { MOCK_GMAIL } from "@/lib/mock/data";
import type { GmailData, SourceContext } from "@/lib/types";
import { delay, requireClient } from "./shared";

/**
 * Gmail source.
 * mock: returns demo threads for the matched client.
 * live: Gmail API via the shared Google sign-in. Searches
 *       (from:<domain> OR to:<domain>) newer_than:30d and reads thread metadata.
 */
export async function fetchGmail(ctx: SourceContext): Promise<GmailData> {
  const client = requireClient(ctx);
  if (sourceMode("gmail") === "live") {
    return searchGmailThreads(client.domain, Number(process.env.GMAIL_DAYS_BACK ?? 30), client.contactEmails ?? []);
  }

  await delay(1200);
  const data = MOCK_GMAIL[client.id];
  if (!data) throw new Error(`No emails found for ${client.domain} in the last 30 days.`);
  return data;
}
