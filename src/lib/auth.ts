/** Hash & verifikasi password dengan scrypt (node:crypto, tanpa dependency). */
import crypto from "crypto";

const N = 16384, r = 8, p = 1, KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N, r, p });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = (stored || "").split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || "");
}
