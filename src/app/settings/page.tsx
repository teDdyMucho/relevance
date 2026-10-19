import GoogleConnect from "@/components/GoogleConnect";
import { REQUIRED_ENV, envStatus, sourceMode, summaryMode } from "@/lib/config";
import { getMyEmail, isGoogleConfigured, loadToken } from "@/lib/google/oauth";
import { type SourceKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROWS: { key: SourceKey | "summary"; label: string; note: string }[] = [
  { key: "calendar", label: "Google Calendar", note: "Reads upcoming events from one calendar." },
  { key: "gmail", label: "Gmail", note: "Searches the company inbox for the client domain, last 30 days." },
  { key: "monday", label: "Monday.com", note: "Reads the client board: tasks, status, owners, latest updates." },
  { key: "semrush", label: "Semrush", note: "Domain traffic, keyword rankings, backlinks." },
  { key: "brightlocal", label: "BrightLocal", note: "Local rankings, reviews, citations, GBP audit." },
  { key: "summary", label: "AI summary", note: "Turns the collected data into the meeting brief." },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; email?: string; message?: string }>;
}) {
  const sp = await searchParams;
  const token = await loadToken();
  const googleConfigured = isGoogleConfigured();
  const googleEmail = token ? await getMyEmail() : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every integration runs in <b>mock</b> mode until its env vars are set and its <code>*_MODE</code> is{" "}
          <code>live</code>. Edit <code>.env.local</code> and restart the dev server.
        </p>
      </div>

      {/* Google sign-in */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Google account (Calendar + Gmail)</h2>
        <p className="mb-3 text-xs text-slate-500">
          One sign-in covers both. Read-only access. Calendar: <code>{process.env.GOOGLE_CALENDAR_ID || "primary"}</code>
        </p>
        {sp.google === "connected" && (
          <div className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Google connected{sp.email ? ` as ${sp.email}` : ""}. Set <code>CALENDAR_MODE=live</code> in .env.local and restart to use real events.
          </div>
        )}
        {sp.google === "error" && (
          <div className="mb-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            Google sign-in failed: {sp.message}
          </div>
        )}
        <GoogleConnect configured={googleConfigured} connected={Boolean(token)} email={googleEmail} />
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-3">Integration</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Required env vars</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ROWS.map((row) => {
              const mode = row.key === "summary" ? summaryMode() : sourceMode(row.key);
              const vars = envStatus(REQUIRED_ENV[row.key]);
              const isGoogle = row.key === "calendar" || row.key === "gmail";
              return (
                <tr key={row.key}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-slate-500">{row.note}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={
                        mode === "live"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }
                    >
                      {mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ul className="space-y-1 font-mono text-xs">
                      {vars.map((v) => (
                        <li key={v.key} className="flex items-center gap-2">
                          <span className={v.set ? "text-emerald-500" : "text-slate-400"}>{v.set ? "●" : "○"}</span>
                          <span>{v.key}</span>
                        </li>
                      ))}
                      {isGoogle && (
                        <li className="flex items-center gap-2">
                          <span className={token ? "text-emerald-500" : "text-slate-400"}>{token ? "●" : "○"}</span>
                          <span>Google sign-in (Connect button above)</span>
                        </li>
                      )}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Build order</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600 dark:text-slate-300">
          <li>Google Calendar (OAuth, one calendar)</li>
          <li>Gmail (same Google sign-in, read-only scope already requested)</li>
          <li>Monday.com (personal API token)</li>
          <li>Semrush (API key, needs API units on the plan)</li>
          <li>BrightLocal (API key + secret)</li>
          <li>AI summary (Claude)</li>
          <li>Client list moved from mock data to a database or Monday board</li>
        </ol>
      </div>
    </div>
  );
}
