-- Join requests table for kicked users requesting to rejoin
CREATE TABLE IF NOT EXISTS join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  device_id text NOT NULL,
  device_name_encrypted text,
  status text DEFAULT 'pending', -- pending, approved, rejected
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_code, device_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_join_requests_session ON join_requests(session_code, status);
