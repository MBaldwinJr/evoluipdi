
-- 1) Revoke EXECUTE from anon and public on SECURITY DEFINER helper functions.
-- These are used by RLS policies via auth.uid(); they should only be callable by authenticated users.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 2) Tighten leads INSERT policies with basic validation (length + email format).
DROP POLICY IF EXISTS leads_anon_insert ON public.leads;
DROP POLICY IF EXISTS leads_auth_insert ON public.leads;

CREATE POLICY leads_anon_insert ON public.leads
  FOR INSERT TO anon
  WITH CHECK (
    length(name)  BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (phone   IS NULL OR length(phone)   <= 40)
    AND (company IS NULL OR length(company) <= 160)
    AND (message IS NULL OR length(message) <= 2000)
    AND (source  IS NULL OR length(source)  <= 80)
  );

CREATE POLICY leads_auth_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    length(name)  BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (phone   IS NULL OR length(phone)   <= 40)
    AND (company IS NULL OR length(company) <= 160)
    AND (message IS NULL OR length(message) <= 2000)
    AND (source  IS NULL OR length(source)  <= 80)
  );
