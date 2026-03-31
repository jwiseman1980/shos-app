import { NextResponse } from "next/server";
import { verifyHmac } from "@/lib/hmac";
import bcrypt from "bcryptjs";
import { getServerClient } from "@/lib/supabase";

export async function POST(request) {
  const { token, email, password } = await request.json().catch(() => ({}));

  if (!token || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const secret = process.env.SESSION_SECRET || "fallback-dev-secret";
  const payload = await verifyHmac(secret, token);

  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  // payload = "reset:{email}:{expiry}"
  const parts = payload.split(":");
  if (parts[0] !== "reset" || parts[1] !== email) {
    return NextResponse.json({ error: "Invalid reset token" }, { status: 400 });
  }

  const expiry = parseInt(parts[2]);
  if (Date.now() > expiry) {
    return NextResponse.json({ error: "Reset link has expired. Request a new one." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  // Update Supabase volunteers table
  const sb = getServerClient();
  const { error } = await sb
    .from("volunteers")
    .update({ password_hash: hash })
    .eq("email", email);

  if (error) {
    console.error("[reset] Supabase update failed:", error.message);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
