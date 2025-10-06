import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file") as File | null
  const code = String(form.get("code") || "")
  if (!file || !code) return NextResponse.json({ error: "Missing file or code" }, { status: 400 })

  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  try {
    const path = `${code}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from("paperpaste").upload(path, file, { upsert: false })
    if (error) throw error
    return NextResponse.json({ path })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 })
  }
}
