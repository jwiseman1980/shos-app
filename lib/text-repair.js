/**
 * Mojibake repair utility — fixes double-encoded UTF-8 text.
 * Implements FM-STD-004 text normalization for supporter messages.
 *
 * Common pattern: UTF-8 bytes were interpreted as Latin-1 (Windows-1252),
 * then re-encoded as UTF-8. This produces sequences like:
 *   Ã¢â‚¬â„¢ → ' (right single quote / apostrophe)
 *   Ã¢â‚¬Å" → " (left double quote)
 */

/**
 * Attempt to repair mojibake in a text string.
 * Tries Latin-1 → UTF-8 re-decode first, falls back to pattern replacement.
 */
export function repairMojibake(text) {
  if (!text) return text;

  // Quick check: does this text even have mojibake?
  if (!text.includes("\u00C3") && !text.includes("\u00C2") && !text.includes("\u00E2")) {
    return text;
  }

  // Method 1: Try Latin-1 → UTF-8 re-decode (handles most double-encoding)
  try {
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0)));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Verify the decode actually improved things
    if (decoded !== text && !decoded.includes("\u00C3") && decoded.length <= text.length) {
      return cleanArtifacts(decoded);
    }
  } catch (e) {
    // Not simple double-encoding — fall through to manual replacements
  }

  // Method 2: Manual pattern replacements for common mojibake sequences
  let t = text;

  // Right single quote / apostrophe (most common: I'll, don't, you're, etc.)
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u201E\u00A2/g, "\u2019");

  // Left double quote
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u0153/g, "\u201C");

  // Right double quote
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u009D/g, "\u201D");
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00C2\u009D/g, "\u201D");

  // En dash
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u20AC\u0153/g, "\u2013");

  // Em dash
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u201D/g, "\u2014");

  // Ellipsis
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00A6/g, "\u2026");

  // Accented characters (common in Spanish/French names)
  t = t.replace(/\u00C3\u00A9/g, "\u00E9"); // é
  t = t.replace(/\u00C3\u00A8/g, "\u00E8"); // è
  t = t.replace(/\u00C3\u00B1/g, "\u00F1"); // ñ
  t = t.replace(/\u00C3\u00A1/g, "\u00E1"); // á
  t = t.replace(/\u00C3\u00B3/g, "\u00F3"); // ó
  t = t.replace(/\u00C3\u00AD/g, "\u00ED"); // í
  t = t.replace(/\u00C3\u00BA/g, "\u00FA"); // ú
  t = t.replace(/\u00C3\u00BC/g, "\u00FC"); // ü

  // Stray Â artifact (very common: "Â " before punctuation or at boundaries)
  t = t.replace(/\u00C2\u00A0/g, " "); // non-breaking space
  t = t.replace(/\u00C2(?=[\s.,!?;:\-)\]}>]|$)/g, "");
  t = t.replace(/(?<=^|[\s({\[<])\u00C2/g, "");

  return cleanArtifacts(t);
}

/**
 * Clean remaining text artifacts per FM-STD-004.
 */
function cleanArtifacts(text) {
  let t = text;

  // Strip [nan] artifacts
  t = t.replace(/\[nan\]/gi, "");

  // Collapse multiple spaces
  t = t.replace(/  +/g, " ");

  // Trim
  t = t.trim();

  return t;
}

/**
 * Check if a message contains mojibake that needs repair.
 */
export function hasMojibake(text) {
  if (!text) return false;
  return (
    text.includes("\u00C3\u00A2") ||
    text.includes("\u00C2\u00A0") ||
    (text.includes("\u00C3") && /\u00C3[\u00A0-\u00BF]/.test(text)) ||
    text.includes("[nan]")
  );
}
