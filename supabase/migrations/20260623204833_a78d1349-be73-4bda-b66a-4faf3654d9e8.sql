
CREATE TYPE public.candidate_interview_status AS ENUM ('scheduled','completed','cancelled','no_show');
CREATE TYPE public.candidate_interview_mode AS ENUM ('online','presencial','telefone');

CREATE TABLE public.candidate_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 45,
  mode public.candidate_interview_mode NOT NULL DEFAULT 'online',
  location text,
  meeting_url text,
  interviewer_user_id uuid,
  interviewer_name text,
  status public.candidate_interview_status NOT NULL DEFAULT 'scheduled',
  notes text,
  reminder_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidate_interviews_org_time ON public.candidate_interviews(org_id, scheduled_at);
CREATE INDEX idx_candidate_interviews_application ON public.candidate_interviews(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_interviews TO authenticated;
GRANT ALL ON public.candidate_interviews TO service_role;

ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_select_org" ON public.candidate_interviews
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "ci_insert_admin_rh" ON public.candidate_interviews
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));

CREATE POLICY "ci_update_admin_rh" ON public.candidate_interviews
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));

CREATE POLICY "ci_delete_admin_rh" ON public.candidate_interviews
  FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::org_role[]));

CREATE TRIGGER trg_ci_updated_at BEFORE UPDATE ON public.candidate_interviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
