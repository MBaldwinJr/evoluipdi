CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('draft','open','paused','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.work_model AS ENUM ('presencial','hibrido','remoto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('clt','pj','estagio','temporario','aprendiz','terceirizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  role_id UUID REFERENCES public.roles_catalog(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  location TEXT,
  work_model public.work_model NOT NULL DEFAULT 'presencial',
  employment_type public.employment_type NOT NULL DEFAULT 'clt',
  vacancies_quantity INT NOT NULL DEFAULT 1 CHECK (vacancies_quantity > 0),
  salary_min INT,
  salary_max INT,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements TEXT,
  responsibilities TEXT,
  description TEXT,
  status public.job_status NOT NULL DEFAULT 'draft',
  closing_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_org_idx ON public.jobs(org_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs(org_id, status);
CREATE INDEX IF NOT EXISTS jobs_role_idx ON public.jobs(role_id);
CREATE INDEX IF NOT EXISTS jobs_department_idx ON public.jobs(department_id);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON public.jobs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_title_trgm_idx ON public.jobs USING gin (title gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_select_org" ON public.jobs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "jobs_insert_rh" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "jobs_update_rh" ON public.jobs FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "jobs_delete_rh" ON public.jobs FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER jobs_set_org_id BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id();

-- position_kpis
CREATE TABLE IF NOT EXISTS public.position_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles_catalog(id) ON DELETE CASCADE,
  education_required TEXT,
  experience_years INT DEFAULT 0 CHECK (experience_years >= 0),
  mandatory_courses JSONB NOT NULL DEFAULT '[]'::jsonb,
  mandatory_certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  soft_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  salary_reference INT,
  work_schedule TEXT,
  work_location TEXT,
  travel_required BOOLEAN NOT NULL DEFAULT false,
  driver_license TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, role_id)
);
CREATE INDEX IF NOT EXISTS position_kpis_org_idx ON public.position_kpis(org_id);
CREATE INDEX IF NOT EXISTS position_kpis_role_idx ON public.position_kpis(role_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_kpis TO authenticated;
GRANT ALL ON public.position_kpis TO service_role;
ALTER TABLE public.position_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position_kpis_select_org" ON public.position_kpis FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "position_kpis_insert_rh" ON public.position_kpis FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "position_kpis_update_rh" ON public.position_kpis FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "position_kpis_delete_rh" ON public.position_kpis FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE TRIGGER position_kpis_set_updated_at BEFORE UPDATE ON public.position_kpis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER position_kpis_set_org_id BEFORE INSERT ON public.position_kpis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id();

-- job_templates
CREATE TABLE IF NOT EXISTS public.job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  description_template TEXT,
  requirements_template TEXT,
  responsibilities_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_templates_org_idx ON public.job_templates(org_id);
CREATE INDEX IF NOT EXISTS job_templates_department_idx ON public.job_templates(department_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_templates TO authenticated;
GRANT ALL ON public.job_templates TO service_role;
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_templates_select_org" ON public.job_templates FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "job_templates_insert_rh" ON public.job_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "job_templates_update_rh" ON public.job_templates FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "job_templates_delete_rh" ON public.job_templates FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE TRIGGER job_templates_set_updated_at BEFORE UPDATE ON public.job_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER job_templates_set_org_id BEFORE INSERT ON public.job_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id();