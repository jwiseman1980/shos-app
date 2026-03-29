/**
 * SHOS Storage Adapter
 *
 * Abstracts knowledge file and friction log persistence behind a simple interface.
 * STORAGE_BACKEND env var controls which implementation is used:
 *   - "salesforce" → Steel Hearts (SHOS_Knowledge__c, SHOS_Friction__c)
 *   - "supabase"   → HonorBase clients (shos_knowledge, shos_friction tables)
 *
 * All agent code calls these functions — never reads/writes files directly.
 */

import * as sf from "./salesforce.js";
import * as supabase from "./supabase.js";

function getAdapter() {
  const raw = process.env.STORAGE_BACKEND || "salesforce";
  const backend = raw.trim().replace(/['"]/g, "").toLowerCase();
  switch (backend) {
    case "salesforce": return sf;
    case "supabase": return supabase;
    default:
      throw new Error(`Unknown STORAGE_BACKEND: "${raw}" (parsed: "${backend}")`);
  }
}

/**
 * Read a role's knowledge file content.
 * @param {string} role — cos, cfo, coo, comms, dev, family, ed
 * @returns {Promise<string>} markdown content
 */
export async function readKnowledge(role) {
  return getAdapter().readKnowledge(role);
}

/**
 * Write (overwrite) a role's knowledge file content.
 * @param {string} role
 * @param {string} content — full markdown content
 */
export async function writeKnowledge(role, content) {
  return getAdapter().writeKnowledge(role, content);
}

/**
 * Append a friction item to the friction log.
 * @param {string} role — which role logged it
 * @param {string} type — bug | missing | improvement | idea
 * @param {string} priority — high | medium | low
 * @param {string} description
 */
export async function logFriction(role, type, priority, description) {
  return getAdapter().logFriction(role, type, priority, description);
}

/**
 * Read all open friction items (status = open or triaged).
 * @returns {Promise<Array>}
 */
export async function readFriction(statusFilter = null) {
  return getAdapter().readFriction(statusFilter);
}
