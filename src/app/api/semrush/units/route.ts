import { NextResponse } from "next/server";
import { getUnitsBalance } from "@/lib/semrush/client";

export const dynamic = "force-dynamic";

/** GET /api/semrush/units -> remaining Semrush API units. */
export async function GET() {
  try {
    const units = await getUnitsBalance();
    return NextResponse.json({ units, approxBriefs: Math.floor(units / 160) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
