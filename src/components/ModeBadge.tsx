import type { SourceMode } from "@/lib/types";

export default function ModeBadge({ mode }: { mode: SourceMode | undefined }) {
  if (!mode) return null;
  const cls =
    mode === "live"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{mode}</span>;
}
