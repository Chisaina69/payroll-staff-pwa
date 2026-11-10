BEGIN;

CREATE OR REPLACE FUNCTION public.notify_staff_of_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (employee_id, title, message, type)
  VALUES (
    NEW.employee_id,
    'New task assigned',
    pg_catalog.format(
      'A task "%s" has been assigned to you. Due date: %s. Priority: %s.',
      NEW.title,
      NEW.due_date,
      pg_catalog.initcap(COALESCE(NEW.priority, 'medium'))
    ),
    'system'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_staff_of_new_payslip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (employee_id, title, message, type)
  VALUES (
    NEW.employee_id,
    'New payslip available',
    pg_catalog.format(
      'Your payslip for %s is now available in your dashboard.',
      pg_catalog.to_char(NEW.pay_period_start, 'FMMonth YYYY')
    ),
    'system'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_staff_of_task_assignment()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_staff_of_new_payslip()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_staff_of_task_assignment
  ON public.tasks;
CREATE TRIGGER notify_staff_of_task_assignment
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_of_task_assignment();

DROP TRIGGER IF EXISTS notify_staff_of_new_payslip
  ON public.payroll_records;
CREATE TRIGGER notify_staff_of_new_payslip
  AFTER INSERT ON public.payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_of_new_payslip();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.notifications;
  END IF;
END
$$;

COMMIT;
