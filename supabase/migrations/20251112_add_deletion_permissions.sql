-- Add deletion permission controls
-- This migration adds support for item deletion with host control

-- Add can_delete_items column to devices table
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS can_delete_items boolean DEFAULT true;

-- Add allow_item_deletion column to sessions table to let host control this feature
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS allow_item_deletion boolean DEFAULT true;

-- Comment on columns
COMMENT ON COLUMN public.devices.can_delete_items IS 'Whether this device can delete items from history';
COMMENT ON COLUMN public.sessions.allow_item_deletion IS 'Whether the host allows devices to delete items from history';
