import { NextResponse } from "next/server"
import { Client } from "pg"

const schemaSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sessions (
  code text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_session_code ON public.devices(session_code);

CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  content text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_session_code_created_at ON public.items(session_code, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_updated_at ON public.items;
CREATE TRIGGER trg_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.touch_session_activity()
RETURNS trigger AS $$
BEGIN
  UPDATE public.sessions SET last_activity_at = now() WHERE code = NEW.session_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_touch_session ON public.items;
CREATE TRIGGER trg_items_touch_session
AFTER INSERT OR UPDATE OR DELETE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.touch_session_activity();
`

export async function POST() {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL

  if (!url) {
    return NextResponse.json({ ok: false, error: "Missing POSTGRES_URL" }, { status: 500 })
  }

  const client = new Client({ connectionString: url })
  try {
    await client.connect()
    await client.query("BEGIN")
    await client.query(schemaSql)
    await client.query("COMMIT")
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    try {
      await client.query("ROLLBACK")
    } catch {}
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 })
  } finally {
    await client.end()
  }
}
