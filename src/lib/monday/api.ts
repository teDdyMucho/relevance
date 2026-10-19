/**
 * Monday.com GraphQL API (https://api.monday.com/v2).
 * Auth: personal API token in MONDAY_API_TOKEN.
 */
const ENDPOINT = "https://api.monday.com/v2";
const API_VERSION = "2025-01";

export async function mondayGql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error("MONDAY_API_TOKEN is not set in .env.local.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[]; error_message?: string };
  if (!res.ok || json.errors?.length || json.error_message) {
    const msg = json.errors?.map((e) => e.message).join("; ") ?? json.error_message ?? res.statusText;
    throw new Error(`Monday API error: ${msg}`);
  }
  return json.data as T;
}
