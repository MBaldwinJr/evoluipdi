
-- 1) Restrict SELECT to admin/rh on sensitive tables
DROP POLICY IF EXISTS talent_pool_select ON public.talent_pool;
CREATE POLICY talent_pool_select ON public.talent_pool FOR SELECT TO authenticated
USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

DROP POLICY IF EXISTS applications_select ON public.applications;
CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated
USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

DROP POLICY IF EXISTS app_events_select ON public.application_events;
CREATE POLICY app_events_select ON public.application_events FOR SELECT TO authenticated
USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

DROP POLICY IF EXISTS ci_select_org ON public.candidate_interviews;
CREATE POLICY ci_select_org ON public.candidate_interviews FOR SELECT TO authenticated
USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

-- 2) Explicit admin-only policies for org_email_settings (SMTP credentials)
ALTER TABLE public.org_email_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oes_select_admin ON public.org_email_settings;
DROP POLICY IF EXISTS oes_write_admin ON public.org_email_settings;
CREATE POLICY oes_select_admin ON public.org_email_settings FOR SELECT TO authenticated
USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role]));
CREATE POLICY oes_write_admin ON public.org_email_settings FOR ALL TO authenticated
USING (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role]))
WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role]));

-- 3) Allow employees to read their own punch selfies
DROP POLICY IF EXISTS pt_selfies_select_own ON storage.objects;
CREATE POLICY pt_selfies_select_own ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pt-selfies'
  AND EXISTS (
    SELECT 1 FROM public.pt_employees pe
    WHERE pe.user_id = auth.uid()
      AND pe.id::text = (storage.foldername(name))[2]
  )
);

-- 4) Fix mutable search_path on tg_set_updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 5) Revoke public/anon execute from SECURITY DEFINER functions,
-- keeping only the intentional public-facing ones for the careers page.
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_basic(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_of_emp(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_rh(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_self_emp(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_team_directory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_has_module(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_is_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orgs_for_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pt_companies_for_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pt_has_role(uuid, uuid, pt_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pt_is_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_employee_manager(uuid, uuid) FROM PUBLIC, anon;
