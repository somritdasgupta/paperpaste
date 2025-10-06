"use client"
import JoinForm from "@/components/session/join-form"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { QRScanner } from "@/components/qr-scanner"

function EnvBanner() {
  const hasPublicUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const ready = hasPublicUrl && hasAnon

  if (ready) return null
  return (
    <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-50 text-yellow-900 p-4 dark:bg-yellow-900/20 dark:text-yellow-100">
      <p className="font-semibold">Supabase setup needed</p>
      <ul className="list-disc ml-5 text-sm mt-2">
        <li>
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Project Settings → Environment Variables.
        </li>
        <li>Then run the SQL script in scripts/sql to create tables and the storage bucket.</li>
      </ul>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [scanOpen, setScanOpen] = useState(false)

  const handleQrDetected = (text: string) => {
    try {
      setScanOpen(false)
      // find 7-digit code in URL or plain text
      const m = text.match(/(\d{7})/)
      if (m) {
        router.push(`/session/${m[1]}`)
        return
      }
      // if it's a full URL, navigate to it
      if (text.startsWith("http")) {
        try {
          const url = new URL(text)
          // prefer app-relative if it contains /session/<code>
          const pathMatch = url.pathname.match(/\/session\/(\d{7})/)
          if (pathMatch) {
            router.push(`/session/${pathMatch[1]}`)
          } else {
            window.location.href = text
          }
        } catch {
          window.location.href = text
        }
      }
    } catch (e) {
      // swallow errors and just close
    }
  }

  return (
    <main className="w-full">
      <section className="w-full px-6 pt-10 pb-6 border-b bg-background">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-balance text-4xl md:text-5xl font-extrabold tracking-tight">PaperPaste</h1>
          <p className="mt-2 text-pretty text-base md:text-lg text-muted-foreground">
            Bold, fast, symmetric clipboard sync—across your devices in real-time.
          </p>
        </div>
      </section>

      <section className="w-full px-6 py-8">
        <div className="mx-auto w-full max-w-5xl">
          <EnvBanner />
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4">Start or Join a Session</h2>
            <JoinForm />
            <div className="mt-4 text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2">
              <span>Or</span>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setScanOpen(true)}>
                Scan QR to Join
              </Button>
            </div>
          </div>
        </div>
      </section>

      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleQrDetected} />
    </main>
  )
}
