import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validEmail } from "@/lib/auth";
import { signToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth-token";

export const runtime = "nodejs";

/** Registrasi akun baru → langsung login (cookie sesi). */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const name = String(b.name || "").trim();
  const university = String(b.university || "").trim();

  if (!validEmail(email)) return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Kata sandi minimal 8 karakter" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email sudah terdaftar — silakan login" }, { status: 409 });

  const user = await prisma.user.create({
    data: { email, name, university, passwordHash: hashPassword(password), lastLoginAt: new Date() },
  });

  const token = await signToken(user.id, user.email);
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
  } catch (e: any) {
    const msg = String(e?.message || e);
    const hint = /table .* does not exist|P2021/i.test(msg)
      ? " — tabel belum dibuat: jalankan supabase/setup.sql di SQL Editor"
      : /P1001|P1017|Can't reach|timeout/i.test(msg)
        ? " — database tidak terjangkau: cek DATABASE_URL (pooler 6543)"
        : /Environment variable not found|DIRECT_URL|DATABASE_URL/i.test(msg)
          ? " — env database belum di-set di Vercel"
          : "";
    return NextResponse.json({ error: `Gagal mendaftar: ${msg}${hint}` }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
