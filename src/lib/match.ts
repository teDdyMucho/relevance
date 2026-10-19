import type { CalendarEvent, Client } from "@/lib/types";

/**
 * Figure out which client a calendar event is about.
 * Order of checks:
 *   1. An attendee's email is one of the client's known contact emails.
 *   2. An attendee's email domain matches the client's domain (or alias domains).
 *   3. Client name appears in the event title or description (longest names first,
 *      so "Indigo Interiors" beats "Indigo"). Names shorter than 4 chars are ignored.
 * Returns null when nothing matches (e.g. an internal meeting).
 */
export function matchClient(event: CalendarEvent, clients: Client[]): Client | null {
  const attendeeEmails = event.attendees.map((a) => a.email.toLowerCase());
  const attendeeDomains = attendeeEmails.map((e) => e.slice(e.lastIndexOf("@") + 1));

  for (const client of clients) {
    const known = (client.contactEmails ?? []).map((e) => e.toLowerCase());
    if (known.some((e) => attendeeEmails.includes(e))) return client;
  }

  for (const client of clients) {
    const domains = [client.domain, ...(client.aliases ?? [])].map((d) => d.toLowerCase()).filter(Boolean);
    if (domains.some((d) => attendeeDomains.includes(d))) return client;
  }

  const haystack = normalize(`${event.title} ${event.description ?? ""}`);
  const byLength = [...clients].sort((a, b) => b.name.length - a.name.length);
  for (const client of byLength) {
    const name = normalize(client.name);
    if (name.length >= 4 && haystack.includes(name)) return client;
  }

  return null;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
