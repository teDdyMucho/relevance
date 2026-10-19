// Shared types for the Relevance meeting-prep assistant.
// Every data source returns one of these shapes, whether it is mock or live.

export type SourceKey = "calendar" | "monday" | "gmail" | "semrush" | "brightlocal";
export type SourceMode = "mock" | "live";

export const SOURCE_KEYS: SourceKey[] = ["monday", "gmail", "semrush", "brightlocal"];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  calendar: "Google Calendar",
  monday: "Monday.com",
  gmail: "Gmail",
  semrush: "Semrush",
  brightlocal: "BrightLocal",
};

export interface Attendee {
  email: string;
  name?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO
  end: string; // ISO
  attendees: Attendee[];
  location?: string;
  meetLink?: string;
}

/** A client record. The calendar event is matched to one of these. */
export interface Client {
  id: string;
  name: string;
  domain: string; // used for Gmail + Semrush matching
  website: string;
  aliases?: string[]; // other names or domains that may identify the client
  contactEmails?: string[]; // known client contact emails (from Monday Contacts)
  accountManager?: string;
  status?: string; // e.g. Active, Onboarding
  mondayAccountId?: string; // item id on the Monday Accounts board
  mondayBoardId?: string;
  semrushProjectId?: string;
  brightlocalLocationId?: string;
}

export interface MondayItem {
  id: string;
  name: string;
  group: string;
  status: string;
  owner: string;
  dueDate?: string;
  lastUpdated: string;
  overdue: boolean;
  latestUpdate?: string;
}

export interface MondayData {
  boardName: string;
  boardUrl?: string;
  items: MondayItem[]; // tasks
  projects?: MondayItem[]; // parent items (retainer months / projects), live mode only
}

export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  needsReply: boolean;
}

export interface GmailData {
  query: string;
  threads: GmailThread[];
}

export interface SemrushKeyword {
  keyword: string;
  position: number;
  prevPosition: number;
  volume: number;
  url?: string;
}

export interface SemrushData {
  domain: string;
  organicKeywords: number;
  organicTraffic: number;
  trafficChangePct: number;
  backlinks: number;
  referringDomains: number;
  topKeywords: SemrushKeyword[];
}

export interface LocalRank {
  keyword: string;
  position: number | null; // null = not ranking
  prevPosition: number | null;
  engine?: string; // e.g. google-places
}

export interface Review {
  rating: number;
  author: string;
  text: string;
  date: string;
  source: string;
}

export interface BrightLocalData {
  locationName: string;
  locationId?: number;
  area?: string; // e.g. "Gilbert, AZ"
  localRanks: LocalRank[];
  ranksUpdatedAt?: string;
  ranksNote?: string; // why rankings may be missing
  trackedKeywords?: string[]; // campaign search terms, even when no results are available
  reviews: {
    total: number;
    avgRating: number;
    newLast30Days: number;
    recent: Review[];
    note?: string; // why recent reviews may be empty
  };
  citations: {
    total: number;
    live: number;
    pending: number;
    errors: number;
    lastRun?: string;
  };
  gbp: {
    auditScore?: number; // mock only
    claimed?: boolean;
    photos?: number;
    categories?: string[];
    profileUrl?: string;
    keywordRanks?: { keyword: string; rank: string | null; leader?: string }[]; // GBP report top-10 letter ranks
    issues: string[];
  };
}

export interface SourceResult<T = unknown> {
  source: SourceKey;
  mode: SourceMode;
  ok: boolean;
  data?: T;
  error?: string;
  fetchedAt: string;
}

export interface BriefSection {
  title: string;
  bullets: string[];
}

export interface Brief {
  eventId: string;
  eventTitle: string;
  clientName: string;
  generatedAt: string;
  mode: SourceMode;
  headline: string;
  keyPoints: string[]; // the short bullet summary
  sections: BriefSection[]; // the longer report
  suggestedAgenda: string[];
}

export interface SourceContext {
  event: CalendarEvent;
  client: Client | null;
}
