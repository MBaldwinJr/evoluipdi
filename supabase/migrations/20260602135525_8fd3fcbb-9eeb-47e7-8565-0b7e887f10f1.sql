
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS registration text,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS schedule_id uuid,
  ADD COLUMN IF NOT EXISTS weekly_hours numeric DEFAULT 44,
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'CLT',
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS legacy_pt_employee_id uuid;

UPDATE public.employees e
SET cpf = COALESCE(e.cpf, p.cpf),
    registration = COALESCE(e.registration, p.registration),
    branch_id = COALESCE(e.branch_id, p.branch_id),
    schedule_id = COALESCE(e.schedule_id, p.schedule_id),
    weekly_hours = COALESCE(e.weekly_hours, p.weekly_hours, 44),
    contract_type = COALESCE(e.contract_type, p.contract_type, 'CLT'),
    full_name = COALESCE(e.full_name, p.full_name),
    legacy_pt_employee_id = p.id,
    hire_date = COALESCE(e.hire_date, p.hire_date)
FROM public.pt_employees p
WHERE p.user_id IS NOT NULL
  AND p.user_id = e.user_id
  AND p.company_id = e.org_id;

INSERT INTO public.employees (org_id, user_id, full_name, cpf, registration, branch_id, schedule_id, weekly_hours, contract_type, hire_date, manager_id, active, legacy_pt_employee_id)
SELECT p.company_id, p.user_id, p.full_name, p.cpf, p.registration, p.branch_id, p.schedule_id,
       COALESCE(p.weekly_hours, 44), COALESCE(p.contract_type, 'CLT'), p.hire_date,
       NULL, p.active, p.id
FROM public.pt_employees p
WHERE NOT EXISTS (
  SELECT 1 FROM public.employees e
  WHERE e.org_id = p.company_id
    AND (
      (p.user_id IS NOT NULL AND e.user_id = p.user_id)
      OR e.legacy_pt_employee_id = p.id
    )
);

UPDATE public.pt_punches pu
SET employee_id = e.id
FROM public.employees e
WHERE e.legacy_pt_employee_id = pu.employee_id;

UPDATE public.pt_anomalies a
SET employee_id = e.id
FROM public.employees e
WHERE a.employee_id IS NOT NULL
  AND e.legacy_pt_employee_id = a.employee_id;

DROP POLICY IF EXISTS pt_punches_insert ON public.pt_punches;
CREATE POLICY pt_punches_insert ON public.pt_punches
  FOR INSERT TO authenticated
  WITH CHECK (
    pt_is_member(auth.uid(), company_id) AND (
      EXISTS (SELECT 1 FROM public.employees e WHERE e.id = pt_punches.employee_id AND e.user_id = auth.uid())
      OR pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::pt_role[])
    )
  );

DROP POLICY IF EXISTS pt_punches_select ON public.pt_punches;
CREATE POLICY pt_punches_select ON public.pt_punches
  FOR SELECT TO authenticated
  USING (
    pt_is_member(auth.uid(), company_id) AND (
      pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor','supervisor','auditor']::pt_role[])
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = pt_punches.employee_id AND e.user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_employees_org_user ON public.employees(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_schedule ON public.employees(schedule_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(manager_id);

CREATE OR REPLACE FUNCTION public.set_employee_manager(_employee_id uuid, _manager_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _cur uuid;
  _depth int := 0;
BEGIN
  SELECT org_id INTO _org FROM public.employees WHERE id = _employee_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'employee not found'; END IF;
  IF NOT has_org_role(auth.uid(), _org, ARRAY['admin','rh']::org_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _manager_id IS NOT NULL THEN
    IF _manager_id = _employee_id THEN RAISE EXCEPTION 'cycle: self'; END IF;
    _cur := _manager_id;
    WHILE _cur IS NOT NULL AND _depth < 50 LOOP
      IF _cur = _employee_id THEN RAISE EXCEPTION 'cycle detected'; END IF;
      SELECT manager_id INTO _cur FROM public.employees WHERE id = _cur;
      _depth := _depth + 1;
    END LOOP;
  END IF;
  UPDATE public.employees SET manager_id = _manager_id WHERE id = _employee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_employee_manager(uuid, uuid) TO authenticated;
