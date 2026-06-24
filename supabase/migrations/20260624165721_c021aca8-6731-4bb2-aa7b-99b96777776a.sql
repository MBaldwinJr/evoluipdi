
-- Tighten storage.objects policies for pt-selfies bucket.
-- Uploads/reads happen server-side via service role; restrict direct client mutations.

DROP POLICY IF EXISTS pt_selfies_insert ON storage.objects;
DROP POLICY IF EXISTS pt_selfies_select ON storage.objects;
DROP POLICY IF EXISTS pt_selfies_update ON storage.objects;
DROP POLICY IF EXISTS pt_selfies_delete ON storage.objects;

-- SELECT: company admins/RH may list/read; regular members cannot browse arbitrarily.
CREATE POLICY pt_selfies_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pt-selfies'
  AND public.pt_has_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['admin','rh']::public.pt_role[]
      )
);

-- INSERT: only the employee themselves may upload into their own folder
-- path layout: {company_id}/{employee_id}/{file}
CREATE POLICY pt_selfies_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pt-selfies'
  AND EXISTS (
    SELECT 1 FROM public.pt_employees e
    WHERE e.id::text = (storage.foldername(name))[2]
      AND e.company_id::text = (storage.foldername(name))[1]
      AND e.user_id = auth.uid()
  )
);

-- UPDATE: only company admins/RH
CREATE POLICY pt_selfies_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'pt-selfies'
  AND public.pt_has_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['admin','rh']::public.pt_role[]
      )
)
WITH CHECK (
  bucket_id = 'pt-selfies'
  AND public.pt_has_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['admin','rh']::public.pt_role[]
      )
);

-- DELETE: only company admins/RH
CREATE POLICY pt_selfies_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pt-selfies'
  AND public.pt_has_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['admin','rh']::public.pt_role[]
      )
);
