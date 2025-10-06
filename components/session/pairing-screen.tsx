"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client"
import { getOrCreateDeviceId, heartbeat } from "@/lib/device"
import { useRouter } from "next/navigation"

export default function PairingScreen({ code, isNew }: { code: string; isNew: boolean }) {
  const supabase = getSupabaseBrowserWithCode(code)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deviceIdRef = useRef<string | null>(null)

  const invite = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}/session/${code}`
  }, [code])

  // Create session for host if new, and flag host locally
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      try {
        deviceIdRef.current = getOrCreateDeviceId()
        if (isNew) {
          localStorage.setItem(`pp-host-${code}`, "1")
          // upsert session row if not exists
          await supabase.from("sessions").upsert({ code }).select().single()
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to initialize session.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, code, isNew])

  const getIn = async () => {
    if (!supabase) {
      alert("Supabase not configured. Add environment variables first.")
      return
    }
    try {
      setBusy(true)
      const deviceId = deviceIdRef.current || getOrCreateDeviceId()
      const isHost = localStorage.getItem(`pp-host-${code}`) === "1"
      // register device presence (idempotent)
      await supabase
        .from("devices")
        .upsert({ session_code: code, device_id: deviceId, is_host: isHost as any })
        .select()
        .single()
      // start heartbeat
      heartbeat(supabase, code, deviceId)
      // enter session view
      router.replace(`/session/${code}?join=1`)
    } catch (e: any) {
      setError(e?.message || "Failed to join session.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="w-full px-6 py-10">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border bg-card p-6 md:p-10 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold">Join Session {code}</h1>
        <p className="mt-2 text-muted-foreground">Pair this device to sync clipboard data in real-time.</p>

        <div className="mt-6 flex flex-col items-center gap-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(invite)}`}
            alt="Session QR"
            width={160}
            height={160}
            className="rounded border"
          />
          <p className="text-xs text-muted-foreground break-all">{invite}</p>
        </div>

        <div className="mt-8">
          <Button size="lg" onClick={getIn} disabled={busy}>
            {busy ? "Getting in…" : "Get in"}
          </Button>
        </div>

        {error ? <div className="mt-4 text-sm text-destructive">{error}</div> : null}
      </div>
    </main>
  )
}
