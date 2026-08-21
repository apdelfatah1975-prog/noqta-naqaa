import { describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "./_core/localAuth";

describe("local authentication", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const password = "PurePoint-secure-123";
    const encoded = await hashPassword(password);
    expect(encoded).toContain(":");
    expect(encoded).not.toContain(password);
    expect(await verifyPassword(password, encoded)).toBe(true);
    expect(await verifyPassword("wrong-password", encoded)).toBe(false);
  });

  it("rejects malformed password hashes", async () => {
    expect(await verifyPassword("anything", "malformed")).toBe(false);
  });
});
