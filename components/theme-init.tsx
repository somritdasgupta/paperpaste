"use client"

import { useEffect } from "react"

export default function ThemeInit() {
  useEffect(() => {
    try {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      const stored = localStorage.getItem("pp-dark")
      const isDark = stored ? stored === "1" : prefersDark
      document.documentElement.classList.toggle("dark", isDark)
    } catch {}
  }, [])
  return null
}
