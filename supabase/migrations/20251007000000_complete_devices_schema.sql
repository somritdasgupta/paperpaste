-- Add missing columns to devices table
DO $$ 
BEGIN
    -- Add device_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' 
        AND column_name = 'device_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.devices ADD COLUMN device_id text NOT NULL DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
    END IF;

    -- Add device_name_encrypted column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' 
        AND column_name = 'device_name_encrypted'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.devices ADD COLUMN device_name_encrypted text;
    END IF;

    -- Add last_seen column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' 
        AND column_name = 'last_seen'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.devices ADD COLUMN last_seen timestamptz DEFAULT now();
    END IF;

    -- Add is_frozen column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' 
        AND column_name = 'is_frozen'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.devices ADD COLUMN is_frozen boolean DEFAULT false;
    END IF;

    -- Add can_view column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' 
        AND column_name = 'can_view'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.devices ADD COLUMN can_view boolean DEFAULT true;
    END IF;

    -- Add unique constraint on session_code + device_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'devices' 
        AND constraint_name = 'devices_session_device_unique'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.devices ADD CONSTRAINT devices_session_device_unique UNIQUE(session_code, device_id);
    END IF;
END $$;
