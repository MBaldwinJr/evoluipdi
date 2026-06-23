
DO $$ BEGIN
  CREATE TYPE public.application_stage AS ENUM ('applied','screening','interview','technical','offer','hired','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.talent_status AS ENUM ('active','archived','hired','blacklisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.talent_source AS ENUM ('manual','import','application','referral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.talent_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  location text,
  linkedin_url text,
  current_position text,
  current_company text,
  years_experience int NOT NULL DEFAULT 0,
  skills text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  summary text,
  source public.talent_source NOT NULL DEFAULT 'manual',
  cv_url text,
  cv_text text,
  ai_score int,
  ai_summary text,
  status public.talent_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_pool TO authenticated;
GRANT ALL ON public.talent_pool TO service_role;
ALTER TABLE public.talent_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talent_pool_select" ON public.talent_pool FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "talent_pool_insert" ON public.talent_pool FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "talent_pool_update" ON public.talent_pool FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "talent_pool_delete" ON public.talent_pool FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));

CREATE TRIGGER trg_talent_pool_org BEFORE INSERT ON public.talent_pool
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id();
CREATE TRIGGER trg_talent_pool_uat BEFORE UPDATE ON public.talent_pool
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_talent_pool_org ON public.talent_pool(org_id);
CREATE INDEX IF NOT EXISTS idx_talent_pool_status ON public.talent_pool(org_id, status);
CREATE INDEX IF NOT EXISTS idx_talent_pool_skills ON public.talent_pool USING gin(skills);
CREATE INDEX IF NOT EXISTS idx_talent_pool_tags ON public.talent_pool USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_talent_pool_name_trgm ON public.talent_pool USING gin(full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_talent_pool_email_trgm ON public.talent_pool USING gin(email gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES public.talent_pool(id) ON DELETE CASCADE,
  stage public.application_stage NOT NULL DEFAULT 'applied',
  stage_order int NOT NULL DEFAULT 0,
  rating int CHECK (rating BETWEEN 1 AND 5),
  ai_fit_score int CHECK (ai_fit_score BETWEEN 0 AND 100),
  ai_fit_summary text,
  rejection_reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, talent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_select" ON public.applications FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "applications_insert" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "applications_update" ON public.applications FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));
CREATE POLICY "applications_delete" ON public.applications FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));

CREATE TRIGGER trg_applications_org BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id();
CREATE TRIGGER trg_applications_uat BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_job_stage ON public.applications(job_id, stage, stage_order);
CREATE INDEX IF NOT EXISTS idx_applications_talent ON public.applications(talent_id);
CREATE INDEX IF NOT EXISTS idx_applications_org ON public.applications(org_id);

CREATE TABLE IF NOT EXISTS public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.application_events TO authenticated;
GRANT ALL ON public.application_events TO service_role;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_events_select" ON public.application_events FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "app_events_insert" ON public.application_events FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));

CREATE TRIGGER trg_app_events_org BEFORE INSERT ON public.application_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_org_id();

CREATE INDEX IF NOT EXISTS idx_app_events_application ON public.application_events(application_id, created_at DESC);
