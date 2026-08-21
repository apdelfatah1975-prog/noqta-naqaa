export type ParsedLocation = {
  latitude: string | null;
  longitude: string | null;
  normalizedLocation: string;
  source: "coordinates" | "google_maps_url" | "text" | "empty";
  message: string;
};

const COORDINATE_PATTERN = /(-?\d{1,3}(?:\.\d+)?)\s*[,،]\s*(-?\d{1,3}(?:\.\d+)?)/;

function validCoordinatePair(latitude: string, longitude: string) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function extractPair(value: string) {
  const match = value.match(COORDINATE_PATTERN);
  if (!match || !validCoordinatePair(match[1], match[2])) return null;
  return { latitude: match[1], longitude: match[2] };
}

export function parseWhatsAppLocationText(value: string): ParsedLocation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { latitude: null, longitude: null, normalizedLocation: "", source: "empty", message: "ألصق رابط الموقع أو الإحداثيات أولًا." };
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // Keep the original value when the pasted URL contains malformed encoding.
  }

  const urlPair = extractPair(decoded.match(/@(-?\d{1,3}(?:\.\d+)?[,،]\s*-?\d{1,3}(?:\.\d+)?)/)?.[1] ?? "")
    ?? extractPair(decoded.match(/[?&](?:q|query|ll|center)=(-?\d{1,3}(?:\.\d+)?[,،]\s*-?\d{1,3}(?:\.\d+)?)/i)?.[1] ?? "")
    ?? extractPair(decoded.match(/(?:maps\.google\.[^/]+\/maps|maps\.google\.com|google\.[^/]+\/maps)[^\s]*?(-?\d{1,3}(?:\.\d+)?[,،]\s*-?\d{1,3}(?:\.\d+)?)/i)?.[1] ?? "");

  if (urlPair) {
    return { ...urlPair, normalizedLocation: trimmed, source: "google_maps_url", message: "تم استخراج إحداثيات الموقع من رابط الخريطة." };
  }

  const directPair = extractPair(trimmed);
  if (directPair) {
    return { ...directPair, normalizedLocation: `${directPair.latitude}, ${directPair.longitude}`, source: "coordinates", message: "تم استخراج الإحداثيات بنجاح." };
  }

  if (/^(https?:\/\/)?(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|www\.google\.)/i.test(trimmed)) {
    return { latitude: null, longitude: null, normalizedLocation: trimmed, source: "google_maps_url", message: "تم حفظ رابط الخريطة. هذا الرابط المختصر يحتاج فتحه بالإنترنت لاستخراج الإحداثيات." };
  }

  return { latitude: null, longitude: null, normalizedLocation: trimmed, source: "text", message: "تم حفظ النص كما هو في بطاقة الموقع؛ أضف رابط Google Maps أو إحداثيات بصيغة latitude, longitude لاستخراج الإحداثيات." };
}
