ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS analysis jsonb;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

-- Allow RH to delete interviews and employees
CREATE POLICY "interviews_rh_delete" ON public.interviews FOR DELETE TO authenticated USING (has_role(auth.uid(), 'rh'::app_role));
CREATE POLICY "emp_rh_delete" ON public.employees FOR DELETE TO authenticated USING (has_role(auth.uid(), 'rh'::app_role));