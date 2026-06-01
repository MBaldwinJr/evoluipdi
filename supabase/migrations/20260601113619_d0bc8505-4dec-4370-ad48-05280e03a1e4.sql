
-- =========================================================
-- Multi-tenancy: add org_id to RH domain tables + RLS rewrite
-- =========================================================

-- Helper: current org from session setting OR first membership of caller
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_org', true), '')::uuid,
    (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1)
  )
$$;

-- Generic BEFORE INSERT trigger to auto-fill org_id when caller omits it
CREATE OR REPLACE FUNCTION public.tg_set_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Default org for backfill: the only existing org (MVP single-tenant data)
DO $$
DECLARE
  default_org uuid;
BEGIN
  SELECT id INTO default_org FROM public.orgs ORDER BY created_at LIMIT 1;
  IF default_org IS NULL THEN
    RAISE NOTICE 'No org found, skipping backfill';
    RETURN;
  END IF;

  -- Add org_id columns (nullable), backfill, set NOT NULL, attach trigger
  -- employees
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.employees SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.employees ALTER COLUMN org_id SET NOT NULL;
  ALTER TABLE public.employees ALTER COLUMN user_id DROP NOT NULL;

  -- departments
  ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.departments SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.departments ALTER COLUMN org_id SET NOT NULL;

  -- roles_catalog
  ALTER TABLE public.roles_catalog ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.roles_catalog SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.roles_catalog ALTER COLUMN org_id SET NOT NULL;

  -- rcf_items
  ALTER TABLE public.rcf_items ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.rcf_items SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.rcf_items ALTER COLUMN org_id SET NOT NULL;

  -- role_processes
  ALTER TABLE public.role_processes ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.role_processes SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.role_processes ALTER COLUMN org_id SET NOT NULL;

  -- interview_templates
  ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.interview_templates SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.interview_templates ALTER COLUMN org_id SET NOT NULL;

  -- interviews
  ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.interviews SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.interviews ALTER COLUMN org_id SET NOT NULL;

  -- evaluations
  ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.evaluations SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.evaluations ALTER COLUMN org_id SET NOT NULL;

  -- feedbacks
  ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.feedbacks SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.feedbacks ALTER COLUMN org_id SET NOT NULL;

  -- gaps
  ALTER TABLE public.gaps ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.gaps SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.gaps ALTER COLUMN org_id SET NOT NULL;

  -- pdis
  ALTER TABLE public.pdis ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.pdis SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.pdis ALTER COLUMN org_id SET NOT NULL;

  -- checkins
  ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.checkins SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.checkins ALTER COLUMN org_id SET NOT NULL;

  -- learning_logs
  ALTER TABLE public.learning_logs ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.learning_logs SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.learning_logs ALTER COLUMN org_id SET NOT NULL;

  -- candidate_invites
  ALTER TABLE public.candidate_invites ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.candidate_invites SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.candidate_invites ALTER COLUMN org_id SET NOT NULL;
END $$;

-- Attach BEFORE INSERT trigger on all org-scoped tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees','departments','roles_catalog','rcf_items','role_processes',
    'interview_templates','interviews','evaluations','feedbacks','gaps',
    'pdis','checkins','learning_logs','candidate_invites'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_org_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_org_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_id_idx', t);
  END LOOP;
END $$;

-- =========================================================
-- RLS rewrite: org-scoped
-- =========================================================

-- employees
DROP POLICY IF EXISTS emp_rh_delete ON public.employees;
DROP POLICY IF EXISTS emp_rh_write ON public.employees;
DROP POLICY IF EXISTS emp_select ON public.employees;
DROP POLICY IF EXISTS emp_self_update_goals ON public.employees;

CREATE POLICY emp_select ON public.employees FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), org_id) AND (
      user_id = auth.uid()
      OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
      OR is_manager_of_emp(auth.uid(), id)
    )
  );
CREATE POLICY emp_rh_write ON public.employees FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));
CREATE POLICY emp_self_update_goals ON public.employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- departments
DROP POLICY IF EXISTS dept_read ON public.departments;
DROP POLICY IF EXISTS dept_rh_write ON public.departments;
CREATE POLICY dept_read ON public.departments FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));
CREATE POLICY dept_rh_write ON public.departments FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- roles_catalog
DROP POLICY IF EXISTS roles_cat_read ON public.roles_catalog;
DROP POLICY IF EXISTS roles_cat_rh_write ON public.roles_catalog;
CREATE POLICY roles_cat_read ON public.roles_catalog FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));
CREATE POLICY roles_cat_rh_write ON public.roles_catalog FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- rcf_items
DROP POLICY IF EXISTS rcf_read ON public.rcf_items;
DROP POLICY IF EXISTS rcf_rh_write ON public.rcf_items;
CREATE POLICY rcf_read ON public.rcf_items FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));
CREATE POLICY rcf_rh_write ON public.rcf_items FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- role_processes
DROP POLICY IF EXISTS rp_read ON public.role_processes;
DROP POLICY IF EXISTS rp_rh_write ON public.role_processes;
CREATE POLICY rp_read ON public.role_processes FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));
CREATE POLICY rp_rh_write ON public.role_processes FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- interview_templates
DROP POLICY IF EXISTS tpl_read ON public.interview_templates;
DROP POLICY IF EXISTS tpl_rh_write ON public.interview_templates;
CREATE POLICY tpl_read ON public.interview_templates FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));
CREATE POLICY tpl_rh_write ON public.interview_templates FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- interviews
DROP POLICY IF EXISTS interviews_read ON public.interviews;
DROP POLICY IF EXISTS interviews_rh_delete ON public.interviews;
DROP POLICY IF EXISTS interviews_update ON public.interviews;
DROP POLICY IF EXISTS interviews_write ON public.interviews;
CREATE POLICY interviews_read ON public.interviews FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY interviews_write ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (conducted_by = auth.uid() AND (
    is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY interviews_update ON public.interviews FOR UPDATE TO authenticated
  USING (conducted_by = auth.uid() OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));
CREATE POLICY interviews_rh_delete ON public.interviews FOR DELETE TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- evaluations
DROP POLICY IF EXISTS evals_read ON public.evaluations;
DROP POLICY IF EXISTS evals_update ON public.evaluations;
DROP POLICY IF EXISTS evals_write ON public.evaluations;
CREATE POLICY evals_read ON public.evaluations FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY evals_write ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (evaluator_id = auth.uid() AND (
    is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY evals_update ON public.evaluations FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid() OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- feedbacks
DROP POLICY IF EXISTS fb_read ON public.feedbacks;
DROP POLICY IF EXISTS fb_update ON public.feedbacks;
DROP POLICY IF EXISTS fb_write ON public.feedbacks;
CREATE POLICY fb_read ON public.feedbacks FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR author_id = auth.uid()
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY fb_write ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_org_member(auth.uid(), org_id));
CREATE POLICY fb_update ON public.feedbacks FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- gaps
DROP POLICY IF EXISTS gaps_read ON public.gaps;
DROP POLICY IF EXISTS gaps_write ON public.gaps;
CREATE POLICY gaps_read ON public.gaps FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY gaps_write ON public.gaps FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR is_self_emp(auth.uid(), employee_id)
  ))
  WITH CHECK (is_org_member(auth.uid(), org_id) AND (
    is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR is_self_emp(auth.uid(), employee_id)
  ));

-- pdis
DROP POLICY IF EXISTS pdi_read ON public.pdis;
DROP POLICY IF EXISTS pdi_write ON public.pdis;
CREATE POLICY pdi_read ON public.pdis FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY pdi_write ON public.pdis FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ))
  WITH CHECK (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));

-- checkins
DROP POLICY IF EXISTS ck_read ON public.checkins;
DROP POLICY IF EXISTS ck_write ON public.checkins;
CREATE POLICY ck_read ON public.checkins FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY ck_write ON public.checkins FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR is_self_emp(auth.uid(), employee_id)
  ))
  WITH CHECK (is_org_member(auth.uid(), org_id) AND (
    is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR is_self_emp(auth.uid(), employee_id)
  ));

-- learning_logs
DROP POLICY IF EXISTS ll_read ON public.learning_logs;
DROP POLICY IF EXISTS ll_write ON public.learning_logs;
CREATE POLICY ll_read ON public.learning_logs FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR is_manager_of_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));
CREATE POLICY ll_write ON public.learning_logs FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ))
  WITH CHECK (is_org_member(auth.uid(), org_id) AND (
    is_self_emp(auth.uid(), employee_id)
    OR has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
  ));

-- candidate_invites
DROP POLICY IF EXISTS cand_inv_rh_all ON public.candidate_invites;
CREATE POLICY cand_inv_rh_all ON public.candidate_invites FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), org_id) AND (
    has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR created_by = auth.uid()
  ))
  WITH CHECK (is_org_member(auth.uid(), org_id) AND (
    has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role])
    OR created_by = auth.uid()
  ));

-- =========================================================
-- Update list_team_directory to filter by org
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_team_directory()
RETURNS TABLE(id uuid, user_id uuid, full_name text, role_id uuid, role_title text, department_id uuid, department_name text, manager_id uuid, hire_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.user_id, p.full_name,
         e.role_id, r.title,
         e.department_id, d.name,
         e.manager_id, e.hire_date
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN public.roles_catalog r ON r.id = e.role_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  WHERE e.active
    AND public.is_org_member(auth.uid(), e.org_id)
    AND (
      public.has_org_role(auth.uid(), e.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      OR e.user_id = auth.uid()
      OR public.is_manager_of(auth.uid(), e.user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_employee_basic(_employee_id uuid)
RETURNS TABLE(id uuid, user_id uuid, full_name text, role_id uuid, role_title text, department_id uuid, department_name text, manager_id uuid, hire_date date, career_goals text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.user_id, p.full_name,
         e.role_id, r.title,
         e.department_id, d.name,
         e.manager_id, e.hire_date, e.career_goals
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN public.roles_catalog r ON r.id = e.role_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  WHERE e.id = _employee_id
    AND public.is_org_member(auth.uid(), e.org_id)
    AND (
      public.has_org_role(auth.uid(), e.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      OR e.user_id = auth.uid()
      OR public.is_manager_of(auth.uid(), e.user_id)
    );
$$;
