import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth-token";

/**
 * Gerbang autentikasi global.
 * - Halaman publik: landing "/", /login, /register, /api/auth/*, file statis.
 * - Selain itu: wajib cookie sesi bertanda tangan HMAC yang valid.
 *   Halaman → redirect /login?next=…; API → 401 JSON.
 */
const PUBLIC_EXACT = ["/", "/login", "/register"];
const PUBLIC_PREFIX = ["/api/auth/", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const payload = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (payload) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Belum login — silakan masuk terlebih dahulu." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // semua rute kecuali asset statis Next & file publik
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|ico|txt)$).*)"],
};
