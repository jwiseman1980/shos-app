import { cookies } from "next/headers";
import crypto from "crypto";

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

export function createSession() {
  const token = Date.now().toString(36) + "-" + crypto.randomBytes(16).toString("hex");
  return sign(token);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return false;
  return verify(session.value) !== null;
}

export function checkPassword(password) {
  return password === process.env.LOGIN_PASSWORD;
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
