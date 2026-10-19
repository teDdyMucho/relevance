import type { BrightLocalData, Client, LocalRank, Review } from "@/lib/types";

/**
 * BrightLocal legacy API (https://tools.brightlocal.com/seo-tools/api).
 * Auth: `api-key` query parameter (no secret). A trial key has a fixed request allowance,
 * so list calls are cached for 10 minutes and one brief costs about 4 requests.
 *
 * Where each piece of the panel comes from:
 *   Local rankings  -> /v2/lsrc  campaigns; results read from the campaign's public CSV report
 *   GBP summary     -> /v4/gpw   reports; summary (reviews, rating, claimed, photos) + keyword top-10
 *   Citations       -> /v2/ct    reports; active / pending / need-to-fix
 *   Review text     -> /v4/rf    reports; only for locations that have a review report
 * A client is matched to a BrightLocal location by business name or website domain.
 */
const BASE = "https://tools.brightlocal.com/seo-tools/api";
const TTL_MS = 10 * 60_000;

function apiKey(): string {
  const key = process.env.BRIGHTLOCAL_API_KEY;
  if (!key) throw new Error("BRIGHTLOCAL_API_KEY is not set in .env.local.");
  return key;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ "api-key": apiKey(), ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`BrightLocal returned a non-JSON response for ${path}: ${text.slice(0, 120)}`);
  }
  const j = json as { success?: boolean; errors?: unknown; message?: string };
  if (!res.ok || j.success === false) {
    const errs = j.errors
      ? typeof j.errors === "object"
        ? Object.values(j.errors as Record<string, string>).join("; ")
        : String(j.errors)
      : j.message ?? res.statusText;
    if (/no trial requests left/i.test(errs)) {
      throw new Error("BrightLocal trial API key has no requests left. Ask BrightLocal for more trial requests or a production key.");
    }
    if (/invalid api key/i.test(errs)) throw new Error("BrightLocal API key is invalid or lacks access to this method.");
    throw new Error(`BrightLocal error on ${path}: ${errs}`);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Location index (cached): everything BrightLocal knows per location_id
// ---------------------------------------------------------------------------
export interface BLLocation {
  locationId: number;
  names: string[];
  domains: string[];
  rankCampaignIds: number[];
  gbpReportIds: number[];
  citationReportIds: number[];
  reviewReportIds: number[];
}

interface LsrcCampaign { campaign_id: number; name: string; location_id: number }
interface GpwReport { report_id: number; report_name: string; location_id: number; status?: string }
interface CtReport {
  report_id: number;
  report_name: string;
  location_id: number;
  website_address?: string | null;
  business_name?: string | null;
  your_ct_count?: number;
  total_ct_sources?: number;
  last_run?: string;
}
interface RfReport { report_id: number; report_name: string; location_id: number; complete?: boolean }

let indexCache: { at: number; locations: BLLocation[]; ctReports: CtReport[] } | null = null;

function domainOf(url?: string | null): string | null {
  if (!url) return null;
  const m = url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return m && m.includes(".") ? m : null;
}

/** "Colair Beauty Lounge & Med Spa, COLAIRBEAUTY-85296" -> "Colair Beauty Lounge & Med Spa" */
function cleanName(name: string): string {
  return name.replace(/[,(]\s*[A-Z0-9]+-\d+\)?\s*$/i, "").trim();
}

export async function getLocationIndex(force = false): Promise<BLLocation[]> {
  if (!force && indexCache && Date.now() - indexCache.at < TTL_MS) return indexCache.locations;

  const [lsrc, gpw, ct, rf] = await Promise.all([
    get<{ response: { results: LsrcCampaign[] } }>("/v2/lsrc/get-all"),
    get<{ results: GpwReport[] }>("/v4/gpw"),
    get<{ response: { results: CtReport[] } }>("/v2/ct/get-all"),
    get<{ reports: RfReport[] }>("/v4/rf"),
  ]);

  const map = new Map<number, BLLocation>();
  const loc = (id: number) => {
    let l = map.get(id);
    if (!l) {
      l = { locationId: id, names: [], domains: [], rankCampaignIds: [], gbpReportIds: [], citationReportIds: [], reviewReportIds: [] };
      map.set(id, l);
    }
    return l;
  };
  const addName = (l: BLLocation, n?: string | null) => {
    const c = cleanName(n ?? "");
    if (c && !l.names.includes(c)) l.names.push(c);
  };

  for (const c of lsrc.response?.results ?? []) {
    if (!c.location_id) continue;
    const l = loc(c.location_id);
    addName(l, c.name);
    l.rankCampaignIds.push(c.campaign_id);
  }
  for (const r of gpw.results ?? []) {
    if (!r.location_id) continue;
    const l = loc(r.location_id);
    addName(l, r.report_name);
    l.gbpReportIds.push(r.report_id);
  }
  const ctReports = ct.response?.results ?? [];
  for (const r of ctReports) {
    if (!r.location_id) continue;
    const l = loc(r.location_id);
    addName(l, r.report_name);
    addName(l, r.business_name);
    const d = domainOf(r.website_address);
    if (d && !l.domains.includes(d)) l.domains.push(d);
    l.citationReportIds.push(r.report_id);
  }
  for (const r of rf.reports ?? []) {
    if (!r.location_id) continue;
    const l = loc(r.location_id);
    addName(l, r.report_name);
    l.reviewReportIds.push(r.report_id);
  }

  const locations = [...map.values()];
  indexCache = { at: Date.now(), locations, ctReports };
  return locations;
}

function norm(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Find the BrightLocal location for a client: explicit id, then domain, then business name. */
export async function matchLocation(client: Client): Promise<BLLocation | null> {
  const locations = await getLocationIndex();

  if (client.brightlocalLocationId) {
    const hit = locations.find((l) => String(l.locationId) === String(client.brightlocalLocationId));
    if (hit) return hit;
  }

  const clientDomains = [client.domain, ...(client.aliases ?? [])].map((d) => d.toLowerCase()).filter(Boolean);
  if (clientDomains.length) {
    const hit = locations.find((l) => l.domains.some((d) => clientDomains.includes(d)));
    if (hit) return hit;
  }

  const cn = norm(client.name);
  if (cn.length < 4) return null;
  // Prefer the longest BrightLocal name that contains the client name, or is contained by it.
  let best: { loc: BLLocation; score: number } | null = null;
  for (const l of locations) {
    for (const n of l.names) {
      const bn = norm(n);
      let score = 0;
      if (bn === cn) score = 1000;
      else if (bn.startsWith(cn + " ") || bn.includes(" " + cn + " ") || bn.endsWith(" " + cn)) score = 500 + cn.length;
      else if (cn.includes(bn) && bn.length >= 4) score = 200 + bn.length;
      if (score && (!best || score > best.score)) best = { loc: l, score };
    }
  }
  return best?.loc ?? null;
}

// ---------------------------------------------------------------------------
// Per-location data
// ---------------------------------------------------------------------------
interface LsrcDetail {
  response: {
    result: {
      name: string;
      last_processed?: string;
      google_location?: string;
      search_terms?: string[];
      urls?: { public_csv_url?: string };
    };
  };
}

/** Minimal CSV parser for the ranking report (quoted fields, commas). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((c) => c !== "")) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const rankNum = (v: string | undefined): number | null => {
  if (!v || /n\/a/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function fetchLocalRanks(
  campaignIds: number[],
): Promise<{ ranks: LocalRank[]; updatedAt?: string; area?: string; note?: string; tracked: string[] }> {
  const ranks: LocalRank[] = [];
  const tracked: string[] = [];
  let updatedAt: string | undefined;
  let area: string | undefined;
  let note: string | undefined;
  if (!campaignIds.length) note = "No rank tracker campaign for this location in BrightLocal.";
  for (const id of campaignIds) {
    const d = await get<LsrcDetail>("/v2/lsrc/get", { "campaign-id": String(id) });
    const c = d.response?.result;
    if (!c) continue;
    updatedAt = updatedAt ?? c.last_processed;
    area = area ?? c.google_location;
    for (const t of c.search_terms ?? []) tracked.push(t.replace(/​/g, "").trim());
    const csvUrl = c.urls?.public_csv_url;
    if (!csvUrl) {
      note = `Rankings for "${c.name}" are not readable yet: open the campaign in BrightLocal and turn on "Public report" (share link) so the app can read its CSV.`;
      continue;
    }
    const res = await fetch(csvUrl);
    if (!res.ok) continue;
    for (const r of parseCsv(await res.text())) {
      const keyword = (r.Keyword ?? "").replace(/​/g, "").trim();
      if (!keyword) continue;
      ranks.push({
        keyword,
        position: rankNum(r.Rank),
        prevPosition: rankNum(r["Last Rank"]),
        engine: r["Search Engine"],
      });
    }
  }
  // Best (lowest) positions first, unranked last.
  ranks.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  return { ranks, updatedAt, area, note: ranks.length ? undefined : note, tracked: [...new Set(tracked)] };
}

interface GpwResults {
  results?: {
    summary?: {
      business_name?: string;
      claimed?: boolean;
      citations_count?: number;
      domain_authority?: number;
      backlinks?: number;
      num_reviews?: number;
      star_rating?: number;
      num_photos?: number;
      categories?: string[];
      profile_url?: string;
      website_address?: string;
    };
    keywords?: Record<
      string,
      {
        client_rank?: string | null;
        top_10?: { business_name: string; rank: string; client_business: boolean; num_reviews?: number; star_rating?: number }[];
      }
    >;
  };
}

async function fetchGbp(reportIds: number[]) {
  if (!reportIds.length) return null;
  const r = await get<GpwResults>(`/v4/gpw/${reportIds[0]}/results`);
  const s = r.results?.summary ?? {};
  const keywords = Object.entries(r.results?.keywords ?? {}).map(([keyword, v]) => {
    const top = v.top_10 ?? [];
    const mine = top.find((t) => t.client_business);
    const leader = top[0];
    return {
      keyword,
      rank: v.client_rank ?? mine?.rank ?? null,
      leader: leader ? `${leader.business_name}${leader.num_reviews ? ` (${leader.num_reviews} reviews, ${leader.star_rating}★)` : ""}` : undefined,
    };
  });
  return {
    businessName: s.business_name,
    claimed: Boolean(s.claimed),
    photos: s.num_photos ?? 0,
    categories: s.categories ?? [],
    reviews: s.num_reviews ?? 0,
    rating: s.star_rating ?? 0,
    citationsCount: s.citations_count ?? 0,
    domainAuthority: s.domain_authority,
    backlinks: s.backlinks,
    profileUrl: s.profile_url,
    keywords,
  };
}

interface CtResults {
  response?: {
    results?: {
      active?: { source: string; need_to_fix?: unknown[]; status?: string }[];
      pending?: unknown[];
      flags?: { customer?: { new?: unknown[]; disappeared?: unknown[] } };
    };
  };
}

async function fetchCitations(reportIds: number[]) {
  if (!reportIds.length) return null;
  // Use the most recently run report for this location.
  const reports = (indexCache?.ctReports ?? []).filter((r) => reportIds.includes(r.report_id));
  reports.sort((a, b) => (b.last_run ?? "").localeCompare(a.last_run ?? ""));
  const meta = reports[0];
  const id = meta?.report_id ?? reportIds[0];
  const r = await get<CtResults>("/v2/ct/get-results", { "report-id": String(id) });
  const res = r.response?.results ?? {};
  const active = res.active ?? [];
  const needFix = active.filter((a) => Array.isArray(a.need_to_fix) && a.need_to_fix.length > 0);
  return {
    total: active.length + (res.pending?.length ?? 0),
    live: active.length,
    pending: res.pending?.length ?? 0,
    errors: needFix.length,
    errorSources: needFix.slice(0, 5).map((a) => a.source),
    newSinceLastRun: res.flags?.customer?.new?.length ?? 0,
    disappeared: res.flags?.customer?.disappeared?.length ?? 0,
    lastRun: meta?.last_run,
  };
}

interface RfReviews {
  total_count?: number;
  reviews?: { rating: number; author: string; text: string; timestamp: string; directory?: string; name?: string }[];
}

async function fetchReviews(reportIds: number[]): Promise<{ total: number; recent: Review[] } | null> {
  if (!reportIds.length) return null;
  const r = await get<RfReviews>(`/v4/rf/${reportIds[0]}/reviews`);
  const list = (r.reviews ?? []).map((x) => ({
    rating: Number(x.rating) || 0,
    author: x.author || "Anonymous",
    text: x.text || "",
    date: new Date(x.timestamp.replace(" ", "T") + "Z").toISOString(),
    source: x.name || x.directory || "Unknown",
  }));
  list.sort((a, b) => b.date.localeCompare(a.date));
  return { total: r.total_count ?? list.length, recent: list.slice(0, 10) };
}

export async function fetchBrightLocalForClient(client: Client): Promise<BrightLocalData> {
  const location = await matchLocation(client);
  if (!location) {
    throw new Error(
      `No BrightLocal location matches "${client.name}". Create a rank tracker campaign, GBP report, or citation report for them in BrightLocal, or set brightlocalLocationId on the client.`,
    );
  }

  const [rank, gbp, citations, reviewReport] = await Promise.all([
    fetchLocalRanks(location.rankCampaignIds),
    fetchGbp(location.gbpReportIds).catch(() => null),
    fetchCitations(location.citationReportIds).catch(() => null),
    fetchReviews(location.reviewReportIds).catch(() => null),
  ]);

  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const recent = reviewReport?.recent ?? [];
  const issues: string[] = [];
  if (gbp && !gbp.claimed) issues.push("Google Business Profile is not claimed");
  if (gbp && gbp.photos < 10) issues.push(`Only ${gbp.photos} photos on the profile`);
  for (const k of gbp?.keywords ?? []) {
    if (!k.rank) issues.push(`Not in the GBP top 10 for "${k.keyword}"${k.leader ? ` (leader: ${k.leader})` : ""}`);
  }
  if (citations && citations.errors > 0) issues.push(`${citations.errors} citation(s) need fixing: ${citations.errorSources.join(", ")}`);
  if (citations && citations.disappeared > 0) issues.push(`${citations.disappeared} citation(s) disappeared since the last run`);
  const unranked = rank.ranks.filter((r) => r.position === null);
  if (unranked.length) issues.push(`Not ranking in the local pack for ${unranked.length} tracked keyword(s)`);

  return {
    locationName: location.names[0] ?? client.name,
    locationId: location.locationId,
    area: rank.area,
    localRanks: rank.ranks,
    ranksUpdatedAt: rank.updatedAt,
    ranksNote: rank.note,
    trackedKeywords: rank.tracked,
    reviews: {
      total: gbp?.reviews ?? reviewReport?.total ?? 0,
      avgRating: gbp?.rating ?? (recent.length ? Math.round((recent.reduce((s, r) => s + r.rating, 0) / recent.length) * 10) / 10 : 0),
      newLast30Days: recent.filter((r) => new Date(r.date).getTime() > thirtyDaysAgo).length,
      recent,
      note: reviewReport ? undefined : "Review text needs a Reviews report for this location in BrightLocal. Count and rating come from the GBP report.",
    },
    citations: {
      total: citations?.total ?? 0,
      live: citations?.live ?? 0,
      pending: citations?.pending ?? 0,
      errors: citations?.errors ?? 0,
      lastRun: citations?.lastRun,
    },
    gbp: {
      claimed: gbp?.claimed,
      photos: gbp?.photos,
      categories: gbp?.categories,
      profileUrl: gbp?.profileUrl,
      keywordRanks: gbp?.keywords.map((k) => ({ keyword: k.keyword, rank: k.rank, leader: k.leader })),
      issues,
    },
  };
}
