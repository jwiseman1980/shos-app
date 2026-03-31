import { NextResponse } from "next/server";
import {
  createSession,
  authenticateUser,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export async function POST(request) {
  const body = await request.json();
  const { email, password } = body;

  const volunteer = await authenticateUser(email, password);
  if (!volunteer) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const session = await createSession(volunteer.email);
  const response = NextResponse.json({
    ok: true,
    user: {
      name: volunteer.name,
      email: volunteer.email,
      role: volunteer.role,
      initials: volunteer.initials,
      isFounder: volunteer.isFounder || false,
    },
  });

  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
