/**
 * Supabase client for Edge runtime (middleware)
 * Uses service role to read site_settings (table may have restrictive RLS)
 */
import { createClient } from "@supabase/supabase-js"

export function createEdgeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return null
  }
  return createClient(url, key)
}
