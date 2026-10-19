import { NextResponse } from "next/server";
import { getLocationIndex } from "@/lib/brightlocal/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/brightlocal/locations
 * Setup helper: every BrightLocal location the key can see, with the names and
 * domains used for matching and which reports exist for it.
 */
export async function GET() {
  try {
    const locations = await getLocationIndex(true);
    return NextResponse.json({ count: locations.length, locations });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
