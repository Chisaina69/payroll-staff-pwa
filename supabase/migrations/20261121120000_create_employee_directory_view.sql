BEGIN;

CREATE OR REPLACE VIEW public.employee_directory
WITH (security_barrier = true)
AS
SELECT
  id,
  first_name,
  last_name,
  department,
  position
FROM public.employees
WHERE status = 'active';

REVOKE ALL ON public.employee_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employee_directory TO authenticated;

COMMIT;
