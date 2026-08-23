import { describe, expect, it } from "vitest";
import { normalizeEvidenceDataUrl, isSupportedEvidenceMime } from "./evidence";

describe("evidence data URL normalization", () => {
  it.each([
    ["image/jpg", "image/jpeg"],
    ["image/jpeg", "image/jpeg"],
    ["image/png", "image/png"],
    ["image/webp", "image/webp"],
    ["image/heic", "image/heic"],
    ["image/heif", "image/heif"],
  ])("normalizes %s to %s", (inputMime, outputMime) => {
    expect(normalizeEvidenceDataUrl(` data:${inputMime};base64, aGVsbG8=\n`)).toBe(`data:${outputMime};base64,aGVsbG8=`);
  });

  it("removes whitespace from a camera payload", () => {
    expect(normalizeEvidenceDataUrl("data:image/jpeg;base64,aGVs\n bG8=\r")).toBe("data:image/jpeg;base64,aGVsbG8=");
  });

  it("supports audio formats without changing their MIME", () => {
    expect(normalizeEvidenceDataUrl("data:audio/webm;base64,YQ==")).toBe("data:audio/webm;base64,YQ==");
  });

  it("rejects malformed or unsupported data URLs", () => {
    expect(normalizeEvidenceDataUrl("data:image/gif;base64,YQ==")).toBeNull();
    expect(normalizeEvidenceDataUrl("data:image/jpeg;base64,not valid!")).toBeNull();
    expect(normalizeEvidenceDataUrl("https://example.com/photo.jpg")).toBeNull();
  });

  it("matches supported MIME types by evidence kind", () => {
    expect(isSupportedEvidenceMime("image/heif", "photo")).toBe(true);
    expect(isSupportedEvidenceMime("image/jpg", "signature")).toBe(true);
    expect(isSupportedEvidenceMime("audio/ogg", "audio")).toBe(true);
    expect(isSupportedEvidenceMime("image/png", "audio")).toBe(false);
  });
});
