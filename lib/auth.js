import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import volunteers from "@/data/volunteers.json";

const SESSION_COOKIE = "shos_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  return process.env.SESSION_SECRET || "fallback-dev-secret";
}

function sign(value) {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(value);
  return value + "." + hmac.digest("hex");
}

function verify(signed) {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  if (sign(value) === signed) return value;
  return null;
}

/**
 * Create a session token that encodes the volunteer's email.
 * Format: email:timestamp:random — signed with HMAC.
 */
export function createSession(email) {
  const payload = email + ":" + Date.now().toString(36) + ":" + crypto.randomBytes(8).toString("hex");
  return sign(payload);
}

/**
 * Check if the current request is authenticated.
 * Returns true/false.
 */
export async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return false;
  return verify(session.value) !== null;
}

/**
 * Get the logged-in volunteer from the session cookie.
 * Returns the full volunteer object or null.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;

  const payload = verify(session.value);
  if (!payload) return null;

  // Extract email from payload (email:timestamp:random)
  const email = payload.split(":")[0];
  if (!email) return null;

  const volunteer = volunteers.find(
    (v) => v.email.toLowerCase() === email.toLowerCase()
  );
  if (!volunteer) return null;

  // Return volunteer without password hash
  const { passwordHash, ...safeVolunteer } = volunteer;
  return safeVolunteer;
}

/**
 * Authenticate a volunteer by email and password.
 * Returns the volunteer object (without hash) or null.
 */
export async function authenticateUser(email, password) {
  if (!email || !password) return null;

  const volunteer = volunteers.find(
    (v) => v.email.toLowerCase() === email.toLowerCase()
  );
  if (!volunteer || !volunteer.passwordHash) return null;

  const match = await bcrypt.compare(password, volunteer.passwordHash);
  if (!match) return null;

  const { passwordHash, ...safeVolunteer } = volunteer;
  return safeVolunteer;
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
