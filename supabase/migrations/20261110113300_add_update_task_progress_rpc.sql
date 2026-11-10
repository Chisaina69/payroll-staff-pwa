CREATE OR REPLACE FUNCTION public.update_task_progress(
  p_task_id uuid,
  p_status public.task_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF (SELECT private.current_role()) IS DISTINCT FROM 'staff'::public.app_role THEN
    RAISE EXCEPTION 'Only staff can update task progress'
      USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL
    OR p_status NOT IN (
      'in_progress'::public.task_status,
      'completed'::public.task_status
    )
  THEN
    RAISE EXCEPTION 'Invalid task progress status'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.tasks
  SET
    status = p_status,
    completed_at = CASE
      WHEN p_status = 'completed'::public.task_status THEN now()
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_task_id
    AND employee_id = (SELECT private.current_employee_id())
    AND (
      (p_status = 'in_progress'::public.task_status
        AND status = 'pending'::public.task_status)
      OR
      (p_status = 'completed'::public.task_status
        AND status IN (
          'pending'::public.task_status,
          'in_progress'::public.task_status
        ))
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'Task is unavailable or cannot transition from its current status'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_task_progress(uuid, public.task_status)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_task_progress(uuid, public.task_status)
  TO authenticated;
