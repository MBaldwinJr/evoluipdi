DROP POLICY IF EXISTS emp_select ON public.employees;
CREATE POLICY emp_select ON public.employees
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'rh'::app_role)
  OR public.is_manager_of_emp(auth.uid(), id)
);