import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Database } from './types.js';

/**
 * Creates an anon-key Supabase client for use in the Toolbox frontend
 * and Edge Functions acting on behalf of an authenticated user.
 * Reads SUPABASE_URL and SUPABASE_ANON_KEY from the environment.
 */
export function createClient(): SupabaseClient<Database> {
  const url = getEnvVar('SUPABASE_URL');
  const key = getEnvVar('SUPABASE_ANON_KEY');
  return createSupabaseClient<Database>(url, key);
}

/**
 * Creates a service-role Supabase client for Edge Functions that need to
 * bypass Row Level Security (e.g. Gmail webhook, scheduled jobs).
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
 *
 * WARNING: Never expose the service role client to the browser.
 */
export function createServiceClient(): SupabaseClient<Database> {
  const url = getEnvVar('SUPABASE_URL');
  const key = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getEnvVar(name: string): string {
  const value = process.env[name] ?? (typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Deno global declaration for Edge Function compatibility
declare const Deno: { env: { get(key: string): string | undefined } };
