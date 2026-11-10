BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.password_reset_requests FROM anon, authenticated;
GRANT SELECT ON public.password_reset_requests TO authenticated;
GRANT UPDATE (read_at) ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;

DROP POLICY IF EXISTS "Admins read password reset requests"
  ON public.password_reset_requests;
CREATE POLICY "Admins read password reset requests"
  ON public.password_reset_requests
  FOR SELECT
  TO authenticated
  USING ((SELECT private.current_role()) = 'admin'::app_role);

DROP POLICY IF EXISTS "Admins mark password reset requests read"
  ON public.password_reset_requests;
CREATE POLICY "Admins mark password reset requests read"
  ON public.password_reset_requests
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.current_role()) = 'admin'::app_role)
  WITH CHECK ((SELECT private.current_role()) = 'admin'::app_role);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'password_reset_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.password_reset_requests;
  END IF;
END
$$;

INSERT INTO public.password_reset_requests (id, employee_id, created_at, read_at)
SELECT id, employee_id, created_at, read_at
FROM public.notifications
WHERE title = 'Password reset requested'
  AND type = 'system'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.notifications
WHERE title = 'Password reset requested'
  AND type = 'system';

COMMIT;
