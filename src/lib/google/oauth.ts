import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import path from "path";

/**
 * Minimal Google OAuth 2.0 helper (no SDK, plain fetch).
 *
 * Flow:
 *   1. /api/auth/google            -> redirects the user to Google's consent screen
 *   2. /api/auth/google/callback   -> exchanges the code for tokens, stores the refresh token
 *   3. getAccessToken()            -> trades the refresh token for a short-lived access token
 *
 * Where the refresh token lives (first match wins):
 *   - GOOGLE_REFRESH_TOKEN env var           -> permanent, works for every visitor (recommended for hosting)
 *   - encrypted httpOnly cookie "rl_google"   -> set by the callback; works on serverless hosts like Netlify
 *   - .data/google-token.json                 -> local dev convenience (git-ignored)
 * Calendar and Gmail share this one sign-in.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const TOKEN_FILE = path.join(process.cwd(), ".data", "google-token.json");
const COOKIE_NAME = "rl_google";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface StoredToken {
  refresh_token: string;
  email?: string;
  savedAt: string;
  source?: "env" | "cookie" | "file";
}

function clientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in the environment.");
  }
  return { clientId, clientSecret };
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// ---------------------------------------------------------------------------
// Cookie encryption (AES-256-GCM). Key derives from TOKEN_SECRET, or from the
// Google client secret so no extra config is needed.
// ---------------------------------------------------------------------------
function cookieKey(): Buffer {
  const secret = process.env.TOKEN_SECRET || process.env.GOOGLE_CLIENT_SECRET || "relevance-dev";
  return createHash("sha256").update(`relevance:${secret}`).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decrypt(blob: string): string | null {
  try {
    const buf = Buffer.from(blob, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function readCookieToken(): Promise<StoredToken | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    const json = decrypt(raw);
    if (!json) return null;
    return { ...(JSON.parse(json) as StoredToken), source: "cookie" };
  } catch {
    return null; // outside a request scope
  }
}

async function writeCookieToken(token: StoredToken | null) {
  try {
    const jar = await cookies();
    if (!token) {
      jar.delete(COOKIE_NAME);
      return;
    }
    jar.set(COOKIE_NAME, encrypt(JSON.stringify({ refresh_token: token.refresh_token, email: token.email, savedAt: token.savedAt })), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  } catch {
    /* outside a request scope */
  }
}

async function readFileToken(): Promise<StoredToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    return { ...(JSON.parse(raw) as StoredToken), source: "file" };
  } catch {
    return null;
  }
}

async function writeFileToken(token: StoredToken | null) {
  try {
    if (!token) {
      await fs.unlink(TOKEN_FILE);
      return;
    }
    await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
    await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), "utf8");
  } catch {
    /* read-only filesystem (serverless) or already gone */
  }
}

export async function loadToken(): Promise<StoredToken | null> {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return { refresh_token: process.env.GOOGLE_REFRESH_TOKEN, savedAt: "env", source: "env" };
  }
  return (await readCookieToken()) ?? (await readFileToken());
}

export async function disconnect() {
  cached = null;
  cachedEmail = null;
  await Promise.all([writeCookieToken(null), writeFileToken(null)]);
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------
export function getAuthUrl(redirectUri: string): string {
  const { clientId } = clientConfig();
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

export async function exchangeCode(code: string, redirectUri: string): Promise<StoredToken> {
  const { clientId, clientSecret } = clientConfig();
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
  cached = null;
  cachedEmail = null;
  await Promise.all([writeCookieToken(token), writeFileToken(token)]);
  return token;
}

/** Short-lived access token, cached in memory until a minute before it expires. */
let cached: { token: string; refresh: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const stored = await loadToken();
  if (!stored) {
    throw new Error("Google is not connected yet. Go to Settings and click Connect Google.");
  }
  if (cached && cached.refresh === stored.refresh_token && cached.expiresAt > Date.now() + 60_000) return cached.token;

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
  cached = { token: json.access_token, refresh: stored.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
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
