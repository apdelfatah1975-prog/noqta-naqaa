import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { getJwtSecretKey } from "./jwtSecret";

const scryptAsync = promisify(scryptCallback);
const SESSION_AUDIENCE = "purepoint-local-session";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [salt, storedHex] = encodedHash.split(":");
  if (!salt || !storedHex || !/^[0-9a-f]+$/i.test(storedHex)) return false;
  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scryptAsync(password, salt, stored.length)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

function secretKey() {
  return getJwtSecretKey();
}

export async function createLocalSessionToken(user: Pick<User, "id" | "email" | "role" | "name">) {
  return new SignJWT({
    userId: user.id,
    email: user.email ?? "",
    role: user.role,
    name: user.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuer(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secretKey());
}

export async function getLocalUserId(req: Request): Promise<number | null> {
  const cookies = req.headers.cookie ?? "";
  const cookieToken = cookies
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const authorization = req.headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const token = cookieToken || bearerToken;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: SESSION_AUDIENCE,
    });
    const userId = Number(payload.userId ?? payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

export async function setLocalSessionCookie(req: Request, res: Response, user: Pick<User, "id" | "email" | "role" | "name">) {
  const token = await createLocalSessionToken(user);
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

export function clearLocalSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
}
