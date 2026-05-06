/**
 * Family contact relationship helpers.
 *
 * `contacts_legacy.relationship` is a TEXT[] (e.g. ["Surviving Family", "Purchaser"]).
 * Anniversary remembrance emails must only be drafted to surviving / extended family —
 * never to bracelet purchasers or organization contacts.
 */

const FAMILY_ROLES = new Set(["surviving family", "extended family"]);

export function isFamilyRelationship(relationships) {
  if (!Array.isArray(relationships)) return false;
  return relationships.some((r) =>
    FAMILY_ROLES.has(String(r || "").trim().toLowerCase())
  );
}

export function describeRelationship(relationships) {
  if (!Array.isArray(relationships) || relationships.length === 0) return "none";
  return relationships.join(", ");
}
