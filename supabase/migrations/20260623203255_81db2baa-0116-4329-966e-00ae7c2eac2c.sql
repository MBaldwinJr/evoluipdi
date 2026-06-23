
CREATE TABLE public.onboarding_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('document','integration','training')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  due_date date,
  order_index integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_tasks_employee ON public.onboarding_tasks(employee_id);
CREATE INDEX idx_onboarding_tasks_org ON public.onboarding_tasks(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_tasks_select" ON public.onboarding_tasks
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), org_id)
    AND (
      public.has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role,'gestor'::org_role])
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
    )
  );

CREATE POLICY "onboarding_tasks_insert" ON public.onboarding_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  );

CREATE POLICY "onboarding_tasks_update" ON public.onboarding_tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
  );

CREATE POLICY "onboarding_tasks_delete" ON public.onboarding_tasks
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  );

CREATE TRIGGER trg_onboarding_tasks_updated_at
  BEFORE UPDATE ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
