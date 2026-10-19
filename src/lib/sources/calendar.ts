import { sourceMode } from "@/lib/config";
import { listGoogleEvents } from "@/lib/google/calendar";
import { MOCK_EVENTS } from "@/lib/mock/data";
import type { CalendarEvent, SourceMode } from "@/lib/types";

/**
 * Google Calendar source.
 * mock: returns the demo events.
 * live: Google Calendar API v3 via the shared Google OAuth sign-in (see lib/google).
 */
export async function listUpcomingEvents(): Promise<{ mode: SourceMode; events: CalendarEvent[] }> {
  const mode = sourceMode("calendar");
  if (mode === "live") return { mode, events: await listGoogleEvents() };
  await delay(200);
  return { mode, events: MOCK_EVENTS };
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const { events } = await listUpcomingEvents();
  return events.find((e) => e.id === id) ?? null;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
