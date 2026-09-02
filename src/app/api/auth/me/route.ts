import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth-token";

export const runtime = "nodejs";

/** User yang sedang login (dari cookie sesi) — 401 bila belum. */
export async function GET(req: NextRequest) {
  const payload = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, university: user.university } });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
