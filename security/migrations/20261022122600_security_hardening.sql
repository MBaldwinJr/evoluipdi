-- VERSIONED REVIEW ARTIFACT ONLY: not applied to production.
-- Service-only RPCs receive actor identity from authenticated server middleware.
BEGIN;
CREATE FUNCTION public.hardening_create_org(actor_id uuid, company jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_org uuid; cnae text;
BEGIN
  IF actor_id IS NULL OR jsonb_typeof(company) IS DISTINCT FROM 'object'
    OR coalesce(company->>'razao_social','') = ''
    OR coalesce(company->>'cnpj','') !~ '^[0-9]{14}$'
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = actor_id) THEN
    RAISE EXCEPTION 'Invalid organization or actor';
  END IF;
  cnae := company->>'cnae_fiscal';
  IF length(cnae) = 7 THEN cnae := substr(cnae,1,4)||'-'||substr(cnae,5,1)||'/'||substr(cnae,6,2); END IF;
  INSERT INTO public.orgs(legal_name,trade_name,cnpj,cnae_code,cnae_description,segment,
    timezone,status,receita_validated_at,receita_payload,created_by)
  VALUES(company->>'razao_social',nullif(company->>'nome_fantasia',''),company->>'cnpj',cnae,
    company->>'cnae_fiscal_descricao',company->>'cnae_fiscal_descricao',
    coalesce(company->>'timezone','America/Sao_Paulo'),'trial',now(),company,actor_id)
  RETURNING id INTO new_org;
  INSERT INTO public.org_members(org_id,user_id,role) VALUES(new_org,actor_id,'admin');
  -- Legacy navigation compatibility, never used as tenant authorization.
  INSERT INTO public.user_roles(user_id,role) VALUES(actor_id,'rh') ON CONFLICT(user_id,role) DO NOTHING;
  INSERT INTO public.org_plans(org_id,plan_code,modules,active) VALUES(new_org,'free',ARRAY['rh'],true);
  RETURN new_org;
END;
$$;
REVOKE ALL ON FUNCTION public.hardening_create_org(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hardening_create_org(uuid,jsonb) TO service_role;

CREATE FUNCTION public.hardening_update_plan(actor_id uuid,target_org uuid,new_plan text,new_modules text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF actor_id IS NULL OR NOT public.is_super_admin(actor_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF new_plan IS NULL OR new_plan NOT IN ('free','starter','pro','enterprise') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  PERFORM 1 FROM public.orgs WHERE id = target_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;
  UPDATE public.org_plans SET active = false WHERE org_id = target_org AND active;
  INSERT INTO public.org_plans(org_id,plan_code,modules,active) VALUES(target_org,new_plan::public.plan_code,new_modules,true);
END;
$$;
REVOKE ALL ON FUNCTION public.hardening_update_plan(uuid,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hardening_update_plan(uuid,uuid,text,text[]) TO service_role;

CREATE FUNCTION public.hardening_accept_invite(actor_id uuid,invite_token text,verified_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invitation public.org_invites%ROWTYPE;
BEGIN
  IF actor_id IS NULL OR coalesce(btrim(verified_email),'') = '' THEN RAISE EXCEPTION 'Identity required'; END IF;
  SELECT * INTO invitation FROM public.org_invites WHERE token = invite_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  IF invitation.accepted_at IS NOT NULL OR invitation.expires_at <= clock_timestamp()
    OR lower(btrim(invitation.email)) <> lower(btrim(verified_email)) THEN RAISE EXCEPTION 'Invalid invitation or identity'; END IF;
  -- Recheck even invites issued before this hardening round.
  IF NOT public.has_org_role(invitation.invited_by,invitation.org_id,
    CASE WHEN invitation.role = 'admin' THEN ARRAY['admin'::public.org_role]
    ELSE ARRAY['admin'::public.org_role,'rh'::public.org_role] END) THEN RAISE EXCEPTION 'Inviter unauthorized'; END IF;
  UPDATE public.org_invites SET accepted_at = clock_timestamp(),accepted_by = actor_id
    WHERE id = invitation.id AND accepted_at IS NULL AND expires_at > clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation consumed or expired'; END IF;
  INSERT INTO public.org_members(org_id,user_id,role) VALUES(invitation.org_id,actor_id,invitation.role)
    ON CONFLICT(org_id,user_id,role) DO NOTHING;
  IF invitation.role IN ('admin','rh') THEN
    INSERT INTO public.user_roles(user_id,role) VALUES(actor_id,'rh') ON CONFLICT(user_id,role) DO NOTHING;
  ELSIF invitation.role = 'gestor' THEN
    INSERT INTO public.user_roles(user_id,role) VALUES(actor_id,'gestor') ON CONFLICT(user_id,role) DO NOTHING;
  END IF;
  RETURN invitation.org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.hardening_accept_invite(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hardening_accept_invite(uuid,text,text) TO service_role;

-- Demonstrated bypass: org admin direct plan writes; global RH role escalation.
DROP POLICY IF EXISTS plans_insert ON public.org_plans;
DROP POLICY IF EXISTS plans_update ON public.org_plans;
DROP POLICY IF EXISTS roles_block_self_insert ON public.user_roles;
DROP POLICY IF EXISTS roles_rh_all ON public.user_roles;
CREATE POLICY roles_super_admin_write ON public.user_roles FOR ALL TO authenticated
  USING(public.is_super_admin(auth.uid())) WITH CHECK(public.is_super_admin(auth.uid()));

-- Invitees must not rewrite their own token/role/accepted state via Data API.
DROP POLICY IF EXISTS org_invites_manage ON public.org_invites;
DROP POLICY IF EXISTS org_invites_self_accept ON public.org_invites;
CREATE POLICY org_invites_manager_read ON public.org_invites FOR SELECT TO authenticated
  USING(public.has_org_role(auth.uid(),org_id,ARRAY['admin'::public.org_role,'rh'::public.org_role]));
CREATE POLICY org_invites_manager_insert ON public.org_invites FOR INSERT TO authenticated
  WITH CHECK(invited_by = auth.uid() AND accepted_at IS NULL AND accepted_by IS NULL
    AND public.has_org_role(auth.uid(),org_id,CASE WHEN role = 'admin' THEN ARRAY['admin'::public.org_role]
      ELSE ARRAY['admin'::public.org_role,'rh'::public.org_role] END));
CREATE POLICY org_invites_manager_delete ON public.org_invites FOR DELETE TO authenticated
  USING(public.has_org_role(auth.uid(),org_id,ARRAY['admin'::public.org_role,'rh'::public.org_role]));

DROP POLICY IF EXISTS members_insert ON public.org_members;
DROP POLICY IF EXISTS members_update ON public.org_members;
CREATE POLICY members_insert ON public.org_members FOR INSERT TO authenticated
  WITH CHECK(public.has_org_role(auth.uid(),org_id,CASE WHEN role = 'admin' THEN ARRAY['admin'::public.org_role]
    ELSE ARRAY['admin'::public.org_role,'rh'::public.org_role] END));
CREATE POLICY members_update ON public.org_members FOR UPDATE TO authenticated
  USING(public.has_org_role(auth.uid(),org_id,CASE WHEN role = 'admin' THEN ARRAY['admin'::public.org_role]
    ELSE ARRAY['admin'::public.org_role,'rh'::public.org_role] END))
  WITH CHECK(public.has_org_role(auth.uid(),org_id,CASE WHEN role = 'admin' THEN ARRAY['admin'::public.org_role]
    ELSE ARRAY['admin'::public.org_role,'rh'::public.org_role] END));

CREATE FUNCTION public.hardening_pwe_valid(actor uuid,target_org uuid,target_employee uuid,target_evaluator uuid,target_process uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT actor = auth.uid() AND public.is_org_member(actor,target_org)
    AND EXISTS(SELECT 1 FROM public.employees e WHERE e.id = target_employee AND e.org_id = target_org)
    AND EXISTS(SELECT 1 FROM public.role_processes p WHERE p.id = target_process AND p.org_id = target_org)
    AND public.is_org_member(target_evaluator,target_org)
    AND (public.has_org_role(actor,target_org,ARRAY['admin'::public.org_role,'rh'::public.org_role])
      OR (target_evaluator = actor AND public.is_manager_of_emp(actor,target_employee)));
$$;
REVOKE ALL ON FUNCTION public.hardening_pwe_valid(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hardening_pwe_valid(uuid,uuid,uuid,uuid,uuid) TO authenticated,service_role;
DROP POLICY IF EXISTS pwe_update ON public.process_weekly_evaluations;
CREATE POLICY pwe_update ON public.process_weekly_evaluations FOR UPDATE TO authenticated
  USING(public.hardening_pwe_valid(auth.uid(),org_id,employee_id,evaluator_id,role_process_id))
  WITH CHECK(public.hardening_pwe_valid(auth.uid(),org_id,employee_id,evaluator_id,role_process_id));
DROP POLICY IF EXISTS pwe_insert ON public.process_weekly_evaluations;
CREATE POLICY pwe_insert ON public.process_weekly_evaluations FOR INSERT TO authenticated
  WITH CHECK(evaluator_id = auth.uid() AND public.hardening_pwe_valid(auth.uid(),org_id,employee_id,evaluator_id,role_process_id));

CREATE FUNCTION public.hardening_pwe_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ROW(NEW.org_id,NEW.employee_id,NEW.evaluator_id,NEW.role_process_id,NEW.week_start)
    IS DISTINCT FROM ROW(OLD.org_id,OLD.employee_id,OLD.evaluator_id,OLD.role_process_id,OLD.week_start) THEN
    RAISE EXCEPTION 'Evaluation identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hardening_pwe_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER hardening_pwe_identity BEFORE UPDATE ON public.process_weekly_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.hardening_pwe_identity();
COMMIT;