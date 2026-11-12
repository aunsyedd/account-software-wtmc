import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const email = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;
  const publicPath = path.startsWith("/login") || path.startsWith("/signup");
  if (!email && !publicPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    // Drop stale / unsigned cookies from older versions.
    if (req.cookies.get(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (email && publicPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.jpg).*)"],
};
