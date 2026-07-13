
CREATE TABLE public.process_weekly_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL,
  role_process_id uuid NOT NULL REFERENCES public.role_processes(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, role_process_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_weekly_evaluations TO authenticated;
GRANT ALL ON public.process_weekly_evaluations TO service_role;

ALTER TABLE public.process_weekly_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pwe_read ON public.process_weekly_evaluations
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), org_id) AND (
      is_self_emp(auth.uid(), employee_id)
      OR is_manager_of_emp(auth.uid(), employee_id)
      OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role, 'rh'::org_role])
    )
  );

CREATE POLICY pwe_insert ON public.process_weekly_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid() AND (
      is_manager_of_emp(auth.uid(), employee_id)
      OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role, 'rh'::org_role])
    )
  );

CREATE POLICY pwe_update ON public.process_weekly_evaluations
  FOR UPDATE TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role, 'rh'::org_role])
  );

CREATE POLICY pwe_delete ON public.process_weekly_evaluations
  FOR DELETE TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role, 'rh'::org_role]));

CREATE TRIGGER pwe_updated_at BEFORE UPDATE ON public.process_weekly_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX pwe_emp_week_idx ON public.process_weekly_evaluations(employee_id, week_start);
