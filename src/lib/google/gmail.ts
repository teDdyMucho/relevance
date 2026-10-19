import type { GmailData, GmailThread } from "@/lib/types";
import { getMyEmail, googleGet } from "./oauth";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface ThreadListResponse {
  threads?: { id: string; snippet?: string }[];
}

interface MessageMeta {
  id: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string; // ms since epoch as string
  payload?: { headers?: { name: string; value: string }[] };
}

interface ThreadResponse {
  id: string;
  messages?: MessageMeta[];
}

function header(m: MessageMeta, name: string): string {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function emailOf(fromHeader: string): string {
  const m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

/**
 * Threads that involve the client's domain in the last N days (default 30).
 * "needsReply" = the last message in the thread came from the client, not from us.
 */
export async function searchGmailThreads(
  domain: string,
  daysBack = 30,
  contactEmails: string[] = [],
): Promise<GmailData> {
  // Search by the client's domain when we know it, otherwise by their exact contact addresses.
  const terms = domain
    ? [domain]
    : contactEmails.map((e) => e.trim()).filter((e) => e.includes("@"));
  if (!terms.length) {
    throw new Error("No email domain or contact email is known for this client. Add a contact with an email on the Monday Accounts board.");
  }
  const scope = terms.map((t) => `from:${t} OR to:${t}`).join(" OR ");
  const query = `(${scope}) newer_than:${daysBack}d`;
  const max = Number(process.env.GMAIL_MAX_THREADS ?? 15);

  const list = await googleGet<ThreadListResponse>(
    `${BASE}/threads?q=${encodeURIComponent(query)}&maxResults=${max}`,
  );
  const ids = (list.threads ?? []).map((t) => t.id);
  if (!ids.length) return { query, threads: [] };

  const me = (await getMyEmail())?.toLowerCase();

  const threads = await Promise.all(
    ids.map(async (id): Promise<GmailThread | null> => {
      const t = await googleGet<ThreadResponse>(
        `${BASE}/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      );
      const msgs = t.messages ?? [];
      if (!msgs.length) return null;
      const first = msgs[0];
      const last = msgs[msgs.length - 1];
      const lastFrom = emailOf(header(last, "From"));
      const fromClient = domain
        ? lastFrom.endsWith(`@${domain.toLowerCase()}`)
        : contactEmails.some((e) => e.toLowerCase() === lastFrom);
      const fromMe = me ? lastFrom === me : false;

      return {
        id: t.id,
        subject: header(first, "Subject") || "(no subject)",
        from: header(last, "From"),
        date: new Date(Number(last.internalDate ?? Date.now())).toISOString(),
        snippet: last.snippet ?? "",
        unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
        needsReply: fromClient && !fromMe,
      };
    }),
  );

  const clean = threads.filter((t): t is GmailThread => t !== null);
  clean.sort((a, b) => b.date.localeCompare(a.date));
  return { query, threads: clean };
}
