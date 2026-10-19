import { NextResponse } from "next/server";
import { listBoards } from "@/lib/monday/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/monday/boards
 * Setup helper: lists the boards the token can see, with their column titles,
 * so you can pick MONDAY_BOARD_IDS and MONDAY_CLIENT_COLUMN.
 */
export async function GET() {
  try {
    const boards = await listBoards();
    return NextResponse.json({ count: boards.length, boards });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
