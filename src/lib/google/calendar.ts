import type { CalendarEvent } from "@/lib/types";
import { googleGet } from "./oauth";

interface GEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; self?: boolean; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
}

interface GEventsResponse {
  items?: GEvent[];
}

/**
 * Upcoming events from one calendar (GOOGLE_CALENDAR_ID, default "primary").
 * Looks ahead CALENDAR_DAYS_AHEAD days (default 14).
 */
export async function listGoogleEvents(): Promise<CalendarEvent[]> {
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");
  const daysAhead = Number(process.env.CALENDAR_DAYS_AHEAD ?? 14);
  const now = new Date();
  const max = new Date(now.getTime() + daysAhead * 86_400_000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: "true", // expand recurring events into instances
    orderBy: "startTime",
    maxResults: "30",
  });

  const json = await googleGet<GEventsResponse>(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
  );

  return (json.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id,
      title: e.summary ?? "(no title)",
      description: e.description,
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      attendees: (e.attendees ?? [])
        .filter((a) => a.responseStatus !== "declined")
        .map((a) => ({ email: a.email, name: a.displayName })),
      location: e.location,
      meetLink: e.hangoutLink,
    }));
}
