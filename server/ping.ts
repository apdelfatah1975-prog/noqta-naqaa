export function getPingPayload() {
  return {
    ok: true as const,
    service: "purepoint" as const,
    timestamp: new Date().toISOString(),
  };
}
