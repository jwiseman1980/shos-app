import { NextResponse } from "next/server";
import { verifyHmac } from "@/lib/hmac";

const SESSION_COOKIE = "shos_session";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/sf-test") ||
    pathname.startsWith("/api/slack/events") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/brand") ||
    pathname === "/public"
  ) {
    return NextResponse.next();
  }

  // Allow API routes with valid API key
  if (pathname.startsWith("/api/")) {
    const apiKey = request.headers.get("x-api-key");
    if (apiKey && apiKey === process.env.SHOS_API_KEY) {
      return NextResponse.next();
    }
  }

  const session = request.cookies.get(SESSION_COOKIE);
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyHmac(secret, session.value);
  const userEmail = payload ? payload.split(":")[0] : null;
  if (!userEmail || !userEmail.includes("@")) {
    // Invalid or old-format session — force re-login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // Pass user email to server components via header
  const response = NextResponse.next();
  response.headers.set("x-user-email", userEmail);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
