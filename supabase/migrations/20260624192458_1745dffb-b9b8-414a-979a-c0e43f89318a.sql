
-- ============ QUALITY MANAGEMENT (PDCA / Ishikawa / 5 Porquês / CAPA / Auditorias) ============

-- Enums
DO $$ BEGIN CREATE TYPE public.quality_severity AS ENUM ('baixa','media','alta','critica'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quality_status AS ENUM ('aberta','em_analise','em_acao','aguardando_aprovacao','concluida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quality_ishikawa_dim AS ENUM ('homem','maquina','metodo','material','meio_ambiente','gestao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quality_capa_type AS ENUM ('corretiva','preventiva'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quality_action_status AS ENUM ('planejada','em_andamento','concluida','atrasada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quality_audit_standard AS ENUM ('iso_9001','iso_14001','iso_45001','interna','outra'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quality_audit_status AS ENUM ('planejada','em_andamento','concluida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Occurrences (Pai)
CREATE TABLE public.quality_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  sector text,
  severity public.quality_severity NOT NULL DEFAULT 'media',
  status public.quality_status NOT NULL DEFAULT 'aberta',
  evidences jsonb NOT NULL DEFAULT '[]'::jsonb,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);
CREATE INDEX idx_qo_org_status ON public.quality_occurrences(org_id, status);
CREATE INDEX idx_qo_org_severity ON public.quality_occurrences(org_id, severity);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_occurrences TO authenticated;
GRANT ALL ON public.quality_occurrences TO service_role;
ALTER TABLE public.quality_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY qo_select ON public.quality_occurrences FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qo_insert ON public.quality_occurrences FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qo_update ON public.quality_occurrences FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh','gestor','supervisor','auditor']::org_role[])) WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh','gestor','supervisor','auditor']::org_role[]));
CREATE POLICY qo_delete ON public.quality_occurrences FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin']::org_role[]));

-- Ishikawa
CREATE TABLE public.quality_ishikawa_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES public.quality_occurrences(id) ON DELETE CASCADE,
  dimension public.quality_ishikawa_dim NOT NULL,
  cause text NOT NULL,
  is_root boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qi_occ ON public.quality_ishikawa_causes(occurrence_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_ishikawa_causes TO authenticated;
GRANT ALL ON public.quality_ishikawa_causes TO service_role;
ALTER TABLE public.quality_ishikawa_causes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qi_select ON public.quality_ishikawa_causes FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qi_write ON public.quality_ishikawa_causes FOR ALL TO authenticated USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- 5 Porquês
CREATE TABLE public.quality_five_whys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES public.quality_occurrences(id) ON DELETE CASCADE,
  step int NOT NULL CHECK (step BETWEEN 1 AND 10),
  question text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occurrence_id, step)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_five_whys TO authenticated;
GRANT ALL ON public.quality_five_whys TO service_role;
ALTER TABLE public.quality_five_whys ENABLE ROW LEVEL SECURITY;
CREATE POLICY q5_select ON public.quality_five_whys FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY q5_write ON public.quality_five_whys FOR ALL TO authenticated USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Plano de Ação 5W2H
CREATE TABLE public.quality_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  occurrence_id uuid REFERENCES public.quality_occurrences(id) ON DELETE CASCADE,
  what text NOT NULL,
  why text,
  who uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  when_due date,
  where_at text,
  how text,
  how_much_cents int NOT NULL DEFAULT 0,
  status public.quality_action_status NOT NULL DEFAULT 'planejada',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qap_occ ON public.quality_action_plans(occurrence_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_action_plans TO authenticated;
GRANT ALL ON public.quality_action_plans TO service_role;
ALTER TABLE public.quality_action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY qap_select ON public.quality_action_plans FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qap_write ON public.quality_action_plans FOR ALL TO authenticated USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- CAPA
CREATE TABLE public.quality_capa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES public.quality_occurrences(id) ON DELETE CASCADE,
  capa_type public.quality_capa_type NOT NULL,
  description text NOT NULL,
  responsible uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status public.quality_action_status NOT NULL DEFAULT 'planejada',
  effectiveness_check text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qcapa_occ ON public.quality_capa(occurrence_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_capa TO authenticated;
GRANT ALL ON public.quality_capa TO service_role;
ALTER TABLE public.quality_capa ENABLE ROW LEVEL SECURITY;
CREATE POLICY qcapa_select ON public.quality_capa FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qcapa_write ON public.quality_capa FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh','gestor','supervisor','auditor']::org_role[])) WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh','gestor','supervisor','auditor']::org_role[]));

-- Audits ISO
CREATE TABLE public.quality_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  standard public.quality_audit_standard NOT NULL,
  scope text NOT NULL,
  lead_auditor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.quality_audit_status NOT NULL DEFAULT 'planejada',
  started_at date,
  ended_at date,
  score numeric(5,2),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qa_org ON public.quality_audits(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_audits TO authenticated;
GRANT ALL ON public.quality_audits TO service_role;
ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_select ON public.quality_audits FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qa_write ON public.quality_audits FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','auditor','gestor']::org_role[])) WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','auditor','gestor']::org_role[]));

-- Documents
CREATE TABLE public.quality_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  occurrence_id uuid REFERENCES public.quality_occurrences(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qd_org ON public.quality_documents(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_documents TO authenticated;
GRANT ALL ON public.quality_documents TO service_role;
ALTER TABLE public.quality_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY qd_select ON public.quality_documents FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY qd_write ON public.quality_documents FOR ALL TO authenticated USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Audit log (append-only)
CREATE TABLE public.quality_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qal_org ON public.quality_audit_log(org_id, created_at DESC);
GRANT SELECT, INSERT ON public.quality_audit_log TO authenticated;
GRANT ALL ON public.quality_audit_log TO service_role;
ALTER TABLE public.quality_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY qal_select ON public.quality_audit_log FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','auditor']::org_role[]));
CREATE POLICY qal_insert ON public.quality_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Updated_at triggers
CREATE TRIGGER trg_qo_updated BEFORE UPDATE ON public.quality_occurrences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_qap_updated BEFORE UPDATE ON public.quality_action_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_qcapa_updated BEFORE UPDATE ON public.quality_capa FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_qa_updated BEFORE UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto code generator: QC-YYYY-#####
CREATE OR REPLACE FUNCTION public.tg_quality_occurrence_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NEW.code IS NULL OR length(trim(NEW.code)) = 0 THEN
    SELECT COUNT(*) + 1 INTO n FROM public.quality_occurrences
      WHERE org_id = NEW.org_id AND date_trunc('year', created_at) = date_trunc('year', now());
    NEW.code := 'QC-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qo_code BEFORE INSERT ON public.quality_occurrences FOR EACH ROW EXECUTE FUNCTION public.tg_quality_occurrence_code();
