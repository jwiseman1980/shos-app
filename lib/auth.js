import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import volunteers from "@/data/volunteers.json";
import { signHmac, verifyHmac } from "@/lib/hmac";

const SESSION_COOKIE = "shos_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required");
  return secret;
}

/**
 * Create a session token that encodes the volunteer's email.
 */
export async function createSession(email) {
  const payload = email + ":" + Date.now().toString(36) + ":" + crypto.randomBytes(8).toString("hex");
  return signHmac(getSecret(), payload);
}

/**
 * Check if the current request is authenticated.
 */
export async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return false;
  return (await verifyHmac(getSecret(), session.value)) !== null;
}

/**
 * Get the logged-in volunteer from the session cookie.
 * Returns volunteer info from volunteers.json (no SF call needed for basic info).
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;

  const payload = await verifyHmac(getSecret(), session.value);
  if (!payload) return null;

  const email = payload.split(":")[0];
  if (!email) return null;

  const volunteer = volunteers.find(
    (v) => v.email.toLowerCase() === email.toLowerCase()
  );
  if (!volunteer) return null;

  const { passwordHash, ...safeVolunteer } = volunteer;
  return safeVolunteer;
}

/**
 * Authenticate a volunteer by email and password.
 * Checks Salesforce first (persistent), falls back to volunteers.json.
 */
export async function authenticateUser(email, password) {
  if (!email || !password) return null;

  const volunteer = volunteers.find(
    (v) => v.email.toLowerCase() === email.toLowerCase()
  );
  if (!volunteer) return null;

  // Try SF password hash first (persistent, supports password changes)
  if (process.env.SF_LIVE === "true") {
    try {
      const { sfQuery } = await import("@/lib/salesforce");
      const contacts = await sfQuery(
        `SELECT App_Password_Hash__c FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`
      );
      if (contacts.length > 0 && contacts[0].App_Password_Hash__c) {
        const match = await bcrypt.compare(password, contacts[0].App_Password_Hash__c);
        if (match) {
          const { passwordHash, ...safeVolunteer } = volunteer;
          return safeVolunteer;
        }
        // SF hash didn't match — don't fall back, it means password was changed
        return null;
      }
    } catch (err) {
      console.warn("SF auth check failed, falling back to local:", err.message);
    }
  }

  // Fallback to local hash (initial setup or SF offline)
  if (!volunteer.passwordHash) return null;
  const match = await bcrypt.compare(password, volunteer.passwordHash);
  if (!match) return null;

  const { passwordHash, ...safeVolunteer } = volunteer;
  return safeVolunteer;
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
