import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let serverClient: SupabaseClient | null = null

export function getSupabaseServer(): SupabaseClient | null {
  // Only safe to use anon key server-side if RLS is configured appropriately.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  if (!serverClient) {
    serverClient = createServerClient(url, anon, { cookies })
  }
  return serverClient
}
