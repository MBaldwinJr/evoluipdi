
CREATE TABLE IF NOT EXISTS public.org_email_settings (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  secure boolean NOT NULL DEFAULT false,
  username text NOT NULL,
  password text NOT NULL,
  from_name text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.org_email_settings TO service_role;
ALTER TABLE public.org_email_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, template_key)
);
CREATE INDEX IF NOT EXISTS idx_org_email_templates_org ON public.org_email_templates(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_email_templates TO authenticated;
GRANT ALL ON public.org_email_templates TO service_role;
ALTER TABLE public.org_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY oet_select ON public.org_email_templates FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]));
CREATE POLICY oet_write ON public.org_email_templates FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]));

CREATE TABLE IF NOT EXISTS public.org_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  template_key text,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed','fallback','skipped')),
  sender text NOT NULL CHECK (sender IN ('org_smtp','platform_default','none')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_email_outbox_org_created ON public.org_email_outbox(org_id, created_at DESC);
GRANT SELECT ON public.org_email_outbox TO authenticated;
GRANT ALL ON public.org_email_outbox TO service_role;
ALTER TABLE public.org_email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY oeo_select ON public.org_email_outbox FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['admin','rh']::public.org_role[]));

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_oes_updated ON public.org_email_settings;
CREATE TRIGGER trg_oes_updated BEFORE UPDATE ON public.org_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_oet_updated ON public.org_email_templates;
CREATE TRIGGER trg_oet_updated BEFORE UPDATE ON public.org_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
