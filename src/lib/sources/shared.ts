import type { Client, SourceContext } from "@/lib/types";

export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function requireClient(ctx: SourceContext): Client {
  if (!ctx.client) {
    throw new Error(
      "No client matched this event. Add the client name to the event title or invite someone from the client's email domain.",
    );
  }
  return ctx.client;
}
