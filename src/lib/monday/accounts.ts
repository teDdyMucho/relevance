import type { Client } from "@/lib/types";
import { mondayGql } from "./api";

/**
 * The CRM "Accounts" board is the client registry.
 * One account item = one Client. Domain comes from the linked Contacts' emails.
 */
const ACCOUNTS_BOARD_ID = process.env.MONDAY_ACCOUNTS_BOARD_ID ?? "9341985318";

// Column ids on the Accounts board (see /api/monday/boards for the full list).
const COL = {
  status: "color_mkrv2z97", // Active / Opportunity / Onboarding / N/A
  am: "lookup_mkrvsyq8", // Account manager (mirror)
  contacts: "account_contact", // board_relation -> Contacts board
  contactEmails: "mirror6", // mirror of contact emails
};

/** Statuses that count as a real client for meeting prep. */
const INCLUDE_STATUSES = (process.env.MONDAY_ACCOUNT_STATUSES ?? "Active,Onboarding")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const COMPANY_DOMAIN = (process.env.COMPANY_EMAIL_DOMAIN ?? "clearlyrelevant.com").toLowerCase();
const COMPANY_NAME = (process.env.COMPANY_NAME ?? "Clearly Relevant").toLowerCase();

const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "live.com", "msn.com",
  COMPANY_DOMAIN,
]);

interface RawAccount {
  id: string;
  name: string;
  column_values: {
    id: string;
    text?: string | null;
    display_value?: string | null;
    linked_items?: { id: string; name: string; column_values: { text?: string | null }[] }[];
  }[];
}

const QUERY = `query ($board: [ID!], $cursor: String) {
  boards(ids: $board) {
    items_page(limit: 100, cursor: $cursor) {
      cursor
      items {
        id name
        column_values(ids: ["${COL.status}", "${COL.am}", "${COL.contacts}", "${COL.contactEmails}"]) {
          id text
          ... on MirrorValue { display_value }
          ... on BoardRelationValue { linked_items { id name column_values(types: [email]) { text } } }
        }
      }
    }
  }
}`;

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const d = email.slice(at + 1).trim().toLowerCase();
  return d && !GENERIC_DOMAINS.has(d) ? d : null;
}

function toClient(raw: RawAccount): Client | null {
  const col = (id: string) => raw.column_values.find((c) => c.id === id);
  const status = (col(COL.status)?.text ?? "").trim();
  if (INCLUDE_STATUSES.length && !INCLUDE_STATUSES.includes(status.toLowerCase())) return null;
  // The agency's own account must never match internal meetings.
  if (raw.name.trim().toLowerCase() === COMPANY_NAME) return null;

  const emails = new Set<string>();
  for (const li of col(COL.contacts)?.linked_items ?? []) {
    for (const cv of li.column_values) if (cv.text) emails.add(cv.text.trim().toLowerCase());
  }
  for (const e of (col(COL.contactEmails)?.display_value ?? "").split(/[,\s]+/)) {
    if (e.includes("@")) emails.add(e.trim().toLowerCase());
  }
  // Internal addresses are not client contacts.
  for (const e of [...emails]) if (e.endsWith(`@${COMPANY_DOMAIN}`)) emails.delete(e);
  const domains = [...new Set([...emails].map(domainOf).filter((d): d is string => Boolean(d)))];

  const amRaw = col(COL.am)?.display_value ?? "";
  const am = [...new Set(amRaw.split(/[,\s]+/).filter((s) => s.includes("@")))][0];

  return {
    id: raw.id,
    name: raw.name.trim(),
    domain: domains[0] ?? "",
    website: domains[0] ? `https://${domains[0]}` : "",
    aliases: domains.slice(1),
    mondayAccountId: raw.id,
    contactEmails: [...emails],
    accountManager: am,
    status,
  };
}

let cache: { at: number; clients: Client[] } | null = null;
const TTL_MS = 10 * 60_000;

/** All accounts from the Monday Accounts board, cached for 10 minutes. */
export async function getMondayClients(force = false): Promise<Client[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.clients;

  const clients: Client[] = [];
  let cursor: string | null | undefined;
  let guard = 0;
  do {
    const data = await mondayGql<{ boards: { items_page: { cursor?: string | null; items: RawAccount[] } }[] }>(
      QUERY,
      { board: [ACCOUNTS_BOARD_ID], cursor },
    );
    const page = data.boards[0]?.items_page;
    if (!page) break;
    for (const raw of page.items) {
      const c = toClient(raw);
      if (c) clients.push(c);
    }
    cursor = page.cursor;
  } while (cursor && guard++ < 10);

  // Merge duplicate account names (the board has a few), keeping every email and domain.
  const byName = new Map<string, Client>();
  for (const c of clients) {
    const key = c.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, c);
      continue;
    }
    prev.contactEmails = [...new Set([...(prev.contactEmails ?? []), ...(c.contactEmails ?? [])])];
    const domains = [...new Set([prev.domain, ...(prev.aliases ?? []), c.domain, ...(c.aliases ?? [])].filter(Boolean))];
    prev.domain = domains[0] ?? "";
    prev.website = prev.domain ? `https://${prev.domain}` : "";
    prev.aliases = domains.slice(1);
    prev.accountManager = prev.accountManager ?? c.accountManager;
  }
  const merged = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), clients: merged };
  return merged;
}
