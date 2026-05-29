
-- =====================================================
-- 1. ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('admin', 'rh', 'gestor', 'supervisor', 'colaborador', 'auditor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_code AS ENUM ('free', 'starter', 'pro', 'enterprise', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================
-- 2. orgs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trade_name text,
  cnpj text UNIQUE,
  cnae_code text,
  cnae_description text,
  segment text,
  status public.org_status NOT NULL DEFAULT 'trial',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  receita_validated_at timestamptz,
  receita_payload jsonb,
  block_outside_geofence boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.orgs TO authenticated;
GRANT ALL ON public.orgs TO service_role;

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. org_members
-- =====================================================
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.org_members(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. org_plans
-- =====================================================
CREATE TABLE IF NOT EXISTS public.org_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  plan_code public.plan_code NOT NULL DEFAULT 'free',
  modules text[] NOT NULL DEFAULT '{}',
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_plans_org_active ON public.org_plans(org_id, active);

GRANT SELECT, INSERT, UPDATE ON public.org_plans TO authenticated;
GRANT ALL ON public.org_plans TO service_role;

ALTER TABLE public.org_plans ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. SECURITY DEFINER helpers
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user AND org_id = _org)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user uuid, _org uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user AND org_id = _org AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.orgs_for_user(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT org_id FROM public.org_members WHERE user_id = _user
$$;

CREATE OR REPLACE FUNCTION public.org_has_module(_org uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_plans
    WHERE org_id = _org AND active
      AND (valid_to IS NULL OR valid_to > now())
      AND _module = ANY(modules)
  )
$$;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================
DROP POLICY IF EXISTS orgs_select ON public.orgs;
CREATE POLICY orgs_select ON public.orgs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

DROP POLICY IF EXISTS orgs_insert ON public.orgs;
CREATE POLICY orgs_insert ON public.orgs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS orgs_update ON public.orgs;
CREATE POLICY orgs_update ON public.orgs FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, ARRAY['admin','rh']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), id, ARRAY['admin','rh']::public.org_role[]));

DROP POLICY IF EXISTS members_select ON public.org_members;
CREATE POLICY members_select ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]));

DROP POLICY IF EXISTS members_insert ON public.org_members;
CREATE POLICY members_insert ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'admin' AND EXISTS (
      SELECT 1 FROM public.orgs o WHERE o.id = org_id AND o.created_by = auth.uid()
    ))
    OR public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[])
  );

DROP POLICY IF EXISTS members_update ON public.org_members;
CREATE POLICY members_update ON public.org_members FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]));

DROP POLICY IF EXISTS members_delete ON public.org_members;
CREATE POLICY members_delete ON public.org_members FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]));

DROP POLICY IF EXISTS plans_select ON public.org_plans;
CREATE POLICY plans_select ON public.org_plans FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS plans_insert ON public.org_plans;
CREATE POLICY plans_insert ON public.org_plans FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['admin']::public.org_role[])
    OR EXISTS (SELECT 1 FROM public.orgs o WHERE o.id = org_id AND o.created_by = auth.uid())
  );

DROP POLICY IF EXISTS plans_update ON public.org_plans;
CREATE POLICY plans_update ON public.org_plans FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin']::public.org_role[]));

-- =====================================================
-- 7. updated_at trigger
-- =====================================================
DROP TRIGGER IF EXISTS trg_orgs_updated ON public.orgs;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================
-- 8. BACKFILL pt_companies → orgs
-- =====================================================
INSERT INTO public.orgs (id, legal_name, trade_name, cnpj, timezone, status, block_outside_geofence, created_by, created_at, updated_at)
SELECT c.id, c.legal_name, c.trade_name, c.cnpj, c.timezone, 'active'::public.org_status,
       c.block_outside_geofence, c.created_by, c.created_at, c.updated_at
FROM public.pt_companies c
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.org_members (org_id, user_id, role, created_at)
SELECT m.company_id, m.user_id, m.role::text::public.org_role, m.created_at
FROM public.pt_company_members m
WHERE EXISTS (SELECT 1 FROM public.orgs o WHERE o.id = m.company_id)
ON CONFLICT (org_id, user_id, role) DO NOTHING;

INSERT INTO public.org_plans (org_id, plan_code, modules, limits, active)
SELECT o.id, 'pro'::public.plan_code,
       ARRAY['rh','pdi','entrevistas','candidatos','ponto','relatorios']::text[],
       '{"max_employees": 100, "max_branches": 5}'::jsonb, true
FROM public.orgs o
WHERE NOT EXISTS (SELECT 1 FROM public.org_plans p WHERE p.org_id = o.id AND p.active);

-- =====================================================
-- 9. Default org for legacy RH data (reuse if CNPJ matches)
-- =====================================================
DO $$
DECLARE
  v_default_id uuid;
  v_settings RECORD;
  v_creator uuid;
BEGIN
  SELECT user_id INTO v_creator FROM public.user_roles WHERE role = 'rh' LIMIT 1;
  IF v_creator IS NULL THEN
    SELECT user_id INTO v_creator FROM public.user_roles LIMIT 1;
  END IF;

  IF v_creator IS NOT NULL THEN
    SELECT * INTO v_settings FROM public.company_settings LIMIT 1;

    -- Try to reuse existing org by CNPJ first
    IF v_settings.cnpj IS NOT NULL THEN
      SELECT id INTO v_default_id FROM public.orgs WHERE cnpj = v_settings.cnpj LIMIT 1;
    END IF;

    -- Else try by name
    IF v_default_id IS NULL THEN
      SELECT id INTO v_default_id FROM public.orgs
      WHERE legal_name = COALESCE(v_settings.legal_name, 'Empresa Default') LIMIT 1;
    END IF;

    -- Else create new
    IF v_default_id IS NULL THEN
      INSERT INTO public.orgs (legal_name, trade_name, cnpj, cnae_code, cnae_description, segment, status, created_by)
      VALUES (
        COALESCE(v_settings.legal_name, 'Empresa Default'),
        v_settings.trade_name, v_settings.cnpj,
        v_settings.cnae_code, v_settings.cnae_description, v_settings.segment,
        'active', v_creator
      )
      RETURNING id INTO v_default_id;
    ELSE
      -- Enrich existing org with RH metadata if missing
      UPDATE public.orgs SET
        cnae_code = COALESCE(cnae_code, v_settings.cnae_code),
        cnae_description = COALESCE(cnae_description, v_settings.cnae_description),
        segment = COALESCE(segment, v_settings.segment),
        trade_name = COALESCE(trade_name, v_settings.trade_name)
      WHERE id = v_default_id;
    END IF;

    -- Upgrade plan to enterprise (full modules)
    UPDATE public.org_plans
       SET plan_code = 'enterprise',
           modules = ARRAY['rh','pdi','entrevistas','candidatos','ponto','relatorios','jornada-avancada','ia-assistente']::text[]
     WHERE org_id = v_default_id AND active;

    IF NOT EXISTS (SELECT 1 FROM public.org_plans WHERE org_id = v_default_id AND active) THEN
      INSERT INTO public.org_plans (org_id, plan_code, modules, limits, active)
      VALUES (v_default_id, 'enterprise',
        ARRAY['rh','pdi','entrevistas','candidatos','ponto','relatorios','jornada-avancada','ia-assistente']::text[],
        '{}'::jsonb, true);
    END IF;

    -- Add RH users as admin
    INSERT INTO public.org_members (org_id, user_id, role)
    SELECT v_default_id, ur.user_id, 'admin'::public.org_role
    FROM public.user_roles ur WHERE ur.role = 'rh'
    ON CONFLICT DO NOTHING;

    -- Add all users by their global role
    INSERT INTO public.org_members (org_id, user_id, role)
    SELECT v_default_id, ur.user_id,
      CASE ur.role::text
        WHEN 'rh' THEN 'rh'::public.org_role
        WHEN 'gestor' THEN 'gestor'::public.org_role
        WHEN 'colaborador' THEN 'colaborador'::public.org_role
        ELSE 'colaborador'::public.org_role
      END
    FROM public.user_roles ur
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- 10. Sync triggers: org ↔ pt_*
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_org_to_pt_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role::text IN ('admin','rh','gestor','supervisor','auditor') THEN
    INSERT INTO public.pt_company_members (company_id, user_id, role)
    SELECT NEW.org_id, NEW.user_id, NEW.role::text::public.pt_role
    WHERE EXISTS (SELECT 1 FROM public.pt_companies WHERE id = NEW.org_id)
    ON CONFLICT DO NOTHING;
  ELSIF NEW.role::text = 'colaborador' THEN
    INSERT INTO public.pt_company_members (company_id, user_id, role)
    SELECT NEW.org_id, NEW.user_id, 'funcionario'::public.pt_role
    WHERE EXISTS (SELECT 1 FROM public.pt_companies WHERE id = NEW.org_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_pt_members ON public.org_members;
CREATE TRIGGER trg_sync_org_pt_members AFTER INSERT OR UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_to_pt_members();

CREATE OR REPLACE FUNCTION public.sync_org_to_pt_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pt_companies (id, legal_name, trade_name, cnpj, timezone, block_outside_geofence, created_by, created_at, updated_at)
  VALUES (NEW.id, NEW.legal_name, NEW.trade_name, NEW.cnpj, NEW.timezone, NEW.block_outside_geofence, NEW.created_by, NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_pt_company ON public.orgs;
CREATE TRIGGER trg_sync_org_pt_company AFTER INSERT ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_to_pt_company();

-- Sync existing legacy orgs (those without pt_companies row) so ponto works
INSERT INTO public.pt_companies (id, legal_name, trade_name, cnpj, timezone, block_outside_geofence, created_by, created_at, updated_at)
SELECT o.id, o.legal_name, o.trade_name, o.cnpj, o.timezone, o.block_outside_geofence, o.created_by, o.created_at, o.updated_at
FROM public.orgs o
ON CONFLICT (id) DO NOTHING;

-- Sync org_members → pt_company_members for legacy default org
INSERT INTO public.pt_company_members (company_id, user_id, role)
SELECT om.org_id, om.user_id,
  CASE om.role::text
    WHEN 'colaborador' THEN 'funcionario'::public.pt_role
    ELSE om.role::text::public.pt_role
  END
FROM public.org_members om
WHERE EXISTS (SELECT 1 FROM public.pt_companies WHERE id = om.org_id)
ON CONFLICT DO NOTHING;
