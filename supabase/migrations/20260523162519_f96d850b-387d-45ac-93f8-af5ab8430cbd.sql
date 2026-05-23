
-- 1) Remove manager access to profiles (prevents managers from reading employee emails)
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'rh'::app_role));

-- 2) Safe directory functions for managers/self/RH (no email exposed)
CREATE OR REPLACE FUNCTION public.list_team_directory()
RETURNS TABLE(
  id uuid, user_id uuid, full_name text,
  role_id uuid, role_title text,
  department_id uuid, department_name text,
  manager_id uuid, hire_date date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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
    AND (
      public.has_role(auth.uid(), 'rh'::app_role)
      OR e.user_id = auth.uid()
      OR public.is_manager_of(auth.uid(), e.user_id)
    );
$$;
REVOKE EXECUTE ON FUNCTION public.list_team_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_team_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_employee_basic(_employee_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, full_name text,
  role_id uuid, role_title text,
  department_id uuid, department_name text,
  manager_id uuid, hire_date date, career_goals text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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
    AND (
      public.has_role(auth.uid(), 'rh'::app_role)
      OR e.user_id = auth.uid()
      OR public.is_manager_of(auth.uid(), e.user_id)
    );
$$;
REVOKE EXECUTE ON FUNCTION public.get_employee_basic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_basic(uuid) TO authenticated;

-- 3) Defense in depth: restrictive policy blocking non-RH role inserts
DROP POLICY IF EXISTS roles_block_self_insert ON public.user_roles;
CREATE POLICY roles_block_self_insert ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'rh'::app_role));

-- 4) Lock down internal trigger function (not callable by app users)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
