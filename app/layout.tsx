import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

import ThemeInit from "@/components/theme-init"
import { Suspense } from "react"

import { Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans, IBM_Plex_Mono as V0_Font_IBM_Plex_Mono, Lora as V0_Font_Lora } from 'next/font/google'

// Initialize fonts
const _plusJakartaSans = V0_Font_Plus_Jakarta_Sans({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800"] })
const _ibmPlexMono = V0_Font_IBM_Plex_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700"] })
const _lora = V0_Font_Lora({ subsets: ['latin'], weight: ["400","500","600","700"] })

// Load Google fonts so Tailwind tokens map correctly (not directly used in className)

export const metadata: Metadata = {
  title: "PaperPaste",
  description: "Real-time clipboard sync across your devices.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeInit />
        <Suspense fallback={<div>Loading...</div>}>
          <div className="min-h-dvh flex flex-col">
            <div className="flex-1">{children}</div>
            {/* Site footer credits */}
            <footer className="w-full border-t bg-card">
              <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm flex flex-col md:flex-row items-center justify-between gap-2">
                <p className="font-semibold">PaperPaste</p>
                <p className="text-muted-foreground text-center">
                  Built by{" "}
                  <a
                    className="underline font-medium"
                    href="https://github.com/somritdasgupta"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Somrit Dasgupta (@somritdasgupta)
                  </a>
                  . Source:{" "}
                  <a
                    className="underline font-medium"
                    href="https://github.com/somritdasgupta/paperpaste"
                    target="_blank"
                    rel="noreferrer"
                  >
                    github.com/somritdasgupta/paperpaste
                  </a>
                </p>
              </div>
            </footer>
          </div>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
