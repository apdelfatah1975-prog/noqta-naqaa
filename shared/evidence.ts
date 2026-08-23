const IMAGE_MIME_TYPES = new Set([
  "image/jpg",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]);

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function normalizeEvidenceDataUrl(value: string): string | null {
  const normalized = value.trim().replace(/\r?\n|\r/g, "");
  const match = normalized.match(/^data:([^;,\s]+)(?:;[^,]*)?;base64,(.+)$/i);
  if (!match) return null;

  const rawMime = match[1].toLowerCase();
  const mime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
  const payload = match[2].replace(/\s/g, "");
  const supported = IMAGE_MIME_TYPES.has(rawMime) || AUDIO_MIME_TYPES.has(rawMime);
  if (!supported || !payload || !BASE64_RE.test(payload) || payload.length % 4 === 1) return null;

  return `data:${mime};base64,${payload}`;
}

export function isSupportedEvidenceMime(mime: string, kind: "photo" | "signature" | "audio"): boolean {
  const normalized = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  return kind === "audio" ? AUDIO_MIME_TYPES.has(normalized) : IMAGE_MIME_TYPES.has(normalized);
}
