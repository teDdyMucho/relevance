"use client";

import { useEffect, useMemo, useState } from "react";
import BriefPanel, { type BriefState } from "@/components/BriefPanel";
import EventList, { type EventWithClient } from "@/components/EventList";
import ModeBadge from "@/components/ModeBadge";
import SourcePanel, { type PanelState } from "@/components/SourcePanel";
import { SOURCE_KEYS, type Client, type SourceKey, type SourceMode, type SourceResult } from "@/lib/types";

type Panels = Record<SourceKey, PanelState>;

const IDLE_PANELS = (): Panels => ({
  calendar: { status: "idle" },
  monday: { status: "idle" },
  gmail: { status: "idle" },
  semrush: { status: "idle" },
  brightlocal: { status: "idle" },
});

/** What the brief is about: a calendar event, or a client picked by hand. */
type Target = { kind: "event"; event: EventWithClient } | { kind: "client"; client: Client };

export default function Dashboard() {
  const [events, setEvents] = useState<EventWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [calendarMode, setCalendarMode] = useState<SourceMode>();
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [manualClientId, setManualClientId] = useState<string>("");
  const [panels, setPanels] = useState<Panels>(IDLE_PANELS);
  const [brief, setBrief] = useState<BriefState>({ status: "idle" });
  const [running, setRunning] = useState(false);

  // Load upcoming events and the client list on mount.
  useEffect(() => {
    (async () => {
      try {
        const [evRes, clRes] = await Promise.all([fetch("/api/events"), fetch("/api/clients")]);
        const ev = await evRes.json();
        const cl = await clRes.json();
        if (!evRes.ok) throw new Error(ev.error ?? "Failed to load events");
        setEvents(ev.events);
        setCalendarMode(ev.mode);
        if (clRes.ok) setClients(cl.clients);
        const firstWithClient = ev.events.find((e: EventWithClient) => e.client) ?? ev.events[0];
        if (firstWithClient) setSelectedEventId(firstWithClient.id);
      } catch (err) {
        setEventsError(err instanceof Error ? err.message : String(err));
      } finally {
        setEventsLoading(false);
      }
    })();
  }, []);

  const target = useMemo<Target | null>(() => {
    if (manualClientId) {
      const client = clients.find((c) => c.id === manualClientId);
      return client ? { kind: "client", client } : null;
    }
    const event = events.find((e) => e.id === selectedEventId);
    return event ? { kind: "event", event } : null;
  }, [manualClientId, clients, events, selectedEventId]);

  function reset() {
    setPanels(IDLE_PANELS());
    setBrief({ status: "idle" });
  }

  function selectEvent(id: string) {
    setSelectedEventId(id);
    setManualClientId("");
    reset();
  }

  function selectClient(id: string) {
    setManualClientId(id);
    reset();
  }

  /** The trigger: collect every source in parallel, then build the brief. */
  async function generate() {
    if (!target || running) return;
    setRunning(true);
    setBrief({ status: "idle" });
    setPanels((p) => {
      const next = { ...p };
      for (const k of SOURCE_KEYS) next[k] = { status: "loading" };
      return next;
    });

    const ref = target.kind === "event" ? { eventId: target.event.id } : { clientId: target.client.id };

    const results = await Promise.all(
      SOURCE_KEYS.map(async (source): Promise<SourceResult> => {
        let result: SourceResult;
        try {
          const res = await fetch(`/api/sources/${source}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ref),
          });
          result = await res.json();
          if (!res.ok) throw new Error((result as unknown as { error: string }).error);
        } catch (err) {
          result = {
            source,
            mode: "mock",
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            fetchedAt: new Date().toISOString(),
          };
        }
        setPanels((p) => ({ ...p, [source]: { status: "done", result } }));
        return result;
      }),
    );

    setBrief({ status: "loading" });
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ref, results }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to build brief");
      setBrief({ status: "done", brief: json });
    } catch (err) {
      setBrief({ status: "error", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }

  const noClientOnEvent = target?.kind === "event" && !target.event.client;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left: calendar + manual client picker */}
      <aside className="no-print space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming events</h2>
            <ModeBadge mode={calendarMode} />
          </div>
          {eventsError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{eventsError}</div>
          ) : (
            <EventList
              events={events}
              selectedId={manualClientId ? null : selectedEventId}
              onSelect={selectEvent}
              loading={eventsLoading}
              disabled={running}
            />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Or pick a client</h2>
          <select
            value={manualClientId}
            disabled={running || !clients.length}
            onChange={(e) => selectClient(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status && c.status !== "Active" ? ` (${c.status})` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">{clients.length} clients loaded from Monday Accounts.</p>
        </div>
      </aside>

      {/* Right: trigger, source panels, brief */}
      <div className="space-y-6">
        <div className="no-print flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            {target?.kind === "event" && (
              <>
                <div className="truncate text-base font-semibold">{target.event.title}</div>
                <div className="text-xs text-slate-500">
                  {new Date(target.event.start).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {" · "}
                  {target.event.attendees.map((a) => a.name ?? a.email).join(", ") || "no attendees"}
                </div>
                {target.event.description && (
                  <div className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{target.event.description}</div>
                )}
                <div className="mt-1 text-xs">
                  {target.event.client ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Client: {target.event.client.name}</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">No client matched. Pick one on the left to run anyway.</span>
                  )}
                </div>
              </>
            )}
            {target?.kind === "client" && (
              <>
                <div className="truncate text-base font-semibold">{target.client.name}</div>
                <div className="text-xs text-slate-500">
                  Manual check · {target.client.domain || "no domain"}
                  {target.client.accountManager ? ` · AM ${target.client.accountManager}` : ""}
                </div>
              </>
            )}
            {!target && <div className="text-sm text-slate-500">Select an event or a client on the left.</div>}
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={!target || running || noClientOnEvent}
            className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Collecting data…" : "Generate brief"}
          </button>
        </div>

        <div className="no-print grid gap-4 md:grid-cols-2">
          {SOURCE_KEYS.map((k) => (
            <SourcePanel key={k} source={k} state={panels[k]} />
          ))}
        </div>

        <BriefPanel state={brief} />
      </div>
    </div>
  );
}
