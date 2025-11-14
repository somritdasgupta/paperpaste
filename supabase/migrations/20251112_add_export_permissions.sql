-- Add export permissions to sessions and devices tables
-- This allows granular control over who can export session history

DO $$ 
BEGIN
  -- Add export_enabled column to sessions table (global export control)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'export_enabled' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.sessions ADD COLUMN export_enabled boolean DEFAULT true;
  END IF;

  -- Add can_export column to devices table (per-device export control)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'can_export' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN can_export boolean DEFAULT true;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_export_enabled ON public.sessions(export_enabled);
CREATE INDEX IF NOT EXISTS idx_devices_can_export ON public.devices(can_export);
