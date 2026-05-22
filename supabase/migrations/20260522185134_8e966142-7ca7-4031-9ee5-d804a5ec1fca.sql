
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_name TEXT,
  trade_name TEXT,
  cnpj TEXT,
  cnae_code TEXT,
  cnae_description TEXT,
  segment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_read ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY cs_rh_write ON public.company_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'rh'::app_role)) WITH CHECK (has_role(auth.uid(), 'rh'::app_role));
CREATE TRIGGER company_settings_set_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.role_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL,
  title TEXT NOT NULL,
  objective TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  tools TEXT,
  success_criteria TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX role_processes_role_idx ON public.role_processes(role_id);
ALTER TABLE public.role_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_read ON public.role_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_rh_write ON public.role_processes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'rh'::app_role)) WITH CHECK (has_role(auth.uid(), 'rh'::app_role));
CREATE TRIGGER role_processes_set_updated_at BEFORE UPDATE ON public.role_processes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
