/**
 * The public origin of the current request, e.g. https://relevanceaibot.netlify.app
 * or http://localhost:3000. Honors the forwarding headers Netlify and other proxies set,
 * so OAuth redirects go back to the site the user is actually on.
 */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function googleRedirectUri(req: Request): string {
  return `${publicOrigin(req)}/api/auth/google/callback`;
}
