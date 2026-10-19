import { NextResponse } from "next/server";
import { getClients } from "@/lib/clients";
import { sourceMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/clients -> the client list the app matches events against. */
export async function GET() {
  try {
    const clients = await getClients();
    return NextResponse.json({ mode: sourceMode("monday"), count: clients.length, clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
