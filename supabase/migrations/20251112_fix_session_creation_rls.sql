-- Fix RLS policy for session creation
-- The issue: WITH CHECK prevents INSERT when session doesn't exist yet
-- Solution: Allow INSERT when the code matches the header, SELECT/UPDATE/DELETE when session exists

DROP POLICY IF EXISTS "sessions by header" ON public.sessions;

-- Separate policies for different operations
CREATE POLICY "sessions insert by header"
ON public.sessions
FOR INSERT
TO anon
WITH CHECK (code = public.header('x-paperpaste-session'));

CREATE POLICY "sessions select by header"
ON public.sessions
FOR SELECT
TO anon
USING (code = public.header('x-paperpaste-session'));

CREATE POLICY "sessions update by header"
ON public.sessions
FOR UPDATE
TO anon
USING (code = public.header('x-paperpaste-session'))
WITH CHECK (code = public.header('x-paperpaste-session'));

CREATE POLICY "sessions delete by header"
ON public.sessions
FOR DELETE
TO anon
USING (code = public.header('x-paperpaste-session'));
