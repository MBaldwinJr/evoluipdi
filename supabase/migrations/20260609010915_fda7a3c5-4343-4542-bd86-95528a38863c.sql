
DROP POLICY IF EXISTS cs_read ON public.company_settings;
CREATE POLICY cs_read ON public.company_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'rh'::app_role) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS pt_punches_insert ON public.pt_punches;
CREATE POLICY pt_punches_insert ON public.pt_punches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pt_is_member(auth.uid(), company_id) AND (
      EXISTS (SELECT 1 FROM public.pt_employees pe WHERE pe.id = pt_punches.employee_id AND pe.user_id = auth.uid())
      OR public.pt_has_role(auth.uid(), company_id, ARRAY['admin'::pt_role,'rh'::pt_role])
    )
  );

DROP POLICY IF EXISTS pt_punches_select ON public.pt_punches;
CREATE POLICY pt_punches_select ON public.pt_punches
  FOR SELECT TO authenticated
  USING (
    public.pt_is_member(auth.uid(), company_id) AND (
      public.pt_has_role(auth.uid(), company_id, ARRAY['admin'::pt_role,'rh'::pt_role,'gestor'::pt_role,'supervisor'::pt_role,'auditor'::pt_role])
      OR EXISTS (SELECT 1 FROM public.pt_employees pe WHERE pe.id = pt_punches.employee_id AND pe.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS pt_audit_insert ON public.pt_audit_log;
CREATE POLICY pt_audit_insert ON public.pt_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pt_has_role(auth.uid(), company_id, ARRAY['admin'::pt_role,'rh'::pt_role])
    AND actor_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.pt_block_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'pt_audit_log is append-only'; END; $$;

CREATE TABLE IF NOT EXISTS public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_invites_email_idx ON public.org_invites (lower(email));
CREATE INDEX IF NOT EXISTS org_invites_org_idx ON public.org_invites (org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invites TO authenticated;
GRANT ALL ON public.org_invites TO service_role;

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invites_manage ON public.org_invites
  FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin'::org_role,'rh'::org_role]));

CREATE POLICY org_invites_self_select ON public.org_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt()->>'email')::text, '')));

CREATE POLICY org_invites_self_accept ON public.org_invites
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt()->>'email')::text, '')))
  WITH CHECK (lower(email) = lower(coalesce((auth.jwt()->>'email')::text, '')));
