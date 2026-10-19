import { NextResponse } from "next/server";
import { getClientById, getClients } from "@/lib/clients";
import { matchClient } from "@/lib/match";
import { isDataSource, runSource } from "@/lib/sources";
import { getEvent } from "@/lib/sources/calendar";
import type { CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/sources/:source  body: { eventId } | { clientId }
 * Collects one source. Normally called with an eventId (the client is matched
 * from the event). clientId is a testing shortcut that skips the calendar.
 */
export async function POST(req: Request, { params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  if (!isDataSource(source)) {
    return NextResponse.json({ error: `Unknown source "${source}".` }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { eventId?: string; clientId?: string };

  let event: CalendarEvent | null = null;
  let client = null;

  if (body.eventId) {
    event = await getEvent(body.eventId);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    client = matchClient(event, await getClients());
  } else if (body.clientId) {
    client = await getClientById(body.clientId);
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    event = stubEvent(client.name);
  } else {
    return NextResponse.json({ error: "eventId or clientId is required." }, { status: 400 });
  }

  const result = await runSource(source, { event, client });
  return NextResponse.json(result);
}

function stubEvent(clientName: string): CalendarEvent {
  const now = new Date();
  return {
    id: "manual",
    title: `Manual check: ${clientName}`,
    start: now.toISOString(),
    end: new Date(now.getTime() + 3_600_000).toISOString(),
    attendees: [],
  };
}
