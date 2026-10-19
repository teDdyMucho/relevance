import type {
  BrightLocalData,
  CalendarEvent,
  Client,
  GmailData,
  MondayData,
  SemrushData,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Clients. Later this moves to a database or a Monday "Clients" board.
// ---------------------------------------------------------------------------
export const MOCK_CLIENTS: Client[] = [
  {
    id: "lionrock",
    name: "Lion Rock Properties",
    aliases: ["LionRock", "Lion Rock"],
    domain: "lionrock.ai",
    website: "https://lionrock.ai",
    mondayBoardId: "1001",
    semrushProjectId: "sr-1001",
    brightlocalLocationId: "bl-1001",
  },
  {
    id: "summitdental",
    name: "Summit Dental",
    aliases: ["Summit"],
    domain: "summitdentalmn.com",
    website: "https://summitdentalmn.com",
    mondayBoardId: "1002",
    semrushProjectId: "sr-1002",
    brightlocalLocationId: "bl-1002",
  },
  {
    id: "prettylady",
    name: "Pretty Lady Salon",
    aliases: ["Pretty Lady"],
    domain: "prettyladysalon.com",
    website: "https://prettyladysalon.com",
    mondayBoardId: "1003",
    semrushProjectId: "sr-1003",
    brightlocalLocationId: "bl-1003",
  },
];

// ---------------------------------------------------------------------------
// Calendar events, relative to "now" so the demo always looks upcoming.
// ---------------------------------------------------------------------------
function at(daysFromNow: number, hour: number, durationMin = 60) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const end = new Date(d.getTime() + durationMin * 60_000);
  return { start: d.toISOString(), end: end.toISOString() };
}

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Monthly SEO Review - Lion Rock Properties",
    description:
      "Review October rankings, GBP performance, and the tenant welcome page launch.",
    ...at(0, 14),
    attendees: [
      { email: "owner@lionrock.ai", name: "Mark Reyes" },
      { email: "lrpai@lrprop.com", name: "AKT" },
    ],
    meetLink: "https://meet.google.com/abc-defg-hij",
  },
  {
    id: "evt-2",
    title: "Local SEO Check-in: Summit Dental",
    description: "Citations cleanup status and new review strategy.",
    ...at(1, 10, 30),
    attendees: [
      { email: "drlee@summitdentalmn.com", name: "Dr. Lee" },
      { email: "lrpai@lrprop.com", name: "AKT" },
    ],
    meetLink: "https://meet.google.com/klm-nopq-rst",
  },
  {
    id: "evt-3",
    title: "Pretty Lady - Q4 Content Plan",
    description: "Agree on blog topics and promo calendar for the holidays.",
    ...at(2, 15, 45),
    attendees: [
      { email: "maria@prettyladysalon.com", name: "Maria Santos" },
      { email: "lrpai@lrprop.com", name: "AKT" },
    ],
  },
  {
    id: "evt-4",
    title: "Internal: Sprint planning",
    description: "Team only.",
    ...at(3, 9, 30),
    attendees: [{ email: "lrpai@lrprop.com", name: "AKT" }],
  },
];

// ---------------------------------------------------------------------------
// Per-client mock data for each source.
// ---------------------------------------------------------------------------
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysAhead(n: number) {
  return daysAgo(-n);
}

export const MOCK_MONDAY: Record<string, MondayData> = {
  lionrock: {
    boardName: "Lion Rock Properties - SEO & Web",
    boardUrl: "https://monday.com/boards/1001",
    items: [
      {
        id: "m1",
        name: "Tenant welcome page + PDF",
        group: "Web",
        status: "Done",
        owner: "Teddy",
        dueDate: daysAgo(5),
        lastUpdated: daysAgo(4),
        overdue: false,
        latestUpdate: "Shipped /welcometolionrock and the welcome PDF with QR code.",
      },
      {
        id: "m2",
        name: "GBP posts - October batch",
        group: "Local SEO",
        status: "Working on it",
        owner: "Ana",
        dueDate: daysAhead(2),
        lastUpdated: daysAgo(1),
        overdue: false,
        latestUpdate: "3 of 4 posts scheduled. Waiting on photos for the last one.",
      },
      {
        id: "m3",
        name: "Fix Property Review oversized payload",
        group: "Web",
        status: "Stuck",
        owner: "Teddy",
        dueDate: daysAgo(3),
        lastUpdated: daysAgo(6),
        overdue: true,
        latestUpdate: "Needs server-side image resize before sending to the API.",
      },
      {
        id: "m4",
        name: "Blog: Moving checklist for new tenants",
        group: "Content",
        status: "In review",
        owner: "Ana",
        dueDate: daysAhead(5),
        lastUpdated: daysAgo(2),
        overdue: false,
      },
    ],
  },
  summitdental: {
    boardName: "Summit Dental - Local SEO",
    boardUrl: "https://monday.com/boards/1002",
    items: [
      {
        id: "m5",
        name: "Citation cleanup (Yelp, BBB, Healthgrades)",
        group: "Citations",
        status: "Working on it",
        owner: "Ana",
        dueDate: daysAhead(1),
        lastUpdated: daysAgo(1),
        overdue: false,
        latestUpdate: "Yelp and BBB updated. Healthgrades still shows old phone number.",
      },
      {
        id: "m6",
        name: "Review request SMS flow",
        group: "Reviews",
        status: "Not started",
        owner: "Teddy",
        dueDate: daysAhead(10),
        lastUpdated: daysAgo(12),
        overdue: false,
      },
      {
        id: "m7",
        name: "Service pages: Invisalign + Implants",
        group: "Content",
        status: "Stuck",
        owner: "Ana",
        dueDate: daysAgo(7),
        lastUpdated: daysAgo(9),
        overdue: true,
        latestUpdate: "Waiting for client to approve the pricing section.",
      },
    ],
  },
  prettylady: {
    boardName: "Pretty Lady Salon - Marketing",
    boardUrl: "https://monday.com/boards/1003",
    items: [
      {
        id: "m8",
        name: "Holiday promo landing page",
        group: "Web",
        status: "Working on it",
        owner: "Teddy",
        dueDate: daysAhead(8),
        lastUpdated: daysAgo(1),
        overdue: false,
        latestUpdate: "Draft design sent for feedback.",
      },
      {
        id: "m9",
        name: "Q4 blog calendar",
        group: "Content",
        status: "Not started",
        owner: "Ana",
        dueDate: daysAhead(3),
        lastUpdated: daysAgo(15),
        overdue: false,
      },
    ],
  },
};

export const MOCK_GMAIL: Record<string, GmailData> = {
  lionrock: {
    query: "from:lionrock.ai OR to:lionrock.ai newer_than:30d",
    threads: [
      {
        id: "g1",
        subject: "Re: Welcome PDF - final version?",
        from: "Mark Reyes <owner@lionrock.ai>",
        date: daysAgo(2),
        snippet:
          "Looks great. Can we also add the office hours under the phone number before we print?",
        unread: true,
        needsReply: true,
      },
      {
        id: "g2",
        subject: "Google Business Profile - suspicious review",
        from: "Mark Reyes <owner@lionrock.ai>",
        date: daysAgo(9),
        snippet:
          "There is a 1-star review from someone who was never a tenant. Can we flag it?",
        unread: false,
        needsReply: false,
      },
      {
        id: "g3",
        subject: "October invoice",
        from: "billing@lrprop.com",
        date: daysAgo(14),
        snippet: "Invoice #2041 for October services attached.",
        unread: false,
        needsReply: false,
      },
    ],
  },
  summitdental: {
    query: "from:summitdentalmn.com OR to:summitdentalmn.com newer_than:30d",
    threads: [
      {
        id: "g4",
        subject: "Pricing section for Invisalign page",
        from: "Dr. Lee <drlee@summitdentalmn.com>",
        date: daysAgo(11),
        snippet:
          "Still checking with the office manager on whether we can publish prices. Will confirm this week.",
        unread: false,
        needsReply: false,
      },
      {
        id: "g5",
        subject: "New patients from Google?",
        from: "Dr. Lee <drlee@summitdentalmn.com>",
        date: daysAgo(3),
        snippet:
          "Front desk says more people mention Google this month. Do we have numbers on that?",
        unread: true,
        needsReply: true,
      },
    ],
  },
  prettylady: {
    query: "from:prettyladysalon.com OR to:prettyladysalon.com newer_than:30d",
    threads: [
      {
        id: "g6",
        subject: "Holiday promo ideas",
        from: "Maria Santos <maria@prettyladysalon.com>",
        date: daysAgo(4),
        snippet:
          "We want to push gift cards and a bundle package. Can the landing page go live by Nov 15?",
        unread: false,
        needsReply: true,
      },
    ],
  },
};

export const MOCK_SEMRUSH: Record<string, SemrushData> = {
  lionrock: {
    domain: "lionrock.ai",
    organicKeywords: 312,
    organicTraffic: 1840,
    trafficChangePct: 12.4,
    backlinks: 428,
    referringDomains: 61,
    topKeywords: [
      { keyword: "apartments for rent minneapolis", position: 8, prevPosition: 11, volume: 5400 },
      { keyword: "lion rock properties", position: 1, prevPosition: 1, volume: 720 },
      { keyword: "pet friendly apartments st paul", position: 14, prevPosition: 19, volume: 1300 },
      { keyword: "tenant portal minneapolis", position: 6, prevPosition: 9, volume: 390 },
      { keyword: "studio apartments uptown", position: 23, prevPosition: 17, volume: 880 },
    ],
  },
  summitdental: {
    domain: "summitdentalmn.com",
    organicKeywords: 148,
    organicTraffic: 960,
    trafficChangePct: -4.1,
    backlinks: 112,
    referringDomains: 34,
    topKeywords: [
      { keyword: "dentist eagan mn", position: 5, prevPosition: 7, volume: 1900 },
      { keyword: "invisalign eagan", position: 12, prevPosition: 10, volume: 480 },
      { keyword: "dental implants eagan", position: 18, prevPosition: 15, volume: 320 },
      { keyword: "emergency dentist eagan", position: 9, prevPosition: 9, volume: 590 },
    ],
  },
  prettylady: {
    domain: "prettyladysalon.com",
    organicKeywords: 86,
    organicTraffic: 540,
    trafficChangePct: 3.2,
    backlinks: 58,
    referringDomains: 19,
    topKeywords: [
      { keyword: "hair salon bloomington mn", position: 7, prevPosition: 8, volume: 1600 },
      { keyword: "balayage bloomington", position: 4, prevPosition: 6, volume: 260 },
      { keyword: "salon gift cards mn", position: 31, prevPosition: 40, volume: 140 },
    ],
  },
};

export const MOCK_BRIGHTLOCAL: Record<string, BrightLocalData> = {
  lionrock: {
    locationName: "Lion Rock Properties - Minneapolis",
    localRanks: [
      { keyword: "apartments for rent minneapolis", position: 4, prevPosition: 6 },
      { keyword: "property management minneapolis", position: 7, prevPosition: 7 },
      { keyword: "pet friendly apartments st paul", position: 11, prevPosition: 14 },
      { keyword: "luxury apartments minneapolis", position: null, prevPosition: 19 },
    ],
    reviews: {
      total: 184,
      avgRating: 4.5,
      newLast30Days: 7,
      recent: [
        { rating: 5, author: "J. Thompson", text: "Maintenance request handled same day. Great team.", date: daysAgo(2), source: "Google" },
        { rating: 1, author: "anon_user", text: "Terrible experience, never again.", date: daysAgo(8), source: "Google" },
        { rating: 4, author: "Priya K.", text: "Nice units, parking is a bit tight.", date: daysAgo(12), source: "Google" },
      ],
    },
    citations: { total: 62, live: 55, pending: 5, errors: 2 },
    gbp: {
      auditScore: 82,
      issues: ["Missing Q&A answers (3 unanswered)", "No posts in the last 14 days"],
    },
  },
  summitdental: {
    locationName: "Summit Dental - Eagan",
    localRanks: [
      { keyword: "dentist eagan mn", position: 3, prevPosition: 5 },
      { keyword: "invisalign eagan", position: 9, prevPosition: 8 },
      { keyword: "emergency dentist eagan", position: 6, prevPosition: 10 },
    ],
    reviews: {
      total: 97,
      avgRating: 4.8,
      newLast30Days: 3,
      recent: [
        { rating: 5, author: "Kevin O.", text: "Dr. Lee is fantastic, zero pain.", date: daysAgo(5), source: "Google" },
        { rating: 5, author: "Lisa M.", text: "Front desk was very helpful with insurance.", date: daysAgo(16), source: "Google" },
      ],
    },
    citations: { total: 48, live: 39, pending: 6, errors: 3 },
    gbp: {
      auditScore: 74,
      issues: ["Phone number mismatch on Healthgrades", "Business hours not set for holidays", "Only 4 photos uploaded"],
    },
  },
  prettylady: {
    locationName: "Pretty Lady Salon - Bloomington",
    localRanks: [
      { keyword: "hair salon bloomington mn", position: 5, prevPosition: 5 },
      { keyword: "balayage bloomington", position: 2, prevPosition: 3 },
      { keyword: "nail salon bloomington", position: 15, prevPosition: null },
    ],
    reviews: {
      total: 221,
      avgRating: 4.7,
      newLast30Days: 11,
      recent: [
        { rating: 5, author: "Dana R.", text: "Best balayage I have had. Booking again.", date: daysAgo(1), source: "Google" },
        { rating: 3, author: "Tasha W.", text: "Good cut but waited 25 minutes past my appointment.", date: daysAgo(7), source: "Yelp" },
      ],
    },
    citations: { total: 40, live: 38, pending: 2, errors: 0 },
    gbp: {
      auditScore: 90,
      issues: ["No booking link attached to profile"],
    },
  },
};
