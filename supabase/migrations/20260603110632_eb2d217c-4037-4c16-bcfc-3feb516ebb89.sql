
-- 1) Trial em orgs
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
UPDATE public.orgs SET trial_ends_at = COALESCE(trial_ends_at, now() + interval '14 days');
ALTER TABLE public.orgs ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '14 days');
ALTER TABLE public.orgs ALTER COLUMN trial_ends_at SET NOT NULL;

-- 2) org_subscriptions
CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  plan_code public.plan_code NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'trialing',
  interval text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.org_subscriptions TO authenticated;
GRANT ALL ON public.org_subscriptions TO service_role;

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_select_org_members"
ON public.org_subscriptions
FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER trg_sub_updated_at
BEFORE UPDATE ON public.org_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) leads (formulário público de contato)
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  message text,
  source text DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.leads TO anon;
GRANT INSERT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_anon_insert"
ON public.leads
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "leads_auth_insert"
ON public.leads
FOR INSERT TO authenticated
WITH CHECK (true);

-- 4) Função utilitária: org ativa (trial OU assinatura ativa)
CREATE OR REPLACE FUNCTION public.org_is_active(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orgs o
    LEFT JOIN public.org_subscriptions s ON s.org_id = o.id
    WHERE o.id = _org_id
      AND (
        o.trial_ends_at > now()
        OR s.status IN ('active','trialing','past_due')
      )
  )
$$;

-- 5) Seed subscription para orgs existentes (free, trialing)
INSERT INTO public.org_subscriptions (org_id, plan_code, status)
SELECT o.id, COALESCE((SELECT p.plan_code FROM public.org_plans p WHERE p.org_id = o.id AND p.active LIMIT 1), 'free'), 'trialing'
FROM public.orgs o
ON CONFLICT (org_id) DO NOTHING;
