// Supabase Client — Steel Hearts project
// Server client uses service role key (full access, for API routes)
// Browser client uses anon key (RLS-enforced, for client components)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server client — use in API routes and server components
// Bypasses RLS, full database access
let _serverClient = null;

export function getServerClient() {
  if (_serverClient) return _serverClient;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  _serverClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  return _serverClient;
}

// Browser client — use in client components
// Respects RLS policies
let _browserClient = null;

export function getBrowserClient() {
  if (_browserClient) return _browserClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  _browserClient = createClient(supabaseUrl, supabaseAnonKey);

  return _browserClient;
}

// Convenience: default export is server client (most common use in API routes)
export default getServerClient;
