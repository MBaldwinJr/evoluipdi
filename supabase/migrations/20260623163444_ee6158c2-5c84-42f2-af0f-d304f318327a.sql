
-- Public function: list open jobs across all orgs
CREATE OR REPLACE FUNCTION public.public_list_jobs(
  _search text DEFAULT NULL,
  _work_model text DEFAULT NULL,
  _employment_type text DEFAULT NULL,
  _limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  company_name text,
  title text,
  location text,
  work_model text,
  employment_type text,
  salary_min int,
  salary_max int,
  benefits jsonb,
  department_name text,
  closing_date date,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.org_id,
         COALESCE(o.trade_name, o.legal_name) AS company_name,
         j.title, j.location,
         j.work_model::text, j.employment_type::text,
         j.salary_min, j.salary_max, j.benefits,
         d.name AS department_name,
         j.closing_date, j.created_at
  FROM public.jobs j
  JOIN public.orgs o ON o.id = j.org_id
  LEFT JOIN public.departments d ON d.id = j.department_id
  WHERE j.status = 'open'
    AND (j.closing_date IS NULL OR j.closing_date >= CURRENT_DATE)
    AND (_search IS NULL OR _search = '' OR (
      j.title ILIKE '%'||_search||'%'
      OR COALESCE(j.location,'') ILIKE '%'||_search||'%'
      OR COALESCE(o.trade_name, o.legal_name) ILIKE '%'||_search||'%'
    ))
    AND (_work_model IS NULL OR _work_model = '' OR j.work_model::text = _work_model)
    AND (_employment_type IS NULL OR _employment_type = '' OR j.employment_type::text = _employment_type)
  ORDER BY j.created_at DESC
  LIMIT COALESCE(_limit, 100);
$$;

-- Public function: get a single open job
CREATE OR REPLACE FUNCTION public.public_get_job(_job_id uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  company_name text,
  title text,
  location text,
  work_model text,
  employment_type text,
  salary_min int,
  salary_max int,
  benefits jsonb,
  requirements text,
  responsibilities text,
  description text,
  department_name text,
  closing_date date,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.org_id,
         COALESCE(o.trade_name, o.legal_name) AS company_name,
         j.title, j.location,
         j.work_model::text, j.employment_type::text,
         j.salary_min, j.salary_max, j.benefits,
         j.requirements, j.responsibilities, j.description,
         d.name AS department_name,
         j.closing_date, j.created_at
  FROM public.jobs j
  JOIN public.orgs o ON o.id = j.org_id
  LEFT JOIN public.departments d ON d.id = j.department_id
  WHERE j.id = _job_id
    AND j.status = 'open'
    AND (j.closing_date IS NULL OR j.closing_date >= CURRENT_DATE);
$$;

GRANT EXECUTE ON FUNCTION public.public_list_jobs(text, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_job(uuid) TO anon, authenticated;

-- Public function: submit application (creates talent + application)
CREATE OR REPLACE FUNCTION public.public_apply_to_job(
  _job_id uuid,
  _full_name text,
  _email text,
  _phone text,
  _location text,
  _linkedin_url text,
  _current_position text,
  _years_experience int,
  _summary text,
  _cv_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _talent_id uuid;
  _app_id uuid;
BEGIN
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;

  SELECT org_id INTO _org FROM public.jobs
    WHERE id = _job_id AND status = 'open'
      AND (closing_date IS NULL OR closing_date >= CURRENT_DATE);
  IF _org IS NULL THEN
    RAISE EXCEPTION 'job not available';
  END IF;

  -- Reuse talent if email exists in same org, otherwise insert
  IF _email IS NOT NULL AND length(_email) > 0 THEN
    SELECT id INTO _talent_id FROM public.talent_pool
      WHERE org_id = _org AND lower(email) = lower(_email) LIMIT 1;
  END IF;

  IF _talent_id IS NULL THEN
    INSERT INTO public.talent_pool (
      org_id, full_name, email, phone, location, linkedin_url,
      current_position, years_experience, summary, cv_url, source, status
    ) VALUES (
      _org, trim(_full_name), NULLIF(_email,''), NULLIF(_phone,''),
      NULLIF(_location,''), NULLIF(_linkedin_url,''),
      NULLIF(_current_position,''), COALESCE(_years_experience,0),
      NULLIF(_summary,''), NULLIF(_cv_url,''),
      'application', 'active'
    ) RETURNING id INTO _talent_id;
  ELSE
    UPDATE public.talent_pool SET
      phone = COALESCE(NULLIF(_phone,''), phone),
      location = COALESCE(NULLIF(_location,''), location),
      linkedin_url = COALESCE(NULLIF(_linkedin_url,''), linkedin_url),
      current_position = COALESCE(NULLIF(_current_position,''), current_position),
      years_experience = COALESCE(_years_experience, years_experience),
      summary = COALESCE(NULLIF(_summary,''), summary),
      cv_url = COALESCE(NULLIF(_cv_url,''), cv_url),
      updated_at = now()
    WHERE id = _talent_id;
  END IF;

  -- Avoid duplicate application for same job
  SELECT id INTO _app_id FROM public.applications
    WHERE job_id = _job_id AND talent_id = _talent_id LIMIT 1;
  IF _app_id IS NULL THEN
    INSERT INTO public.applications (org_id, job_id, talent_id, stage, stage_order)
    VALUES (_org, _job_id, _talent_id, 'applied', 0)
    RETURNING id INTO _app_id;
  END IF;

  RETURN _app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_apply_to_job(uuid, text, text, text, text, text, text, int, text, text) TO anon, authenticated;

-- Storage: allow anon uploads to 'public/' prefix of candidate-cvs bucket
DROP POLICY IF EXISTS "Anon can upload public CVs" ON storage.objects;
CREATE POLICY "Anon can upload public CVs"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'candidate-cvs'
  AND (storage.foldername(name))[1] = 'public'
);

-- Indexes for portal
CREATE INDEX IF NOT EXISTS idx_jobs_status_open ON public.jobs (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON public.jobs USING gin (title gin_trgm_ops);
