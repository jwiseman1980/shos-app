/**
 * Shared HMAC-SHA256 utilities using Web Crypto (globalThis.crypto.subtle).
 *
 * Works identically in both Node.js 18+ (API routes) and the Edge runtime
 * (middleware). Using the same implementation in both places guarantees
 * session tokens created by auth.js are accepted by middleware.js.
 */

const encoder = new TextEncoder();

async function computeHmac(secret, value) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign a value: returns "value.HMAC_HEX"
 */
export async function signHmac(secret, value) {
  const hex = await computeHmac(secret, value);
  return `${value}.${hex}`;
}

/**
 * Verify a signed string. Returns the original value if valid, null otherwise.
 */
export async function verifyHmac(secret, signed) {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const providedSig = signed.slice(idx + 1);
  const expectedSig = await computeHmac(secret, value);
  if (expectedSig !== providedSig) return null;
  return value;
}
