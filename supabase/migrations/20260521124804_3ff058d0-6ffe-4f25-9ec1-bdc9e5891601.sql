-- Candidate invites for pre-hire selection interviews
CREATE TABLE public.candidate_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  candidate_name text NOT NULL,
  candidate_email text,
  candidate_phone text,
  role_id uuid NOT NULL REFERENCES public.roles_catalog(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.interview_templates(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente', -- pendente | respondido | analisado | descartado
  answers jsonb,
  notes text,
  analysis jsonb,
  analyzed_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cand_inv_rh_all" ON public.candidate_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'rh'::app_role) OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'rh'::app_role) OR created_by = auth.uid());

CREATE TRIGGER trg_cand_inv_updated BEFORE UPDATE ON public.candidate_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_cand_inv_token ON public.candidate_invites(token);
CREATE INDEX idx_cand_inv_created_by ON public.candidate_invites(created_by);
CREATE INDEX idx_cand_inv_role ON public.candidate_invites(role_id);