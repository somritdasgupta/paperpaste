-- Add deletion permission controls
-- This migration adds support for item deletion with host control

-- Add allow_item_deletion column to sessions table to let host control this feature
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS allow_item_deletion boolean DEFAULT true;

-- Comment on column
COMMENT ON COLUMN public.sessions.allow_item_deletion IS 'Whether the host allows users to delete items from history';
