"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client"
import { getOrCreateDeviceId } from "@/lib/device"

type Device = { id: string; session_code: string; device_id: string; last_seen: string; is_host?: boolean | null }

export default function DevicesPanel({ code }: { code: string }) {
  const supabase = getSupabaseBrowserWithCode(code)
  const [devices, setDevices] = useState<Device[]>([])
  const [selfId, setSelfId] = useState<string>("")
  const isHost = typeof window !== "undefined" && localStorage.getItem(`pp-host-${code}`) === "1"

  useEffect(() => {
    setSelfId(getOrCreateDeviceId())
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from("devices")
        .select("*")
        .eq("session_code", code)
        .order("last_seen", { ascending: false })
      if (active && data) setDevices(data as Device[])
    })()
    const ch = supabase
      .channel(`devices-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices", filter: `session_code=eq.${code}` },
        () => {
          // refresh list on any change
          supabase
            .from("devices")
            .select("*")
            .eq("session_code", code)
            .order("last_seen", { ascending: false })
            .then(({ data }) => {
              if (data) setDevices(data as Device[])
            })
        },
      )
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(ch)
    }
  }, [supabase, code])

  const kick = async (deviceId: string) => {
    if (!supabase) return
    await supabase.from("devices").delete().eq("session_code", code).eq("device_id", deviceId)
  }

  if (!supabase) return null

  return (
    <div className="mt-3 rounded-lg border bg-card p-3">
      <div className="text-sm font-semibold mb-2">Devices</div>
      <ul className="flex flex-col gap-2">
        {devices.map((d) => (
          <li key={d.id} className="flex items-center justify-between text-sm">
            <span className="truncate">
              {d.device_id}
              {d.device_id === selfId ? " (you)" : ""}
              {d.is_host ? " • host" : ""}
            </span>
            {isHost && d.device_id !== selfId ? (
              <Button size="sm" variant="destructive" onClick={() => kick(d.device_id)}>
                Kick
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">{new Date(d.last_seen).toLocaleTimeString()}</span>
            )}
          </li>
        ))}
        {devices.length === 0 ? <li className="text-muted-foreground text-sm">No devices yet.</li> : null}
      </ul>
    </div>
  )
}
