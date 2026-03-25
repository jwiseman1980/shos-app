import { NextResponse } from "next/server";

const SESSION_COOKIE = "shos_session";

async function verifyAndExtract(signed, secret) {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const providedSig = signed.slice(idx + 1);

  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedSig !== providedSig) return null;

  // Extract email from payload (email:timestamp:random)
  const email = value.split(":")[0];
  return email || null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/sf-test") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/public"
  ) {
    return NextResponse.next();
  }

  // Allow API routes with valid API key
  if (pathname.startsWith("/api/")) {
    const apiKey = request.headers.get("x-api-key") || request.nextUrl.searchParams.get("key");
    if (apiKey && apiKey === process.env.SHOS_API_KEY) {
      return NextResponse.next();
    }
  }

  const session = request.cookies.get(SESSION_COOKIE);
  const secret = process.env.SESSION_SECRET || "fallback-dev-secret";

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userEmail = await verifyAndExtract(session.value, secret);
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
