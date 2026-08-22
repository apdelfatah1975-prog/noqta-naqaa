import { describe, expect, it } from "vitest";
import { createClientOperationId } from "./offlineDatabase";

describe("offline database helpers", () => {
  it("creates unique client operation ids with a readable prefix", () => {
    const first = createClientOperationId("visit");
    const second = createClientOperationId("visit");
    expect(first.startsWith("visit-")).toBe(true);
    expect(second.startsWith("visit-")).toBe(true);
    expect(first).not.toBe(second);
  });
});
