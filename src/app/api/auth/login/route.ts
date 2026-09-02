import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { signToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth-token";

export const runtime = "nodejs";

/** Login email + kata sandi → cookie sesi. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

    const token = await signToken(user.id, user.email);
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
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
        : "";
    return NextResponse.json({ error: `Gagal login: ${msg}${hint}` }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
