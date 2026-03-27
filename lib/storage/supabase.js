/**
 * Supabase Storage Adapter
 *
 * Used for HonorBase client deployments that don't have Salesforce.
 * Required tables (run in Supabase SQL editor):
 *
 *   CREATE TABLE shos_knowledge (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     role text NOT NULL UNIQUE,
 *     content text,
 *     last_updated timestamptz DEFAULT now(),
 *     session_count integer DEFAULT 0
 *   );
 *
 *   CREATE TABLE shos_friction (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     role text NOT NULL,
 *     type text NOT NULL,
 *     priority text NOT NULL,
 *     description text,
 *     status text DEFAULT 'open',
 *     logged_date date DEFAULT now()
 *   );
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY  (service role key — not anon key)
 */

// TODO: implement when first HonorBase client onboards
// import { createClient } from "@supabase/supabase-js";

export async function readKnowledge(role) {
  throw new Error("Supabase adapter not yet implemented.");
}

export async function writeKnowledge(role, content) {
  throw new Error("Supabase adapter not yet implemented.");
}

export async function logFriction(role, type, priority, description) {
  throw new Error("Supabase adapter not yet implemented.");
}

export async function readFriction(statusFilter = null) {
  throw new Error("Supabase adapter not yet implemented.");
}
