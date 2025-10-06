"use client"

import { useEffect, useMemo, useState } from "react"
import { getSupabaseBrowserWithCode } from "@/lib/supabase/client"

type Item = {
  id: string
  session_code: string
  kind: "text" | "code" | "file"
  content: string | null
  file_url: string | null
  created_at: string
}

export default function ItemsList({ code }: { code: string }) {
  const supabase = getSupabaseBrowserWithCode(code)
  const [items, setItems] = useState<Item[]>([])
  const publicUrlFor = useMemo(() => {
    return (pathOrUrl: string) => {
      // If it's already a full URL, return as-is; else assume storage object path
      if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      return url ? `${url}/storage/v1/object/public/paperpaste/${pathOrUrl}` : "#"
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("session_code", code)
        .order("created_at", { ascending: false })
        .limit(200)
      if (!active) return
      if (!error && data) setItems(data as Item[])
    })()

    const itemsChannel = supabase
      .channel(`items-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `session_code=eq.${code}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Item, ...prev]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((it) => (it.id === (payload.new as any).id ? (payload.new as Item) : it))
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((it) => it.id !== (payload.old as any).id)
            }
            return prev
          })
        },
      )
      .subscribe()

    const sessionChannel = supabase
      .channel(`sessions-${code}`)
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "sessions", filter: `code=eq.${code}` },
        () => {
          alert("Session has expired or was cleaned up.")
          window.location.href = "/"
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(sessionChannel)
    }
  }, [supabase, code])

  if (!supabase) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Supabase not configured. Add environment variables to start syncing.
      </div>
    )
  }

  return (
    <div className="w-full">
      {items.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">No items yet. Paste text, code, or upload a file.</div>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.id} className="p-4">
              <div className="text-xs text-muted-foreground">{new Date(it.created_at).toLocaleString()}</div>
              {it.kind === "file" && it.file_url ? (
                <a
                  href={publicUrlFor(it.file_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline break-all"
                >
                  Open file
                </a>
              ) : (
                <pre className="mt-1 whitespace-pre-wrap text-sm">{it.content}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
