"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client"

type ItemType = "text" | "code" | "file"

export default function ClipboardInput({ code }: { code: string }) {
  const [type, setType] = useState<ItemType>("text")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const supabase = getSupabaseBrowserWithCode(code)

  const doInsert = async (payload: any) => {
    // first try
    const { error } = await supabase.from("items").insert(payload)
    if (!error) return { error: null }

    const msg = String(error?.message || "")
    const code = (error as any)?.code
    const isMissingTable =
      code === "42P01" ||
      (msg.includes("relation") && msg.includes("does not exist")) ||
      msg.includes("Could not find the table 'public.items'")

    if (isMissingTable) {
      console.log("[v0] items missing - initializing schema then retrying")
      const res = await fetch("/api/schema/init", { method: "POST" })
      if (res.ok) {
        const retry = await supabase.from("items").insert(payload)
        return { error: retry.error || null }
      }
    }
    return { error }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      alert("Supabase not configured. Add environment variables first.")
      return
    }
    try {
      setBusy(true)
      let payload: any = { session_code: code, kind: type }
      if (type === "file") {
        if (!file) return
        const form = new FormData()
        form.append("file", file)
        form.append("code", code)
        const res = await fetch("/api/upload", { method: "POST", body: form })
        if (!res.ok) throw new Error("Upload failed")
        const data = await res.json()
        payload = { ...payload, file_url: data.path }
      } else {
        payload = { ...payload, content: text }
      }
      const { error } = await doInsert(payload)
      if (error) throw error
      try {
        await supabase.rpc("cleanup_inactive_sessions")
      } catch {}
      setText("")
      setFile(null)
    } catch (err) {
      console.error("[v0] submit error:", err)
      alert(
        "Failed to add item. The app attempted to auto-initialize the database. If this persists, run the SQL in scripts/ to set up tables.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant={type === "text" ? "default" : "secondary"} onClick={() => setType("text")}>
          Text
        </Button>
        <Button type="button" variant={type === "code" ? "default" : "secondary"} onClick={() => setType("code")}>
          Code
        </Button>
        <Button type="button" variant={type === "file" ? "default" : "secondary"} onClick={() => setType("file")}>
          File
        </Button>
      </div>

      {type === "file" ? (
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      ) : (
        <Textarea
          placeholder={type === "code" ? "Paste code…" : "Paste text…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-28"
        />
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add to Session"}
        </Button>
      </div>
    </form>
  )
}
