import { sourceMode } from "@/lib/config";
import { MOCK_CLIENTS } from "@/lib/mock/data";
import { getMondayClients } from "@/lib/monday/accounts";
import type { Client } from "@/lib/types";

/**
 * The client list. In Monday live mode it is the CRM Accounts board,
 * otherwise the three demo clients.
 */
export async function getClients(): Promise<Client[]> {
  if (sourceMode("monday") === "live") return getMondayClients();
  return MOCK_CLIENTS;
}

export async function getClientById(id: string): Promise<Client | null> {
  const all = await getClients();
  return all.find((c) => c.id === id) ?? null;
}
