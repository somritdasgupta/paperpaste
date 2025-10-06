"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

export function getOrCreateDeviceId(): string {
  const key = "pp-device-id"
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

export function heartbeat(supabase: SupabaseClient, code: string, deviceId: string) {
  // update last_seen every 30s; if kicked (row deleted), redirect home
  const update = async () => {
    try {
      await supabase
        .from("devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("session_code", code)
        .eq("device_id", deviceId)
    } catch {}
  }
  update()
  const iv = setInterval(update, 30_000)

  const ch = supabase
    .channel(`kicked-${code}-${deviceId}`)
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "devices", filter: `session_code=eq.${code}` },
      (payload) => {
        if ((payload.old as any)?.device_id === deviceId) {
          alert("You have been removed from this session.")
          window.location.href = "/"
        }
      },
    )
    .subscribe()

  return () => {
    clearInterval(iv)
    supabase.removeChannel(ch)
  }
}
