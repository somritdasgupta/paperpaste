"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

declare global {
  // eslint-disable-next-line no-var
  var __supabase_browser__: SupabaseClient | undefined
  // eslint-disable-next-line no-var
  var __supabase_browser_by_code__: Record<string, SupabaseClient> | undefined
}

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Env not ready yet; return null so UI can show onboarding
    return null
  }
  if (!globalThis.__supabase_browser__) {
    globalThis.__supabase_browser__ = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  }
  return globalThis.__supabase_browser__!
}

// Optional helper: embed a session code as a header for future RLS-by-header strategy
export function getSupabaseBrowserWithCode(code: string): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null
  if (!globalThis.__supabase_browser_by_code__) globalThis.__supabase_browser_by_code__ = {}
  if (!globalThis.__supabase_browser_by_code__[code]) {
    globalThis.__supabase_browser_by_code__[code] = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            "x-paperpaste-session": code,
          },
        },
      },
    )
  }
  return globalThis.__supabase_browser_by_code__[code]
}
