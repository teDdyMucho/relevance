import { NextResponse } from "next/server";
import { getClients } from "@/lib/clients";
import { matchClient } from "@/lib/match";
import { listUpcomingEvents } from "@/lib/sources/calendar";

export const dynamic = "force-dynamic";

/** GET /api/events -> upcoming calendar events, each with the matched client (if any). */
export async function GET() {
  try {
    const [{ mode, events }, clients] = await Promise.all([listUpcomingEvents(), getClients()]);
    const payload = events.map((event) => ({
      ...event,
      client: matchClient(event, clients),
    }));
    return NextResponse.json({ mode, events: payload, clientCount: clients.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
