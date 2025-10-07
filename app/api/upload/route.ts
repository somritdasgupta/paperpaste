import { type NextRequest, NextResponse } from "next/server"

// DEPRECATED: This endpoint is no longer used since we now encrypt files 
// client-side and store them directly in the database for zero-knowledge architecture.
// Files are encrypted with AES-256-GCM before storage.

export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    error: "This endpoint is deprecated. Files are now encrypted client-side and stored directly in the database." 
  }, { status: 410 })
}
