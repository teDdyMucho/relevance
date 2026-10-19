import { NextResponse } from "next/server";
import { disconnect, getAuthUrl } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

/** GET /api/auth/google -> send the user to Google's consent screen. */
export async function GET() {
  try {
    return NextResponse.redirect(getAuthUrl());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/auth/google -> forget the stored refresh token. */
export async function DELETE() {
  await disconnect();
  return NextResponse.json({ ok: true });
}
