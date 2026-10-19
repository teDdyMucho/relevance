"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GoogleConnect({
  configured,
  connected,
  email,
}: {
  configured: boolean;
  connected: boolean;
  email?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnectGoogle() {
    setBusy(true);
    await fetch("/api/auth/google", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!configured) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first, then restart the dev server.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {connected ? (
        <>
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Connected{email ? ` as ${email}` : ""}
          </span>
          <button
            type="button"
            onClick={disconnectGoogle}
            disabled={busy}
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
  );
}
