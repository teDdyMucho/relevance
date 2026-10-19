"use client";

import ModeBadge from "@/components/ModeBadge";
import {
  SOURCE_LABELS,
  type BrightLocalData,
  type GmailData,
  type MondayData,
  type MondayItem,
  type SemrushData,
  type SourceKey,
  type SourceResult,
} from "@/lib/types";

export type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: SourceResult };

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Delta({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr === null) return <span className="text-rose-500">out</span>;
  if (prev === null) return <span className="text-emerald-500">new</span>;
  const diff = prev - curr;
  if (diff === 0) return <span className="text-slate-400">–</span>;
  return diff > 0 ? (
    <span className="text-emerald-500">▲{diff}</span>
  ) : (
    <span className="text-rose-500">▼{Math.abs(diff)}</span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Done: "bg-emerald-500",
  Completed: "bg-emerald-500",
  "Working on it": "bg-amber-400",
  Ongoing: "bg-amber-400",
  Stuck: "bg-rose-500",
  "On Hold": "bg-rose-400",
  "In review": "bg-sky-500",
  "Not started": "bg-slate-400",
  "Not Started": "bg-slate-400",
  New: "bg-sky-400",
};

function TaskRow({ i }: { i: MondayItem }) {
  return (
    <li className="py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-snug">{i.name}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[i.status] ?? "bg-slate-400"}`} />
          {i.status}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        {i.owner} · due {fmtDate(i.dueDate) || "n/a"}
        {i.overdue && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">OVERDUE</span>}
      </div>
      {i.latestUpdate && <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">“{i.latestUpdate}”</div>}
    </li>
  );
}

function MondayView({ data }: { data: MondayData }) {
  const overdue = data.items.filter((i) => i.overdue).length;
  const open = data.items.filter((i) => !i.overdue && !/done|complete/i.test(i.status)).length;
  const done = data.items.length - overdue - open;

  // Group tasks by their parent project, keeping the sorted order (overdue projects first).
  const groups = new Map<string, MondayItem[]>();
  for (const i of data.items) {
    const list = groups.get(i.group) ?? [];
    list.push(i);
    groups.set(i.group, list);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">{data.boardName}</div>
        {data.boardUrl && (
          <a href={data.boardUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
            Open in Monday
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Overdue" value={String(overdue)} sub={overdue ? <span className="text-rose-500">needs attention</span> : <span className="text-emerald-500">none</span>} />
        <Stat label="Open" value={String(open)} />
        <Stat label="Done recently" value={String(done)} />
      </div>
      {groups.size === 0 && <p className="text-sm text-slate-400">No active work found for this client.</p>}
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {[...groups.entries()].map(([project, items]) => (
          <div key={project}>
            <div className="sticky top-0 bg-white py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              {project}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((i) => <TaskRow key={i.id} i={i} />)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function GmailView({ data }: { data: GmailData }) {
  return (
    <div className="space-y-2">
      <div className="truncate font-mono text-[11px] text-slate-500">{data.query}</div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.threads.map((t) => (
          <li key={t.id} className="py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className={`leading-snug ${t.unread ? "font-semibold" : "font-medium"}`}>{t.subject}</span>
              <span className="shrink-0 text-xs text-slate-500">{fmtDate(t.date)}</span>
            </div>
            <div className="text-xs text-slate-500">{t.from}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t.snippet}</div>
            {t.needsReply && (
              <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                NEEDS REPLY
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs">{sub}</div>}
    </div>
  );
}

function SemrushView({ data }: { data: SemrushData }) {
  const up = data.trafficChangePct >= 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Traffic"
          value={data.organicTraffic.toLocaleString()}
          sub={<span className={up ? "text-emerald-500" : "text-rose-500"}>{up ? "+" : ""}{data.trafficChangePct}% MoM</span>}
        />
        <Stat label="Keywords" value={data.organicKeywords.toLocaleString()} />
        <Stat label="Backlinks" value={data.backlinks.toLocaleString()} sub={<span className="text-slate-500">{data.referringDomains} domains</span>} />
      </div>
      <table className="w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1 font-medium">Keyword</th>
            <th className="py-1 text-right font-medium">Pos</th>
            <th className="py-1 text-right font-medium">Δ</th>
            <th className="py-1 text-right font-medium">Vol</th>
          </tr>
        </thead>
        <tbody>
          {data.topKeywords.map((k) => (
            <tr key={k.keyword} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5">{k.keyword}</td>
              <td className="py-1.5 text-right font-semibold">#{k.position}</td>
              <td className="py-1.5 text-right"><Delta curr={k.position} prev={k.prevPosition} /></td>
              <td className="py-1.5 text-right text-slate-500">{k.volume.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrightLocalView({ data }: { data: BrightLocalData }) {
  const gbpStat =
    data.gbp.auditScore !== undefined
      ? { value: String(data.gbp.auditScore), sub: `${data.gbp.issues.length} issues` }
      : { value: data.gbp.claimed === undefined ? "–" : data.gbp.claimed ? "Claimed" : "Unclaimed", sub: `${data.gbp.photos ?? 0} photos · ${data.gbp.issues.length} issues` };
  const ranked = data.localRanks.filter((r) => r.position !== null);
  const top3 = ranked.filter((r) => (r.position ?? 99) <= 3).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          {data.locationName}
          {data.area ? ` · ${data.area}` : ""}
        </div>
        {data.gbp.profileUrl && (
          <a href={data.gbp.profileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
            GBP
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Rating"
          value={`${data.reviews.avgRating}★`}
          sub={<span className="text-slate-500">{data.reviews.total} reviews{data.reviews.newLast30Days ? `, +${data.reviews.newLast30Days} this month` : ""}</span>}
        />
        <Stat
          label="Citations"
          value={`${data.citations.live}`}
          sub={data.citations.errors ? <span className="text-rose-500">{data.citations.errors} to fix</span> : <span className="text-emerald-500">{data.citations.pending} pending</span>}
        />
        <Stat label="GBP" value={gbpStat.value} sub={<span className="text-slate-500">{gbpStat.sub}</span>} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
          <span>Local pack rankings</span>
          <span className="normal-case">
            {ranked.length}/{data.localRanks.length} ranking · {top3} in top 3
            {data.ranksUpdatedAt ? ` · ${fmtDate(data.ranksUpdatedAt)}` : ""}
          </span>
        </div>
        {data.localRanks.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {data.ranksNote ?? "No rank tracker campaign for this location."}
            {data.trackedKeywords?.length ? ` Tracking ${data.trackedKeywords.length} keywords.` : ""}
          </p>
        )}
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs">
          {data.localRanks.map((r) => (
            <li key={r.keyword} className="flex justify-between gap-2">
              <span className="truncate">{r.keyword}</span>
              <span className="flex shrink-0 gap-2">
                <span className={`font-semibold ${r.position === null ? "text-slate-400" : r.position <= 3 ? "text-emerald-600" : ""}`}>
                  {r.position === null ? "not ranking" : `#${r.position}`}
                </span>
                <Delta curr={r.position} prev={r.prevPosition} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {data.gbp.keywordRanks && data.gbp.keywordRanks.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">GBP top 10 (monthly report)</div>
          <ul className="space-y-0.5 text-xs">
            {data.gbp.keywordRanks.map((k) => (
              <li key={k.keyword} className="flex justify-between gap-2">
                <span className="truncate">{k.keyword}</span>
                <span className={`shrink-0 font-semibold ${k.rank ? "text-emerald-600" : "text-slate-400"}`}>{k.rank ? `rank ${k.rank}` : "not in top 10"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.gbp.issues.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Issues</div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-400">
            {data.gbp.issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Recent reviews</div>
        {data.reviews.recent.length === 0 && (
          <p className="text-xs text-slate-400">{data.reviews.note ?? "No recent reviews."}</p>
        )}
        <ul className="space-y-1.5 text-xs">
          {data.reviews.recent.slice(0, 5).map((r, i) => (
            <li key={i}>
              <span className={r.rating <= 2 ? "text-rose-500" : "text-amber-500"}>{"★".repeat(r.rating)}</span>{" "}
              <span className="text-slate-500">{r.author} · {r.source} · {fmtDate(r.date)}</span>
              {r.text && <div className="line-clamp-2 text-slate-600 dark:text-slate-400">“{r.text}”</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Body({ source, result }: { source: SourceKey; result: SourceResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        {result.error}
      </div>
    );
  }
  switch (source) {
    case "monday":
      return <MondayView data={result.data as MondayData} />;
    case "gmail":
      return <GmailView data={result.data as GmailData} />;
    case "semrush":
      return <SemrushView data={result.data as SemrushData} />;
    case "brightlocal":
      return <BrightLocalView data={result.data as BrightLocalData} />;
    default:
      return <pre className="text-xs">{JSON.stringify(result.data, null, 2)}</pre>;
  }
}

export default function SourcePanel({ source, state }: { source: SourceKey; state: PanelState }) {
  return (
    <section className="flex min-h-[200px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{SOURCE_LABELS[source]}</h3>
        <div className="flex items-center gap-2">
          {state.status === "done" && <ModeBadge mode={state.result.mode} />}
          {state.status === "loading" && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          )}
          {state.status === "done" && (
            <span className={`h-2 w-2 rounded-full ${state.result.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
          )}
        </div>
      </header>

      {state.status === "idle" && (
        <p className="text-sm text-slate-400">Select an event and click Generate brief.</p>
      )}
      {state.status === "loading" && (
        <div className="space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      )}
      {state.status === "done" && <Body source={source} result={state.result} />}
    </section>
  );
}
