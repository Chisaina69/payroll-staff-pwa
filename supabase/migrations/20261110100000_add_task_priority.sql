ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass
      AND conname = 'tasks_priority_check'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END
$$;
