import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { genId, nowIso } from "@/lib/util";
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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }
  const id = genId("u");
  const name = String(body.name || email.split("@")[0]).slice(0, 80);
  const { salt, hash } = hashPassword(password);
  db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)").run(id, email, name, salt + ":" + hash);
  db.prepare(
    "INSERT INTO settings (user_id, provider, base_url, model, temperature, max_tokens) VALUES (?,?,?,?,?,?)"
  ).run(id, "openrouter", "https://openrouter.ai/api/v1", "anthropic/claude-sonnet-4", 0.3, 5000);

  const token = createSessionToken(id, email);
  const res = NextResponse.json({ user: { id, email, name } });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
