
-- ============================================================
-- MÓDULO PONTO — Migration inicial
-- ============================================================

-- Enums
CREATE TYPE public.pt_role AS ENUM ('admin','rh','gestor','supervisor','funcionario','auditor');
CREATE TYPE public.pt_schedule_kind AS ENUM ('fixa','cinco_x_dois','seis_x_um','doze_x_trinta_seis','flex');
CREATE TYPE public.pt_punch_kind AS ENUM ('entrada','saida','inicio_intervalo','fim_intervalo');
CREATE TYPE public.pt_punch_source AS ENUM ('web','pwa','ajuste');
CREATE TYPE public.pt_punch_status AS ENUM ('ok','pendente','ajustada','rejeitada');

-- ============================================================
-- pt_companies
-- ============================================================
CREATE TABLE public.pt_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trade_name text,
  cnpj text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  block_outside_geofence boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_companies TO authenticated;
GRANT ALL ON public.pt_companies TO service_role;
ALTER TABLE public.pt_companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- pt_company_members
-- ============================================================
CREATE TABLE public.pt_company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.pt_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
CREATE INDEX idx_pt_members_user ON public.pt_company_members(user_id);
CREATE INDEX idx_pt_members_company ON public.pt_company_members(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_company_members TO authenticated;
GRANT ALL ON public.pt_company_members TO service_role;
ALTER TABLE public.pt_company_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Security definer helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.pt_is_member(_user uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pt_company_members
    WHERE user_id = _user AND company_id = _company
  )
$$;

CREATE OR REPLACE FUNCTION public.pt_has_role(_user uuid, _company uuid, _roles public.pt_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pt_company_members
    WHERE user_id = _user AND company_id = _company AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.pt_companies_for_user(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.pt_company_members WHERE user_id = _user
$$;

-- ============================================================
-- Updated_at trigger reuse
-- ============================================================
CREATE TRIGGER pt_companies_updated_at BEFORE UPDATE ON public.pt_companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- RLS pt_companies
-- ============================================================
CREATE POLICY pt_companies_select ON public.pt_companies FOR SELECT TO authenticated
  USING (public.pt_is_member(auth.uid(), id));

CREATE POLICY pt_companies_insert ON public.pt_companies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY pt_companies_update ON public.pt_companies FOR UPDATE TO authenticated
  USING (public.pt_has_role(auth.uid(), id, ARRAY['admin','rh']::public.pt_role[]))
  WITH CHECK (public.pt_has_role(auth.uid(), id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- RLS pt_company_members
-- ============================================================
CREATE POLICY pt_members_select ON public.pt_company_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

CREATE POLICY pt_members_insert ON public.pt_company_members FOR INSERT TO authenticated
  WITH CHECK (
    -- creator of company can add themselves as admin (bootstrap)
    (user_id = auth.uid() AND role = 'admin' AND EXISTS (SELECT 1 FROM public.pt_companies c WHERE c.id = company_id AND c.created_by = auth.uid()))
    OR public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[])
  );

CREATE POLICY pt_members_update ON public.pt_company_members FOR UPDATE TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

CREATE POLICY pt_members_delete ON public.pt_company_members FOR DELETE TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- pt_branches
-- ============================================================
CREATE TABLE public.pt_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  geofence_radius_m integer NOT NULL DEFAULT 200,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_branches_company ON public.pt_branches(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_branches TO authenticated;
GRANT ALL ON public.pt_branches TO service_role;
ALTER TABLE public.pt_branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pt_branches_updated_at BEFORE UPDATE ON public.pt_branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY pt_branches_select ON public.pt_branches FOR SELECT TO authenticated
  USING (public.pt_is_member(auth.uid(), company_id));
CREATE POLICY pt_branches_write ON public.pt_branches FOR ALL TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]))
  WITH CHECK (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- pt_schedules
-- ============================================================
CREATE TABLE public.pt_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.pt_schedule_kind NOT NULL DEFAULT 'fixa',
  -- weekly_pattern: { "0": null, "1": {"start":"08:00","end":"17:00","break_min":60}, ... } (0=Sun)
  weekly_pattern jsonb NOT NULL DEFAULT '{}'::jsonb,
  tolerance_min integer NOT NULL DEFAULT 10,
  night_shift_start time DEFAULT '22:00',
  night_shift_end time DEFAULT '05:00',
  interjornada_min integer NOT NULL DEFAULT 660, -- 11h
  intrajornada_min integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_schedules_company ON public.pt_schedules(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_schedules TO authenticated;
GRANT ALL ON public.pt_schedules TO service_role;
ALTER TABLE public.pt_schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pt_schedules_updated_at BEFORE UPDATE ON public.pt_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY pt_schedules_select ON public.pt_schedules FOR SELECT TO authenticated
  USING (public.pt_is_member(auth.uid(), company_id));
CREATE POLICY pt_schedules_write ON public.pt_schedules FOR ALL TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]))
  WITH CHECK (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- pt_holidays
-- ============================================================
CREATE TABLE public.pt_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.pt_branches(id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_holidays_company_date ON public.pt_holidays(company_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_holidays TO authenticated;
GRANT ALL ON public.pt_holidays TO service_role;
ALTER TABLE public.pt_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY pt_holidays_select ON public.pt_holidays FOR SELECT TO authenticated
  USING (public.pt_is_member(auth.uid(), company_id));
CREATE POLICY pt_holidays_write ON public.pt_holidays FOR ALL TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]))
  WITH CHECK (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- pt_employees
-- ============================================================
CREATE TABLE public.pt_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.pt_branches(id) ON DELETE SET NULL,
  user_id uuid, -- optional link to auth.users
  full_name text NOT NULL,
  cpf text,
  registration text, -- matrícula
  role_title text,
  hire_date date,
  contract_type text DEFAULT 'CLT',
  weekly_hours numeric(5,2) DEFAULT 44.00,
  schedule_id uuid REFERENCES public.pt_schedules(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.pt_employees(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_employees_company ON public.pt_employees(company_id);
CREATE INDEX idx_pt_employees_user ON public.pt_employees(user_id);
CREATE INDEX idx_pt_employees_branch ON public.pt_employees(branch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_employees TO authenticated;
GRANT ALL ON public.pt_employees TO service_role;
ALTER TABLE public.pt_employees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pt_employees_updated_at BEFORE UPDATE ON public.pt_employees
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY pt_employees_select ON public.pt_employees FOR SELECT TO authenticated
  USING (
    public.pt_is_member(auth.uid(), company_id)
    AND (
      user_id = auth.uid()
      OR public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor','supervisor','auditor']::public.pt_role[])
    )
  );
CREATE POLICY pt_employees_write ON public.pt_employees FOR ALL TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]))
  WITH CHECK (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- pt_punches
-- ============================================================
CREATE TABLE public.pt_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.pt_employees(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.pt_branches(id) ON DELETE SET NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  kind public.pt_punch_kind NOT NULL,
  source public.pt_punch_source NOT NULL DEFAULT 'web',
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  inside_geofence boolean,
  distance_to_branch_m double precision,
  selfie_path text,
  device_info jsonb,
  ip text,
  status public.pt_punch_status NOT NULL DEFAULT 'ok',
  anomaly_flags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_punches_employee_ts ON public.pt_punches(employee_id, ts DESC);
CREATE INDEX idx_pt_punches_company_ts ON public.pt_punches(company_id, ts DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_punches TO authenticated;
GRANT ALL ON public.pt_punches TO service_role;
ALTER TABLE public.pt_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY pt_punches_select ON public.pt_punches FOR SELECT TO authenticated
  USING (
    public.pt_is_member(auth.uid(), company_id)
    AND (
      public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor','supervisor','auditor']::public.pt_role[])
      OR EXISTS (SELECT 1 FROM public.pt_employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
    )
  );

-- self insert via employee user_id, or RH/admin adjust
CREATE POLICY pt_punches_insert ON public.pt_punches FOR INSERT TO authenticated
  WITH CHECK (
    public.pt_is_member(auth.uid(), company_id)
    AND (
      EXISTS (SELECT 1 FROM public.pt_employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
      OR public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[])
    )
  );

CREATE POLICY pt_punches_update ON public.pt_punches FOR UPDATE TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

CREATE POLICY pt_punches_delete ON public.pt_punches FOR DELETE TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- pt_audit_log (append-only)
-- ============================================================
CREATE TABLE public.pt_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  ua text,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_audit_company_ts ON public.pt_audit_log(company_id, ts DESC);
GRANT SELECT, INSERT ON public.pt_audit_log TO authenticated;
GRANT ALL ON public.pt_audit_log TO service_role;
ALTER TABLE public.pt_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY pt_audit_select ON public.pt_audit_log FOR SELECT TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','auditor']::public.pt_role[]));
CREATE POLICY pt_audit_insert ON public.pt_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.pt_is_member(auth.uid(), company_id));

-- Block update/delete via trigger
CREATE OR REPLACE FUNCTION public.pt_block_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pt_audit_log is append-only';
END;
$$;
CREATE TRIGGER pt_audit_no_update BEFORE UPDATE ON public.pt_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.pt_block_audit_mutation();
CREATE TRIGGER pt_audit_no_delete BEFORE DELETE ON public.pt_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.pt_block_audit_mutation();

-- ============================================================
-- pt_anomalies
-- ============================================================
CREATE TABLE public.pt_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  punch_id uuid REFERENCES public.pt_punches(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.pt_employees(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'media',
  details jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pt_anomalies_company ON public.pt_anomalies(company_id, resolved);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_anomalies TO authenticated;
GRANT ALL ON public.pt_anomalies TO service_role;
ALTER TABLE public.pt_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY pt_anomalies_select ON public.pt_anomalies FOR SELECT TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor','supervisor','auditor']::public.pt_role[]));
CREATE POLICY pt_anomalies_write ON public.pt_anomalies FOR ALL TO authenticated
  USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]))
  WITH CHECK (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::public.pt_role[]));

-- ============================================================
-- Storage bucket pt-selfies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pt-selfies','pt-selfies', false)
ON CONFLICT (id) DO NOTHING;

-- Object path convention: {company_id}/{employee_id}/{yyyy}/{mm}/{punch_id}.jpg
CREATE POLICY pt_selfies_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pt-selfies'
  AND EXISTS (
    SELECT 1 FROM public.pt_company_members m
    WHERE m.user_id = auth.uid()
      AND m.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY pt_selfies_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pt-selfies'
  AND EXISTS (
    SELECT 1 FROM public.pt_company_members m
    WHERE m.user_id = auth.uid()
      AND m.company_id::text = (storage.foldername(name))[1]
  )
);
