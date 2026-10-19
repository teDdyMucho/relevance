import { promises as fs } from "fs";
import path from "path";

/**
 * Minimal Google OAuth 2.0 helper (no SDK, plain fetch).
 *
 * Flow:
 *   1. /api/auth/google            -> redirects the user to Google's consent screen
 *   2. /api/auth/google/callback   -> exchanges the code for tokens, stores the refresh token
 *   3. getAccessToken()            -> trades the refresh token for a short-lived access token
 *
 * The refresh token is read from GOOGLE_REFRESH_TOKEN if set, otherwise from
 * .data/google-token.json (git-ignored). Calendar and Gmail share this one sign-in.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const TOKEN_FILE = path.join(process.cwd(), ".data", "google-token.json");

interface StoredToken {
  refresh_token: string;
  email?: string;
  savedAt: string;
}

function clientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local.");
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAuthUrl(): string {
  const { clientId, redirectUri } = clientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force Google to return a refresh token every time
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<StoredToken> {
  const { clientId, clientSecret, redirectUri } = clientConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.refresh_token) {
    throw new Error(
      `Google token exchange failed: ${json.error_description ?? json.error ?? res.statusText}` +
        (json.refresh_token ? "" : " (no refresh_token returned; remove the app at myaccount.google.com/permissions and try again)"),
    );
  }

  // Look up which account signed in, for display on the Settings page.
  let email: string | undefined;
  try {
    const me = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (me.ok) email = ((await me.json()) as { emailAddress?: string }).emailAddress;
  } catch {
    /* optional */
  }

  const token: StoredToken = { refresh_token: json.refresh_token, email, savedAt: new Date().toISOString() };
  await saveToken(token);
  return token;
}

async function saveToken(token: StoredToken) {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), "utf8");
}

export async function loadToken(): Promise<StoredToken | null> {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return { refresh_token: process.env.GOOGLE_REFRESH_TOKEN, savedAt: "env" };
  }
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

export async function disconnect() {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    /* already gone */
  }
}

/** Short-lived access token, cached in memory until a minute before it expires. */
let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const stored = await loadToken();
  if (!stored) {
    throw new Error("Google is not connected yet. Go to Settings and click Connect Google.");
  }
  const { clientId, clientSecret } = clientConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: stored.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token refresh failed: ${json.error_description ?? json.error ?? res.statusText}. Reconnect Google in Settings.`);
  }
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** The signed-in Gmail address, from the stored token or the Gmail profile endpoint. */
let cachedEmail: string | null = null;
export async function getMyEmail(): Promise<string | undefined> {
  if (cachedEmail) return cachedEmail;
  const stored = await loadToken();
  if (stored?.email) return (cachedEmail = stored.email);
  try {
    const p = await googleGet<{ emailAddress?: string }>("https://gmail.googleapis.com/gmail/v1/users/me/profile");
    if (p.emailAddress) cachedEmail = p.emailAddress;
    return p.emailAddress;
  } catch {
    return undefined;
  }
}

/** Authenticated GET against a Google API, returns parsed JSON or throws with the API's message. */
export async function googleGet<T>(url: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`Google API error ${res.status}: ${json.error?.message ?? res.statusText}`);
  }
  return json;
}
