const JWT_SECRET_FALLBACK =
  "purepoint_secure_jwt_secret_fallback_key_2026_super_safe";

/**
 * Returns a signing secret that satisfies jose's minimum HS256 key length.
 * A properly configured environment variable always takes precedence.
 */
export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  return configured && configured.length >= 32
    ? configured
    : JWT_SECRET_FALLBACK;
}

export function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export const JWT_SECRET_MIN_LENGTH = 32;
