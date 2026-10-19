import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

/** GET /api/auth/google/callback?code=... -> Google sends the user back here after consent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const settings = new URL("/settings", url.origin);

  if (error || !code) {
    settings.searchParams.set("google", "error");
    settings.searchParams.set("message", error ?? "No code returned from Google.");
    return NextResponse.redirect(settings);
  }

  try {
    const token = await exchangeCode(code);
    settings.searchParams.set("google", "connected");
    if (token.email) settings.searchParams.set("email", token.email);
  } catch (err) {
    settings.searchParams.set("google", "error");
    settings.searchParams.set("message", err instanceof Error ? err.message : String(err));
  }
  return NextResponse.redirect(settings);
}
