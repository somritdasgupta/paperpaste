"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import DevicesPanel from "./devices-panel"

export default function SessionHeader({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const [dark, setDark] = useState<boolean | null>(null)
  const [showDevices, setShowDevices] = useState(false)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    const stored = localStorage.getItem("pp-dark")
    const isDark = stored ? stored === "1" : prefersDark
    document.documentElement.classList.toggle("dark", isDark)
    setDark(isDark)
  }, [])

  const invite = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}/session/${code}`
  }, [code])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  const toggleDark = () => {
    if (dark === null) return
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("pp-dark", next ? "1" : "0")
    setDark(next)
  }

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">Session {code}</h1>
        <p className="text-sm text-muted-foreground">Share this link or QR to join from another device.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied!" : "Copy Invite"}
        </Button>
        <Button variant="secondary" onClick={() => setShowQR((s) => !s)}>
          {showQR ? "Hide QR" : "Show QR"}
        </Button>
        <Button variant="secondary" onClick={() => setShowDevices((s) => !s)}>
          {showDevices ? "Hide Devices" : "Devices"}
        </Button>
        <Button variant="default" onClick={toggleDark}>
          {dark ? "Light Mode" : "Dark Mode"}
        </Button>
      </div>
      {showQR ? (
        <div className="mt-2 md:mt-0">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(invite)}`}
            alt="Session QR"
            width={160}
            height={160}
            className="rounded border"
          />
        </div>
      ) : null}
      {showDevices ? <DevicesPanel code={code} /> : null}
    </header>
  )
}
