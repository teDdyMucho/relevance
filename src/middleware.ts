import { NextResponse, type NextRequest } from "next/server";

/**
 * Site-wide password gate (HTTP Basic Auth).
 * Active only when APP_PASSWORD is set, so local dev stays open.
 * Set APP_USER (default "admin") and APP_PASSWORD in the host's environment.
 */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.APP_USER || "admin";
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, p] = atob(header.slice(6)).split(":");
      if (u === user && p === password) return NextResponse.next();
    } catch {
      /* fall through */
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Relevance", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
