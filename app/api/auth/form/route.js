import { NextResponse } from "next/server";
import { authenticateUser, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

/**
 * Handles native HTML form POST (progressive enhancement fallback).
 * When JS hasn't hydrated yet the login form submits here directly.
 * On success: sets cookie + redirects to /
 * On failure: redirects to /login?error=1
 */
export async function POST(request) {
  const formData = await request.formData();
  const email = formData.get("email") || "";
  const password = formData.get("password") || "";

  const volunteer = await authenticateUser(email, password);

  if (!volunteer) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 302);
  }

  const session = await createSession(volunteer.email);
  const response = NextResponse.redirect(new URL("/", request.url), 302);

  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
