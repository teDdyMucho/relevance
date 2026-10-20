"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GoogleConnect({
  configured,
  connected,
  email,
  source,
}: {
  configured: boolean;
  connected: boolean;
  email?: string;
  source?: "env" | "cookie" | "file";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function disconnectGoogle() {
    setBusy(true);
    await fetch("/api/auth/google", { method: "DELETE" });
    setBusy(false);
    setRevealed(null);
    router.refresh();
  }

  async function reveal() {
    const res = await fetch("/api/auth/google", { method: "POST" });
    const json = await res.json();
    setRevealed(res.ok ? json.refresh_token : json.error);
  }

  async function copy() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!configured) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first, then restart or redeploy.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {connected ? (
          <>
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Connected{email ? ` as ${email}` : ""}
              {source === "env" && " (permanent, from GOOGLE_REFRESH_TOKEN)"}
              {source === "cookie" && " (this browser only)"}
              {source === "file" && " (local file)"}
            </span>
            <button
              type="button"
              onClick={disconnectGoogle}
              disabled={busy || source === "env"}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Disconnect
            </button>
            <a href="/api/auth/google" className="text-sm text-indigo-600 hover:underline">
              Reconnect
            </a>
          </>
        ) : (
          <a
            href="/api/auth/google"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Connect Google
          </a>
        )}
      </div>

      {connected && source !== "env" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p>
            On a hosted site this connection only lives in your browser. To make it permanent for everyone, copy the
            refresh token into the host&apos;s <code>GOOGLE_REFRESH_TOKEN</code> environment variable and redeploy.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!revealed ? (
              <button type="button" onClick={reveal} className="rounded border border-amber-300 px-2 py-1 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40">
                Show refresh token
              </button>
            ) : (
              <>
                <code className="max-w-full break-all rounded bg-white px-2 py-1 dark:bg-slate-900">{revealed}</code>
                <button type="button" onClick={copy} className="rounded border border-amber-300 px-2 py-1 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
