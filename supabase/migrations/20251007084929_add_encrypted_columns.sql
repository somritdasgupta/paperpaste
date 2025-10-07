-- Add missing encrypted columns to items table
-- This migration ensures all required encrypted columns exist

DO $$ 
BEGIN
  -- Add created_at_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'created_at_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN created_at_encrypted text;
  END IF;

  -- Add updated_at_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'updated_at_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN updated_at_encrypted text;
  END IF;

  -- Add display_id_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'display_id_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN display_id_encrypted text;
  END IF;

  -- Add content_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'content_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN content_encrypted text;
  END IF;

  -- Add file_data_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'file_data_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN file_data_encrypted text;
  END IF;

  -- Add file_name_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'file_name_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN file_name_encrypted text;
  END IF;

  -- Add file_mime_type_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'file_mime_type_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN file_mime_type_encrypted text;
  END IF;

  -- Add file_size_encrypted column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'file_size_encrypted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN file_size_encrypted text;
  END IF;

  -- Add device_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'device_id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN device_id text;
    CREATE INDEX IF NOT EXISTS idx_items_device ON public.items(device_id);
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.items ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
