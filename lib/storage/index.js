/**
 * SHOS Storage Adapter
 *
 * Abstracts knowledge file and friction log persistence behind a simple interface.
 * Always uses Supabase (shos_knowledge, shos_friction tables).
 *
 * The Operator calls these functions — never reads/writes files directly.
 */

import * as supabase from "./supabase.js";

/**
 * Read a role's knowledge file content.
 * @param {string} role — operator (primary), or legacy domains: cos, cfo, coo, comms, dev, family, ed
 * @returns {Promise<string>} markdown content
 */
export async function readKnowledge(role) {
  return supabase.readKnowledge(role);
}

/**
 * Write (overwrite) a role's knowledge file content.
 * @param {string} role
 * @param {string} content — full markdown content
 */
export async function writeKnowledge(role, content) {
  return supabase.writeKnowledge(role, content);
}

/**
 * Append a friction item to the friction log.
 * @param {string} role — which role logged it
 * @param {string} type — bug | missing | improvement | idea
 * @param {string} priority — high | medium | low
 * @param {string} description
 */
export async function logFriction(role, type, priority, description) {
  return supabase.logFriction(role, type, priority, description);
}

/**
 * Read all open friction items (status = open or triaged).
 * @returns {Promise<Array>}
 */
export async function readFriction(statusFilter = null) {
  return supabase.readFriction(statusFilter);
}
