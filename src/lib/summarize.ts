import { summaryMode } from "@/lib/config";
import type {
  Brief,
  BrightLocalData,
  CalendarEvent,
  Client,
  GmailData,
  MondayData,
  SemrushData,
  SourceResult,
} from "@/lib/types";

export interface SummarizeInput {
  event: CalendarEvent;
  client: Client | null;
  results: SourceResult[];
}

/**
 * Turn the collected source data into a meeting brief.
 * mock: rule-based summary built straight from the data (deterministic, no API cost).
 * live: TODO (Step: Summary) - send the same data to Claude with a prompt that
 *       produces keyPoints, sections and suggestedAgenda as JSON.
 */
export async function summarize(input: SummarizeInput): Promise<Brief> {
  if (summaryMode() === "live") return liveSummarize(input);
  return mockSummarize(input);
}

async function liveSummarize(_input: SummarizeInput): Promise<Brief> {
  throw new Error("AI summary live mode is not implemented yet. Set SUMMARY_MODE=mock.");
}

// ---------------------------------------------------------------------------
// Rule-based mock summarizer
// ---------------------------------------------------------------------------
function pick<T>(results: SourceResult[], source: string): T | undefined {
  const r = results.find((x) => x.source === source);
  return r?.ok ? (r.data as T) : undefined;
}

function fmtDate(iso?: string) {
  if (!iso) return "no date";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Colair | Email Campaign | October 2026 | 4/5" -> "Email Campaign October 2026 4/5" */
function shortProject(name: string) {
  const parts = name.split("|").map((s) => s.trim()).filter(Boolean);
  return (parts.length > 1 ? parts.slice(1) : parts).join(" ").replace(/\s+/g, " ");
}

function trend(curr: number | null, prev: number | null) {
  if (curr === null && prev === null) return "not ranking";
  if (curr === null) return `dropped out of top 20 (was #${prev})`;
  if (prev === null) return `new at #${curr}`;
  if (curr < prev) return `#${curr} (up from #${prev})`;
  if (curr > prev) return `#${curr} (down from #${prev})`;
  return `#${curr} (no change)`;
}

function mockSummarize({ event, client, results }: SummarizeInput): Brief {
  const monday = pick<MondayData>(results, "monday");
  const gmail = pick<GmailData>(results, "gmail");
  const semrush = pick<SemrushData>(results, "semrush");
  const bl = pick<BrightLocalData>(results, "brightlocal");

  const keyPoints: string[] = [];
  const sections: Brief["sections"] = [];
  const agenda: string[] = [];

  // --- Monday -------------------------------------------------------------
  if (monday) {
    const DONE = /done|complete/i;
    const label = (i: { name: string; group: string }) => `${i.name} (${shortProject(i.group)})`;
    const listOf = (xs: string[], max = 5) =>
      xs.slice(0, max).join(", ") + (xs.length > max ? ` and ${xs.length - max} more` : "");

    const overdue = monday.items.filter((i) => i.overdue);
    const stuck = monday.items.filter((i) => /stuck|on hold/i.test(i.status));
    const done = monday.items.filter((i) => DONE.test(i.status));
    const open = monday.items.filter((i) => !DONE.test(i.status));
    const waitingOnClient = open.filter((i) => /approv|client|feedback|upload customer/i.test(i.name));

    if (waitingOnClient.length) {
      keyPoints.push(`Waiting on the client for ${waitingOnClient.length} item(s): ${listOf(waitingOnClient.map(label))}.`);
      agenda.push(`Get client sign-off: ${listOf([...new Set(waitingOnClient.map((i) => shortProject(i.group)))], 4)}`);
    }
    if (overdue.length) keyPoints.push(`${overdue.length} overdue task(s): ${listOf(overdue.map(label))}.`);
    if (done.length) {
      const byProject = new Map<string, number>();
      for (const i of done) byProject.set(shortProject(i.group), (byProject.get(shortProject(i.group)) ?? 0) + 1);
      keyPoints.push(`Completed recently: ${listOf([...byProject.entries()].map(([p, n]) => `${p} (${n} task${n > 1 ? "s" : ""})`))}.`);
    }
    if (stuck.length) agenda.push(`Unblock: ${listOf(stuck.map(label), 4)}`);

    const projects = monday.projects ?? [];
    const projectBullets = projects.length
      ? projects.map((p) => `${p.name}: ${p.status}, AM ${p.owner}`)
      : [];

    sections.push({
      title: "Project status (Monday.com)",
      bullets: [
        `${open.length} open task(s), ${overdue.length} overdue, ${done.length} completed recently.`,
        ...projectBullets.slice(0, 15),
        ...overdue.map((i) => `OVERDUE: ${label(i)}, ${i.status}, owner ${i.owner}, due ${fmtDate(i.dueDate)}${i.latestUpdate ? `. Latest: ${i.latestUpdate}` : ""}`),
        ...open.filter((i) => !i.overdue).slice(0, 20).map((i) => `${label(i)}: ${i.status}, owner ${i.owner}${i.dueDate ? `, due ${fmtDate(i.dueDate)}` : ""}${i.latestUpdate ? `. Latest: ${i.latestUpdate}` : ""}`),
      ],
    });
  }

  // --- Gmail --------------------------------------------------------------
  if (gmail) {
    const needsReply = gmail.threads.filter((t) => t.needsReply);
    if (needsReply.length) {
      keyPoints.push(`${needsReply.length} client email(s) still waiting for a reply: ${needsReply.map((t) => `"${t.subject}"`).join(", ")}.`);
      agenda.push(...needsReply.map((t) => `Answer: ${t.subject}`));
    }
    sections.push({
      title: "Recent conversations (Gmail, last 30 days)",
      bullets: gmail.threads.map(
        (t) => `${fmtDate(t.date)} from ${t.from.replace(/<.*>/, "").trim()}: "${t.subject}". ${t.snippet}${t.needsReply ? " [needs reply]" : ""}`,
      ),
    });
  }

  // --- Semrush ------------------------------------------------------------
  if (semrush) {
    const dir = semrush.trafficChangePct >= 0 ? "up" : "down";
    keyPoints.push(`Organic traffic is ${dir} ${Math.abs(semrush.trafficChangePct)}% month over month (${semrush.organicTraffic.toLocaleString()} visits, ${semrush.organicKeywords} ranking keywords).`);
    const movers = semrush.topKeywords.filter((k) => k.position !== k.prevPosition);
    const gained = movers.filter((k) => k.position < k.prevPosition);
    const lost = movers.filter((k) => k.position > k.prevPosition);
    if (lost.length) agenda.push(`Discuss keyword drops: ${lost.map((k) => k.keyword).join(", ")}`);

    sections.push({
      title: "Organic search (Semrush)",
      bullets: [
        `Traffic ${semrush.organicTraffic.toLocaleString()} (${semrush.trafficChangePct >= 0 ? "+" : ""}${semrush.trafficChangePct}%), ${semrush.backlinks} backlinks from ${semrush.referringDomains} domains.`,
        ...(gained.length ? [`Gains: ${gained.map((k) => `${k.keyword} ${trend(k.position, k.prevPosition)}`).join("; ")}.`] : []),
        ...(lost.length ? [`Drops: ${lost.map((k) => `${k.keyword} ${trend(k.position, k.prevPosition)}`).join("; ")}.`] : []),
        `Top keywords: ${semrush.topKeywords.map((k) => `${k.keyword} #${k.position}`).join(", ")}.`,
      ],
    });
  }

  // --- BrightLocal --------------------------------------------------------
  if (bl) {
    const lowReviews = bl.reviews.recent.filter((r) => r.rating <= 2);
    const ranked = bl.localRanks.filter((r) => r.position !== null);
    const top3 = ranked.filter((r) => (r.position ?? 99) <= 3);
    const improved = bl.localRanks.filter((r) => r.position !== null && r.prevPosition !== null && r.position < r.prevPosition);
    const dropped = bl.localRanks.filter((r) => r.position !== null && r.prevPosition !== null && r.position > r.prevPosition);
    const unranked = bl.localRanks.filter((r) => r.position === null);

    if (bl.localRanks.length) {
      keyPoints.push(
        `Local pack: ranking for ${ranked.length} of ${bl.localRanks.length} tracked keywords, ${top3.length} in the top 3` +
          (improved.length ? `, ${improved.length} improved` : "") +
          (dropped.length ? `, ${dropped.length} dropped` : "") +
          `.`,
      );
      if (dropped.length) agenda.push(`Local ranking drops: ${dropped.slice(0, 4).map((r) => `${r.keyword} ${trend(r.position, r.prevPosition)}`).join("; ")}`);
      if (unranked.length) agenda.push(`Not ranking locally: ${unranked.slice(0, 4).map((r) => r.keyword).join(", ")}${unranked.length > 4 ? ` and ${unranked.length - 4} more` : ""}`);
    }
    if (bl.reviews.total) {
      keyPoints.push(`Reviews: ${bl.reviews.avgRating} stars across ${bl.reviews.total} reviews${bl.reviews.newLast30Days ? `, ${bl.reviews.newLast30Days} new this month` : ""}${lowReviews.length ? `, ${lowReviews.length} negative to address` : ""}.`);
    }
    if (bl.citations.errors > 0) keyPoints.push(`${bl.citations.errors} citation(s) need fixing (${bl.citations.live} live, ${bl.citations.pending} pending).`);
    const gbpIssues = bl.gbp.issues.filter((i) => !/^Not ranking in the local pack/.test(i));
    if (gbpIssues.length) agenda.push(`GBP / listings: ${gbpIssues.slice(0, 3).join("; ")}${gbpIssues.length > 3 ? ` and ${gbpIssues.length - 3} more` : ""}`);
    if (lowReviews.length) agenda.push("Plan response to negative review(s)");

    sections.push({
      title: "Local SEO (BrightLocal)",
      bullets: [
        ...(bl.localRanks.length
          ? [`Local pack rankings${bl.area ? ` in ${bl.area}` : ""}${bl.ranksUpdatedAt ? ` (updated ${fmtDate(bl.ranksUpdatedAt)})` : ""}: ${bl.localRanks.map((r) => `${r.keyword} ${trend(r.position, r.prevPosition)}`).join("; ")}.`]
          : [bl.ranksNote ?? "No rank tracker campaign for this location."]),
        ...(bl.gbp.keywordRanks?.length
          ? [`GBP top-10 report: ${bl.gbp.keywordRanks.map((k) => `${k.keyword} ${k.rank ? `rank ${k.rank}` : "not in top 10"}`).join("; ")}.`]
          : []),
        `Citations: ${bl.citations.live} live, ${bl.citations.pending} pending, ${bl.citations.errors} need fixing${bl.citations.lastRun ? ` (last run ${fmtDate(bl.citations.lastRun)})` : ""}.`,
        ...(bl.gbp.auditScore !== undefined
          ? [`GBP audit score ${bl.gbp.auditScore}/100.`]
          : bl.gbp.claimed !== undefined
            ? [`GBP: ${bl.gbp.claimed ? "claimed" : "NOT claimed"}, ${bl.gbp.photos ?? 0} photos, categories: ${(bl.gbp.categories ?? []).join(", ") || "n/a"}.`]
            : []),
        `Issues: ${bl.gbp.issues.join("; ") || "none"}.`,
        ...bl.reviews.recent.slice(0, 5).map((r) => `${r.rating}-star on ${r.source} from ${r.author}${r.text ? `: "${r.text.slice(0, 160)}"` : ""}`),
        ...(bl.reviews.note ? [bl.reviews.note] : []),
      ],
    });
  }

  // --- Failures -----------------------------------------------------------
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    sections.push({
      title: "Sources that could not be loaded",
      bullets: failed.map((f) => `${f.source}: ${f.error}`),
    });
  }

  if (!keyPoints.length) keyPoints.push("No client data was collected for this event.");

  const clientName = client?.name ?? "No client matched";
  return {
    eventId: event.id,
    eventTitle: event.title,
    clientName,
    generatedAt: new Date().toISOString(),
    mode: "mock",
    headline: `${clientName}: prep for "${event.title}" on ${fmtDate(event.start)}`,
    keyPoints,
    sections,
    suggestedAgenda: agenda.length ? agenda : ["Review progress and agree next steps"],
  };
}
