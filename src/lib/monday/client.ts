import type { Client, MondayData, MondayItem } from "@/lib/types";
import { mondayGql } from "./api";

/**
 * Work for one client lives on two PMO boards, both linked to the Accounts board:
 *   Retainer      (monthly deliverables, e.g. "5280 Motorcars | SEO Retainer | October 2025")
 *   Non Retainer  (one-off projects)
 * Each parent item has subitems = the actual tasks (Owner, Status, Due Date, Completion Date).
 */
const RETAINER_BOARD_ID = process.env.MONDAY_RETAINER_BOARD_ID ?? "9392623318";
const NON_RETAINER_BOARD_ID = process.env.MONDAY_NON_RETAINER_BOARD_ID ?? "9359449385";

// "Accounts" connect-boards column on each board.
const RETAINER_ACCOUNT_COL = process.env.MONDAY_RETAINER_ACCOUNT_COL ?? "board_relation_mks0jpew";
const NON_RETAINER_ACCOUNT_COL = process.env.MONDAY_NON_RETAINER_ACCOUNT_COL ?? "connect_boards";

/** Parent groups worth showing. Everything else (Paused, Inactive, Completed, Templates) is skipped. */
const ACTIVE_GROUPS = /^(new|active)/i;
/** Tasks finished longer ago than this are hidden, so the panel focuses on current work. */
const DONE_WINDOW_DAYS = Number(process.env.MONDAY_DONE_WINDOW_DAYS ?? 30);
const MAX_ITEMS = Number(process.env.MONDAY_MAX_ITEMS ?? 60);

// ---------------------------------------------------------------------------
// Boards list (setup helper for /api/monday/boards)
// ---------------------------------------------------------------------------
export interface MondayBoardSummary {
  id: string;
  name: string;
  url?: string;
  workspace?: string;
  itemsCount?: number;
  columns: { id: string; title: string; type: string }[];
}

export async function listBoards(): Promise<MondayBoardSummary[]> {
  const data = await mondayGql<{
    boards: {
      id: string;
      name: string;
      url?: string;
      items_count?: number;
      workspace?: { name?: string } | null;
      columns: { id: string; title: string; type: string }[];
    }[];
  }>(`query {
    boards(limit: 100, order_by: used_at) {
      id name url items_count
      workspace { name }
      columns { id title type }
    }
  }`);
  return data.boards.map((b) => ({
    id: b.id,
    name: b.name,
    url: b.url,
    workspace: b.workspace?.name ?? undefined,
    itemsCount: b.items_count,
    columns: b.columns,
  }));
}

// ---------------------------------------------------------------------------
// Client work items
// ---------------------------------------------------------------------------
interface RawCol {
  id: string;
  text?: string | null;
  type: string;
  column?: { title?: string };
}
interface RawSub {
  id: string;
  name: string;
  updated_at?: string;
  column_values: RawCol[];
  updates?: { text_body?: string; created_at?: string }[];
}
interface RawParent {
  id: string;
  name: string;
  updated_at?: string;
  group?: { title?: string };
  column_values: RawCol[];
  subitems?: RawSub[];
}
interface RawBoard {
  id: string;
  name: string;
  url?: string;
  items_page: { items: RawParent[] };
}

/**
 * Note: compare_value must be a numeric item id. A string id silently matches nothing,
 * so the id is interpolated as a number after validation.
 */
function boardQuery(alias: string, boardId: string, accountCol: string, accountId: number) {
  return `${alias}: boards(ids: [${boardId}]) {
    id name url
    items_page(limit: 50, query_params: {
      rules: [{ column_id: "${accountCol}", compare_value: [${accountId}], operator: any_of }],
      order_by: [{ column_id: "__creation_log__", direction: desc }]
    }) {
      items {
        id name updated_at
        group { title }
        column_values(types: [status, people, date]) { id text type column { title } }
        subitems {
          id name updated_at
          column_values(types: [status, people, date]) { id text type column { title } }
          updates(limit: 1) { text_body created_at }
        }
      }
    }
  }`;
}

function buildQuery(accountId: number) {
  return `query {
  ${boardQuery("retainer", RETAINER_BOARD_ID, RETAINER_ACCOUNT_COL, accountId)}
  ${boardQuery("nonRetainer", NON_RETAINER_BOARD_ID, NON_RETAINER_ACCOUNT_COL, accountId)}
}`;
}

function colText(cols: RawCol[], type: string, titleRe?: RegExp): string {
  const ofType = cols.filter((c) => c.type === type);
  const hit = (titleRe && ofType.find((c) => titleRe.test(c.column?.title ?? ""))) || ofType[0];
  return hit?.text?.trim() ?? "";
}

const DONE_RE = /done|complete|closed|live|published|approved/i;

function toTask(sub: RawSub, parent: RawParent): MondayItem {
  const status = colText(sub.column_values, "status", /^status$/i) || "No status";
  const due = colText(sub.column_values, "date", /due/i);
  const completed = colText(sub.column_values, "date", /complet/i);
  const closed = DONE_RE.test(status) || Boolean(completed);
  const dueDate = due ? new Date(due).toISOString() : undefined;
  const overdue = Boolean(dueDate) && !closed && new Date(dueDate!) < new Date();
  const update = sub.updates?.[0]?.text_body?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return {
    id: sub.id,
    name: sub.name,
    group: parent.name,
    status,
    owner: colText(sub.column_values, "people", /owner|person|assign/i) || "Unassigned",
    dueDate,
    lastUpdated: completed ? new Date(completed).toISOString() : sub.updated_at ?? new Date().toISOString(),
    overdue,
    latestUpdate: update ? update.slice(0, 300) : undefined,
  };
}

function toProject(parent: RawParent, board: string): MondayItem {
  const status = colText(parent.column_values, "status", /^status$/i) || "No status";
  const nextMeeting = colText(parent.column_values, "date", /meeting|contact/i);
  return {
    id: parent.id,
    name: parent.name,
    group: `${board} (${parent.group?.title ?? ""})`,
    status,
    owner: colText(parent.column_values, "people", /am|owner/i) || "Unassigned",
    dueDate: nextMeeting ? new Date(nextMeeting).toISOString() : undefined,
    lastUpdated: parent.updated_at ?? new Date().toISOString(),
    overdue: false,
  };
}

export async function fetchMondayForClient(client: Client): Promise<MondayData> {
  const accountId = Number(client.mondayAccountId);
  if (!client.mondayAccountId || !Number.isInteger(accountId) || accountId <= 0) {
    throw new Error(`${client.name} has no Monday account id. Clients must come from the Accounts board.`);
  }

  const data = await mondayGql<{ retainer: RawBoard[]; nonRetainer: RawBoard[] }>(buildQuery(accountId));
  const boards = [...(data.retainer ?? []), ...(data.nonRetainer ?? [])];

  const cutoff = Date.now() - DONE_WINDOW_DAYS * 86_400_000;
  const tasks: MondayItem[] = [];
  const projects: MondayItem[] = [];

  for (const b of boards) {
    for (const parent of b.items_page.items) {
      if (!ACTIVE_GROUPS.test(parent.group?.title ?? "")) continue;
      const parentStatus = colText(parent.column_values, "status", /^status$/i);
      const parentClosed = /inactive|cancel|complete|done/i.test(parentStatus);
      const parentTouched = new Date(parent.updated_at ?? 0).getTime();
      // Skip finished or inactive work that has not been touched recently.
      if (parentClosed && parentTouched < cutoff) continue;

      projects.push(toProject(parent, b.name));
      for (const sub of parent.subitems ?? []) {
        const t = toTask(sub, parent);
        const closed = DONE_RE.test(t.status);
        if (closed && new Date(t.lastUpdated).getTime() < cutoff) continue;
        tasks.push(t);
      }
    }
  }

  // Overdue first, then open work, then recently completed. Newest activity first within each.
  const rank = (t: MondayItem) => (t.overdue ? 0 : DONE_RE.test(t.status) ? 2 : 1);
  tasks.sort((a, b) => rank(a) - rank(b) || b.lastUpdated.localeCompare(a.lastUpdated));

  return {
    boardName: `${projects.length} active project(s) on Retainer / Non Retainer`,
    boardUrl: boards[0]?.url,
    items: tasks.slice(0, MAX_ITEMS),
    projects,
  };
}
