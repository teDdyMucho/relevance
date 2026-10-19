"use client";

import type { CalendarEvent, Client } from "@/lib/types";

export type EventWithClient = CalendarEvent & { client: Client | null };

function fmt(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay
    ? "Today"
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

export default function EventList({
  events,
  selectedId,
  onSelect,
  loading,
  disabled,
}: {
  events: EventWithClient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  disabled: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return <p className="text-sm text-slate-500">No upcoming events.</p>;
  }

  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const active = e.id === selectedId;
        return (
          <li key={e.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(e.id)}
              className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-medium text-slate-500">{fmt(e.start)}</div>
              <div className="mt-0.5 text-sm font-medium leading-snug">{e.title}</div>
              <div className="mt-1 text-xs">
                {e.client ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Client: {e.client.name}</span>
                ) : (
                  <span className="text-slate-400">No client matched</span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
