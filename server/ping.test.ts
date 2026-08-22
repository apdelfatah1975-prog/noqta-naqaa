import { describe, expect, it } from "vitest";
import { getPingPayload } from "./ping";

describe("getPingPayload", () => {
  it("returns a healthy Pure Point response with an ISO timestamp", () => {
    const payload = getPingPayload();

    expect(payload.ok).toBe(true);
    expect(payload.service).toBe("purepoint");
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
