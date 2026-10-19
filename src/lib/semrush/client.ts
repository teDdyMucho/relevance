import type { SemrushData, SemrushKeyword } from "@/lib/types";

/**
 * Semrush Analytics API v3 (https://developer.semrush.com/api/v3/analytics/).
 * Auth: SEMRUSH_API_KEY. Every call costs API units from the account balance.
 *
 * Cost per brief (approx): domain_ranks 10 + 10 (last month) + domain_organic 10 per keyword
 * + backlinks_overview 40 = about 160 units with the default 10 keywords.
 *
 * Responses are CSV with ";" separators. Errors come back as "ERROR <code> :: <message>".
 */
const ANALYTICS_BASE = "https://api.semrush.com/";
const BACKLINKS_BASE = "https://api.semrush.com/analytics/v1/";
const UNITS_URL = "https://www.semrush.com/users/countapiunits.html";

const DATABASE = process.env.SEMRUSH_DATABASE ?? "us";
const KEYWORD_LIMIT = Number(process.env.SEMRUSH_KEYWORD_LIMIT ?? 10);

function apiKey(): string {
  const key = process.env.SEMRUSH_API_KEY;
  if (!key) throw new Error("SEMRUSH_API_KEY is not set in .env.local.");
  return key;
}

class SemrushError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

function parseError(text: string): SemrushError | null {
  // e.g. "ERROR 403 :: ERROR 132 :: API UNITS BALANCE IS ZERO" or "ERROR 50 :: NOTHING FOUND"
  if (!text.startsWith("ERROR")) return null;
  const codes = [...text.matchAll(/ERROR (\d+)/g)].map((m) => Number(m[1]));
  const code = codes[codes.length - 1] ?? 0;
  const msg = text.split("::").pop()?.trim() ?? text;
  if (code === 132) {
    return new SemrushError(code, "Semrush API units balance is zero. Buy API units at semrush.com/accounts/subscription-info/api-units/ and try again.");
  }
  if (code === 120 || code === 121) return new SemrushError(code, "Semrush API key is invalid or disabled. Check SEMRUSH_API_KEY.");
  return new SemrushError(code, `Semrush error ${code}: ${msg}`);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

async function call(base: string, params: Record<string, string>): Promise<Record<string, string>[]> {
  const url = `${base}?${new URLSearchParams({ key: apiKey(), ...params })}`;
  const res = await fetch(url);
  const text = await res.text();
  const err = parseError(text);
  if (err) {
    if (err.code === 50) return []; // NOTHING FOUND is a normal empty result
    throw err;
  }
  if (!res.ok) throw new Error(`Semrush HTTP ${res.status}: ${text.slice(0, 200)}`);
  return parseCsv(text);
}

const num = (v: string | undefined) => {
  const n = Number((v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function lastMonthStamp(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}15`;
}

/** Remaining API units on the account. */
export async function getUnitsBalance(): Promise<number> {
  const res = await fetch(`${UNITS_URL}?key=${apiKey()}`);
  const text = (await res.text()).trim();
  if (!res.ok || !/^\d+$/.test(text)) {
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { errors?: { message?: string }[] };
      msg = j.errors?.map((e) => e.message).join("; ") ?? msg;
    } catch {
      /* not JSON */
    }
    throw new Error(`Semrush units check failed: ${msg}`);
  }
  return Number(text);
}

export function toSemrushDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

export async function fetchSemrushForDomain(rawDomain: string): Promise<SemrushData> {
  const domain = toSemrushDomain(rawDomain);
  if (!domain) throw new Error("No website domain is known for this client.");

  // Current overview. Rk = Semrush rank, Or = organic keywords, Ot = organic traffic, Oc = traffic cost.
  const [ranks] = await call(ANALYTICS_BASE, {
    type: "domain_ranks",
    export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At",
    domain,
    database: DATABASE,
  });
  if (!ranks) throw new Error(`Semrush has no data for ${domain} in the "${DATABASE}" database.`);

  // Last month, for the month-over-month traffic change. Optional.
  let prevTraffic: number | null = null;
  try {
    const [prev] = await call(ANALYTICS_BASE, {
      type: "domain_ranks",
      export_columns: "Dn,Or,Ot",
      domain,
      database: DATABASE,
      display_date: lastMonthStamp(),
    });
    if (prev) prevTraffic = num(prev.Ot ?? prev["Organic Traffic"]);
  } catch {
    /* history is optional */
  }

  // Top organic keywords by traffic. Pp = previous position, Pd = position difference, Nq = volume.
  const organic = await call(ANALYTICS_BASE, {
    type: "domain_organic",
    export_columns: "Ph,Po,Pp,Pd,Nq,Ur,Tr",
    domain,
    database: DATABASE,
    display_limit: String(KEYWORD_LIMIT),
    display_sort: "tr_desc",
  });

  // Backlink totals. Optional (different endpoint, 40 units).
  let backlinks = 0;
  let referringDomains = 0;
  try {
    const [bl] = await call(BACKLINKS_BASE, {
      type: "backlinks_overview",
      target: domain,
      target_type: "root_domain",
      export_columns: "total,domains_num",
    });
    if (bl) {
      backlinks = num(bl.total);
      referringDomains = num(bl.domains_num);
    }
  } catch {
    /* optional */
  }

  const organicTraffic = num(ranks.Ot ?? ranks["Organic Traffic"]);
  const trafficChangePct =
    prevTraffic && prevTraffic > 0 ? Math.round(((organicTraffic - prevTraffic) / prevTraffic) * 1000) / 10 : 0;

  const topKeywords: SemrushKeyword[] = organic.map((r) => {
    const position = num(r.Po ?? r.Position);
    const prevRaw = num(r.Pp ?? r["Previous Position"]);
    return {
      keyword: r.Ph ?? r.Keyword ?? "",
      position,
      prevPosition: prevRaw > 0 ? prevRaw : position,
      volume: num(r.Nq ?? r["Search Volume"]),
      url: r.Ur ?? r.Url,
    };
  });

  return {
    domain,
    organicKeywords: num(ranks.Or ?? ranks["Organic Keywords"]),
    organicTraffic,
    trafficChangePct,
    backlinks,
    referringDomains,
    topKeywords,
  };
}
