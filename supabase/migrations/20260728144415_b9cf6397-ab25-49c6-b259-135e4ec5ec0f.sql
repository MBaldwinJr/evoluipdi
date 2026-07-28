
-- Enums
DO $$ BEGIN
  CREATE TYPE public.pt_vacation_status AS ENUM (
    'solicitada','aprovada_gestor','aprovada_rh','agendada','em_curso','concluida','rejeitada','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.pt_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.pt_companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.pt_employees(id) ON DELETE CASCADE,
  -- Acquisition period (12 months after admission or since last vacation)
  acquisition_start date NOT NULL,
  acquisition_end date NOT NULL,
  -- Concessive period (CLT: 12 months after acquisition_end)
  concessive_deadline date NOT NULL,
  -- Enjoyment period
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_total integer NOT NULL,
  -- Optional splits (informational)
  abono_days integer NOT NULL DEFAULT 0,        -- venda de 1/3 (até 10 dias)
  advance_13 boolean NOT NULL DEFAULT false,    -- adiantamento do 13º
  status public.pt_vacation_status NOT NULL DEFAULT 'solicitada',
  requested_by uuid NOT NULL,
  approved_by_manager uuid,
  approved_by_manager_at timestamptz,
  approved_by_rh uuid,
  approved_by_rh_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pt_vacations_dates_chk CHECK (end_date >= start_date),
  CONSTRAINT pt_vacations_abono_chk CHECK (abono_days >= 0 AND abono_days <= 10),
  CONSTRAINT pt_vacations_days_chk CHECK (days_total > 0 AND days_total <= 30)
);

CREATE INDEX IF NOT EXISTS pt_vacations_company_idx ON public.pt_vacations(company_id, start_date);
CREATE INDEX IF NOT EXISTS pt_vacations_employee_idx ON public.pt_vacations(employee_id, start_date);
CREATE INDEX IF NOT EXISTS pt_vacations_status_idx ON public.pt_vacations(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_vacations TO authenticated;
GRANT ALL ON public.pt_vacations TO service_role;
ALTER TABLE public.pt_vacations ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "pt_vacations_select_member" ON public.pt_vacations FOR SELECT TO authenticated
USING (
  public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor','supervisor','auditor']::pt_role[])
  OR EXISTS (SELECT 1 FROM public.pt_employees e WHERE e.id = pt_vacations.employee_id AND e.user_id = auth.uid())
);

CREATE POLICY "pt_vacations_insert_self_or_rh" ON public.pt_vacations FOR INSERT TO authenticated
WITH CHECK (
  public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor']::pt_role[])
  OR EXISTS (SELECT 1 FROM public.pt_employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
);

CREATE POLICY "pt_vacations_update_manager_rh" ON public.pt_vacations FOR UPDATE TO authenticated
USING (
  public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor']::pt_role[])
  OR (
    EXISTS (SELECT 1 FROM public.pt_employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
    AND status = 'solicitada'
  )
)
WITH CHECK (
  public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor']::pt_role[])
  OR EXISTS (SELECT 1 FROM public.pt_employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
);

CREATE POLICY "pt_vacations_delete_rh" ON public.pt_vacations FOR DELETE TO authenticated
USING (public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh']::pt_role[]));

CREATE TRIGGER pt_vacations_updated_at BEFORE UPDATE ON public.pt_vacations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Event log
CREATE TABLE IF NOT EXISTS public.pt_vacation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacation_id uuid NOT NULL REFERENCES public.pt_vacations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  from_status public.pt_vacation_status,
  to_status public.pt_vacation_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_vacation_events_vac_idx ON public.pt_vacation_events(vacation_id, created_at);
GRANT SELECT, INSERT ON public.pt_vacation_events TO authenticated;
GRANT ALL ON public.pt_vacation_events TO service_role;
ALTER TABLE public.pt_vacation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_vac_ev_select" ON public.pt_vacation_events FOR SELECT TO authenticated
USING (
  public.pt_has_role(auth.uid(), company_id, ARRAY['admin','rh','gestor','supervisor','auditor']::pt_role[])
  OR EXISTS (
    SELECT 1 FROM public.pt_vacations v JOIN public.pt_employees e ON e.id = v.employee_id
    WHERE v.id = pt_vacation_events.vacation_id AND e.user_id = auth.uid()
  )
);
CREATE POLICY "pt_vac_ev_insert" ON public.pt_vacation_events FOR INSERT TO authenticated
WITH CHECK (public.pt_is_member(auth.uid(), company_id));
