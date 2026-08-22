import { afterEach, describe, expect, it } from "vitest";
import { getJwtSecret, getJwtSecretKey, JWT_SECRET_MIN_LENGTH } from "./_core/jwtSecret";

const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("JWT_SECRET configuration", () => {
  it("uses a configured secret when it meets the minimum length", () => {
    process.env.JWT_SECRET = "a".repeat(JWT_SECRET_MIN_LENGTH);
    expect(getJwtSecret()).toHaveLength(JWT_SECRET_MIN_LENGTH);
    expect(getJwtSecretKey()).toHaveLength(JWT_SECRET_MIN_LENGTH);
  });

  it("falls back to a valid secret when the environment value is short", () => {
    process.env.JWT_SECRET = "too-short-secret";
    expect(getJwtSecret().length).toBeGreaterThanOrEqual(JWT_SECRET_MIN_LENGTH);
    expect(getJwtSecretKey().length).toBeGreaterThanOrEqual(JWT_SECRET_MIN_LENGTH);
  });
});
