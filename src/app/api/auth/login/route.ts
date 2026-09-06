import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSessionToken } from "@/lib/auth";

const COOKIE = "riset_session";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!row) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }
  const [salt, stored] = String(row.password_hash).split(":");
  const { hash } = hashPassword(password, salt);
  const ok = hash === stored;
  if (!ok) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }
  const token = createSessionToken(row.id, row.email);
  const res = NextResponse.json({ user: { id: row.id, email: row.email, name: row.name } });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
