
-- Add recruitment fields to candidate_invites
ALTER TABLE public.candidate_invites
  ADD COLUMN IF NOT EXISTS cv_path text,
  ADD COLUMN IF NOT EXISTS cv_filename text,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS cv_analysis jsonb,
  ADD COLUMN IF NOT EXISTS cv_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS presential_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS presential_at timestamptz,
  ADD COLUMN IF NOT EXISTS presential_notes text,
  ADD COLUMN IF NOT EXISTS hire_status text NOT NULL DEFAULT 'em_processo',
  ADD COLUMN IF NOT EXISTS hired_at timestamptz,
  ADD COLUMN IF NOT EXISTS hired_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- Validation: allowed hire_status values
DO $$ BEGIN
  ALTER TABLE public.candidate_invites
    ADD CONSTRAINT candidate_invites_hire_status_chk
    CHECK (hire_status IN ('em_processo','aprovado','contratado','reprovado','desistiu'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage bucket for candidate CVs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-cvs', 'candidate-cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only RH or the invite creator can read/write CVs.
-- (Anonymous candidate uploads go through the public route handler using the service-role client.)
DROP POLICY IF EXISTS "cv_rh_or_owner_read" ON storage.objects;
CREATE POLICY "cv_rh_or_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'candidate-cvs'
    AND (
      public.has_role(auth.uid(), 'rh'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.candidate_invites ci
        WHERE ci.id::text = split_part(name, '/', 1)
          AND ci.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "cv_rh_or_owner_write" ON storage.objects;
CREATE POLICY "cv_rh_or_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-cvs'
    AND (
      public.has_role(auth.uid(), 'rh'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.candidate_invites ci
        WHERE ci.id::text = split_part(name, '/', 1)
          AND ci.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "cv_rh_or_owner_delete" ON storage.objects;
CREATE POLICY "cv_rh_or_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'candidate-cvs'
    AND (
      public.has_role(auth.uid(), 'rh'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.candidate_invites ci
        WHERE ci.id::text = split_part(name, '/', 1)
          AND ci.created_by = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_cand_inv_hire_status ON public.candidate_invites(hire_status);
