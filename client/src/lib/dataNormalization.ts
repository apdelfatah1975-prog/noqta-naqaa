export type UnknownRecord = Record<string, unknown>;

const DEFAULT_LIST_KEYS = [
  "items",
  "data",
  "visits",
  "customers",
  "orders",
  "workOrders",
  "transactions",
  "movements",
  "technicians",
  "reminders",
  "due",
  "alerts",
  "proofs",
] as const;

/**
 * Converts a list-shaped response from the API, tRPC cache, or offline storage
 * into a safe array. Non-list payloads intentionally become an empty array.
 */
export function extractArray<T = any>(
  response: unknown,
  keys: readonly string[] = DEFAULT_LIST_KEYS,
): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== "object") return [];

  const record = response as UnknownRecord;
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate as T[];
  }

  return [];
}

export function normalizeListResponse<T = any>(
  response: unknown,
  keys?: readonly string[],
): T[] {
  return extractArray<T>(response, keys);
}

export function normalizeOptionalList<T = unknown>(
  response: unknown,
  keys?: readonly string[],
): T[] | null {
  if (response === null || response === undefined) return null;
  return extractArray<T>(response, keys);
}
