import { NextResponse } from "next/server";
import { getClientById, getClients } from "@/lib/clients";
import { matchClient } from "@/lib/match";
import { getEvent } from "@/lib/sources/calendar";
import { summarize } from "@/lib/summarize";
import type { CalendarEvent, SourceResult } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/brief  body: { eventId | clientId, results: SourceResult[] }
 * Builds the meeting brief from the already-collected source results.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    eventId?: string;
    clientId?: string;
    results?: SourceResult[];
  };
  if ((!body.eventId && !body.clientId) || !Array.isArray(body.results)) {
    return NextResponse.json({ error: "eventId (or clientId) and results are required." }, { status: 400 });
  }

  try {
    let event: CalendarEvent | null = null;
    let client = null;
    if (body.eventId) {
      event = await getEvent(body.eventId);
      if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
      client = matchClient(event, await getClients());
    } else {
      client = await getClientById(body.clientId!);
      if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
      const now = new Date();
      event = { id: "manual", title: `Manual check: ${client.name}`, start: now.toISOString(), end: now.toISOString(), attendees: [] };
    }
    const brief = await summarize({ event, client, results: body.results });
    return NextResponse.json(brief);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
