import { NextResponse } from "next/server";
import { signHmac } from "@/lib/hmac";
import volunteers from "@/data/volunteers.json";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const volunteer = volunteers.find(
    (v) => v.email.toLowerCase() === email.toLowerCase()
  );

  // Always return success — don't reveal whether the email exists
  if (!volunteer) {
    return NextResponse.json({ ok: true });
  }

  const secret = process.env.SESSION_SECRET || "fallback-dev-secret";
  const expiry = Date.now() + RESET_TTL_MS;
  const payload = `reset:${volunteer.email}:${expiry}`;
  const token = await signHmac(secret, payload);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shos-app.vercel.app";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(volunteer.email)}`;

  // Send via SendGrid
  const sgKey = process.env.SENDGRID_API_KEY;
  if (sgKey) {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sgKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: volunteer.email, name: volunteer.name }] }],
        from: { email: "joseph.wiseman@steel-hearts.org", name: "SHOS" },
        subject: "SHOS — Password Reset",
        content: [
          {
            type: "text/plain",
            value: `Hi ${volunteer.name.split(" ")[0]},\n\nClick the link below to reset your SHOS password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— SHOS`,
          },
        ],
      }),
    });
  } else {
    // Log to console in dev
    console.log("[reset-request] Reset URL:", resetUrl);
  }

  return NextResponse.json({ ok: true });
}
