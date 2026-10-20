import { NextResponse } from "next/server";
import { disconnect, getAuthUrl, loadToken } from "@/lib/google/oauth";
import { googleRedirectUri } from "@/lib/request";

export const dynamic = "force-dynamic";

/** GET /api/auth/google -> send the user to Google's consent screen. */
export async function GET(req: Request) {
  try {
    return NextResponse.redirect(getAuthUrl(googleRedirectUri(req)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/auth/google -> reveal the stored refresh token so it can be copied into
 * the host's GOOGLE_REFRESH_TOKEN env var (makes the connection permanent for everyone).
 */
export async function POST() {
  const token = await loadToken();
  if (!token) return NextResponse.json({ error: "Google is not connected." }, { status: 404 });
  return NextResponse.json({ refresh_token: token.refresh_token, email: token.email, source: token.source });
}

/** DELETE /api/auth/google -> forget the stored refresh token. */
export async function DELETE() {
  await disconnect();
  return NextResponse.json({ ok: true });
}
