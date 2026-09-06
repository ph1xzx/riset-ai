import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "riset_session";
const SECRET = process.env.AUTH_SECRET || "riset-ai-dev-secret-change-me";

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, email: string): string {
  const data = Buffer.from(JSON.stringify({ userId, email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }))
    .toString("base64url");
  return `${data}.${sign(data)}`;
}

export function parseSessionToken(token: string | undefined): { userId: string; email: string } | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  if (sign(data) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload.userId || payload.exp < Date.now()) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<{ id: string; email: string; name: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const parsed = parseSessionToken(token);
  if (!parsed) return null;
  const row = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(parsed.userId) as
    | { id: string; email: string; name: string }
    | undefined;
  return row || null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(password, s, 64).toString("hex");
  return { salt: s, hash: h };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const { hash: computed } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
}
