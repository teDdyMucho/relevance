"use client";

import { useState } from "react";
import ModeBadge from "@/components/ModeBadge";
import type { Brief } from "@/lib/types";

export type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; brief: Brief };

/** Plain-text version of the brief, used by the Copy button. */
export function briefToText(b: Brief): string {
  const lines: string[] = [];
  lines.push(b.headline, "");
  lines.push("KEY POINTS");
  b.keyPoints.forEach((p) => lines.push(`- ${p}`));
  lines.push("", "SUGGESTED AGENDA");
  b.suggestedAgenda.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  for (const s of b.sections) {
    lines.push("", s.title.toUpperCase());
    s.bullets.forEach((x) => lines.push(`- ${x}`));
  }
  lines.push("", `Generated ${new Date(b.generatedAt).toLocaleString()}`);
  return lines.join("\n");
}

export default function BriefPanel({ state }: { state: BriefState }) {
  const [copied, setCopied] = useState(false);

  async function copy(b: Brief) {
    await navigator.clipboard.writeText(briefToText(b));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadPdf() {
    window.print();
  }

  return (
    <section className="print-area rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Meeting brief</h2>
          {state.status === "done" && <ModeBadge mode={state.brief.mode} />}
        </div>
        {state.status === "done" && (
          <div className="no-print flex gap-2">
            <button
              type="button"
              onClick={() => copy(state.brief)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Download PDF
            </button>
          </div>
        )}
      </header>

      {state.status === "idle" && (
        <p className="text-sm text-slate-400">The brief appears here after all sources are collected.</p>
      )}
      {state.status === "loading" && (
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      )}
      {state.status === "error" && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {state.error}
        </div>
      )}
      {state.status === "done" && <BriefBody brief={state.brief} />}
    </section>
  );
}

function BriefBody({ brief }: { brief: Brief }) {
  return (
    <article className="space-y-5 text-sm">
      <div>
        <h3 className="text-lg font-semibold leading-snug">{brief.headline}</h3>
        <p className="text-xs text-slate-500">
          Prepared {new Date(brief.generatedAt).toLocaleString()} for {brief.clientName}
        </p>
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Key points</h4>
        <ul className="list-disc space-y-1 pl-5">
          {brief.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Suggested agenda</h4>
        <ol className="list-decimal space-y-1 pl-5">
          {brief.suggestedAgenda.map((a, i) => <li key={i}>{a}</li>)}
        </ol>
      </div>

      <details open className="group">
        <summary className="no-print cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
          Full report
        </summary>
        <div className="mt-2 space-y-4">
          {brief.sections.map((s) => (
            <div key={s.title}>
              <h4 className="mb-1 font-semibold">{s.title}</h4>
              <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}
