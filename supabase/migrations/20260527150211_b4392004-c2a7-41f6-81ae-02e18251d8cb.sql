DROP POLICY IF EXISTS "cv_rh_or_owner_update" ON storage.objects;
CREATE POLICY "cv_rh_or_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
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
  )
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