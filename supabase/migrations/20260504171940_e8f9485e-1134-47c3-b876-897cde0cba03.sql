
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('colaborador', 'gestor', 'rh');
CREATE TYPE public.rcf_item_kind AS ENUM ('responsabilidade', 'competencia_tecnica', 'competencia_comportamental', 'indicador');
CREATE TYPE public.interview_kind AS ENUM ('inicial', 'periodica', 'avaliacao');
CREATE TYPE public.performance_level AS ENUM ('abaixo', 'dentro', 'acima');
CREATE TYPE public.feedback_kind AS ENUM ('informal', 'formal');
CREATE TYPE public.pdi_status AS ENUM ('rascunho', 'aguardando_validacao', 'aprovado', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.action_category AS ENUM ('pratica', 'troca', 'formal');
CREATE TYPE public.action_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.objective_horizon AS ENUM ('curto', 'medio', 'longo');
CREATE TYPE public.gap_severity AS ENUM ('baixa', 'media', 'alta');

-- ============ PROFILES & ROLES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function — prevents recursion in RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_rh(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'rh') $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  -- Default role: colaborador
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ CATALOG ============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.roles_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.roles_catalog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_roles_catalog_updated BEFORE UPDATE ON public.roles_catalog
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.rcf_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles_catalog(id) ON DELETE CASCADE,
  kind rcf_item_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  expected_level INT NOT NULL DEFAULT 3 CHECK (expected_level BETWEEN 1 AND 5),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rcf_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rcf_items_role ON public.rcf_items(role_id);

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  role_id UUID REFERENCES public.roles_catalog(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  hire_date DATE,
  career_goals TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employees_manager ON public.employees(manager_id);
CREATE TRIGGER tg_employees_updated BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: is current user the manager of given employee (by employee user_id)?
CREATE OR REPLACE FUNCTION public.is_manager_of(_user_id UUID, _employee_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.employees mgr ON mgr.id = e.manager_id
    WHERE e.user_id = _employee_user_id AND mgr.user_id = _user_id
  )
$$;

-- ============ INTERVIEWS ============
CREATE TABLE public.interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles_catalog(id) ON DELETE CASCADE,
  kind interview_kind NOT NULL,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  conducted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.interview_templates(id) ON DELETE SET NULL,
  kind interview_kind NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  overall_level performance_level,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_interviews_employee ON public.interviews(employee_id);

CREATE TABLE public.interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  rcf_item_id UUID REFERENCES public.rcf_items(id) ON DELETE SET NULL,
  observed_level INT CHECK (observed_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_answers_interview ON public.interview_answers(interview_id);

-- ============ EVALUATIONS ============
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  cycle_label TEXT,
  overall_level performance_level NOT NULL,
  fact TEXT NOT NULL,
  impact TEXT NOT NULL,
  next_step TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_evaluations_employee ON public.evaluations(employee_id);

CREATE TABLE public.evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  rcf_item_id UUID NOT NULL REFERENCES public.rcf_items(id) ON DELETE CASCADE,
  expected_level INT NOT NULL CHECK (expected_level BETWEEN 1 AND 5),
  observed_level INT NOT NULL CHECK (observed_level BETWEEN 1 AND 5),
  level performance_level NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluation_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_scores_eval ON public.evaluation_scores(evaluation_id);

-- ============ FEEDBACKS ============
CREATE TABLE public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  kind feedback_kind NOT NULL DEFAULT 'informal',
  fact TEXT NOT NULL,
  impact TEXT,
  next_step TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedbacks_employee ON public.feedbacks(employee_id);

-- ============ GAPS ============
CREATE TABLE public.gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  rcf_item_id UUID REFERENCES public.rcf_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity gap_severity NOT NULL DEFAULT 'media',
  justification TEXT,
  root_cause TEXT,
  source TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gaps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_gaps_employee ON public.gaps(employee_id);

-- ============ PDI ============
CREATE TABLE public.pdis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  horizon objective_horizon NOT NULL DEFAULT 'medio',
  status pdi_status NOT NULL DEFAULT 'rascunho',
  due_date DATE,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pdis ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pdis_employee ON public.pdis(employee_id);
CREATE TRIGGER tg_pdis_updated BEFORE UPDATE ON public.pdis
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.pdi_development_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  gap_id UUID REFERENCES public.gaps(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  success_criteria TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pdi_development_points ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pdi_points ON public.pdi_development_points(pdi_id);

CREATE TABLE public.pdi_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_point_id UUID NOT NULL REFERENCES public.pdi_development_points(id) ON DELETE CASCADE,
  category action_category NOT NULL,
  description TEXT NOT NULL,
  status action_status NOT NULL DEFAULT 'pendente',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pdi_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pdi_actions_point ON public.pdi_actions(development_point_id);

-- ============ CHECK-INS & LEARNING LOGS ============
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  pdi_id UUID REFERENCES public.pdis(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_checkins_employee ON public.checkins(employee_id);

CREATE TABLE public.learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  pdi_action_id UUID REFERENCES public.pdi_actions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_learning_employee ON public.learning_logs(employee_id);

-- ============ RLS POLICIES ============

-- profiles: each user sees own; RH sees all; managers see direct reports
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'rh') OR public.is_manager_of(auth.uid(), id));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'rh'));
CREATE POLICY "profiles_rh_insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'rh') OR id = auth.uid());

-- user_roles: only RH manages; users can read own
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'rh'));
CREATE POLICY "roles_rh_all" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'rh')) WITH CHECK (public.has_role(auth.uid(), 'rh'));

-- departments / roles_catalog / rcf_items: read by all authenticated, write only RH
CREATE POLICY "dept_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_rh_write" ON public.departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'rh')) WITH CHECK (public.has_role(auth.uid(), 'rh'));

CREATE POLICY "roles_cat_read" ON public.roles_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_cat_rh_write" ON public.roles_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'rh')) WITH CHECK (public.has_role(auth.uid(), 'rh'));

CREATE POLICY "rcf_read" ON public.rcf_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "rcf_rh_write" ON public.rcf_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'rh')) WITH CHECK (public.has_role(auth.uid(), 'rh'));

CREATE POLICY "tpl_read" ON public.interview_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tpl_rh_write" ON public.interview_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'rh')) WITH CHECK (public.has_role(auth.uid(), 'rh'));

-- employees: self read; manager reads reports; RH all; RH writes
CREATE POLICY "emp_select" ON public.employees FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'rh')
  OR EXISTS (SELECT 1 FROM public.employees mgr WHERE mgr.id = employees.manager_id AND mgr.user_id = auth.uid())
);
CREATE POLICY "emp_rh_write" ON public.employees FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'rh')) WITH CHECK (public.has_role(auth.uid(), 'rh'));
CREATE POLICY "emp_self_update_goals" ON public.employees FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Helper for manager-of-employee (by employees.id)
CREATE OR REPLACE FUNCTION public.is_manager_of_emp(_user_id UUID, _employee_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.employees mgr ON mgr.id = e.manager_id
    WHERE e.id = _employee_id AND mgr.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_self_emp(_user_id UUID, _employee_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = _employee_id AND e.user_id = _user_id)
$$;

-- interviews
CREATE POLICY "interviews_read" ON public.interviews FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "interviews_write" ON public.interviews FOR INSERT TO authenticated
WITH CHECK (
  conducted_by = auth.uid() AND (
    public.is_manager_of_emp(auth.uid(), employee_id)
    OR public.has_role(auth.uid(), 'rh')
  )
);
CREATE POLICY "interviews_update" ON public.interviews FOR UPDATE TO authenticated
USING (conducted_by = auth.uid() OR public.has_role(auth.uid(), 'rh'));

CREATE POLICY "answers_read" ON public.interview_answers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_id
  AND (public.is_self_emp(auth.uid(), i.employee_id) OR public.is_manager_of_emp(auth.uid(), i.employee_id) OR public.has_role(auth.uid(), 'rh'))));
CREATE POLICY "answers_write" ON public.interview_answers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_id
  AND (i.conducted_by = auth.uid() OR public.has_role(auth.uid(), 'rh'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_id
  AND (i.conducted_by = auth.uid() OR public.has_role(auth.uid(), 'rh'))));

-- evaluations
CREATE POLICY "evals_read" ON public.evaluations FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "evals_write" ON public.evaluations FOR INSERT TO authenticated
WITH CHECK (evaluator_id = auth.uid() AND (
  public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh')
));
CREATE POLICY "evals_update" ON public.evaluations FOR UPDATE TO authenticated
USING (evaluator_id = auth.uid() OR public.has_role(auth.uid(), 'rh'));

CREATE POLICY "scores_read" ON public.evaluation_scores FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id
  AND (public.is_self_emp(auth.uid(), e.employee_id) OR public.is_manager_of_emp(auth.uid(), e.employee_id) OR public.has_role(auth.uid(), 'rh'))));
CREATE POLICY "scores_write" ON public.evaluation_scores FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id
  AND (e.evaluator_id = auth.uid() OR public.has_role(auth.uid(), 'rh'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id
  AND (e.evaluator_id = auth.uid() OR public.has_role(auth.uid(), 'rh'))));

-- feedbacks
CREATE POLICY "fb_read" ON public.feedbacks FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR author_id = auth.uid()
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "fb_write" ON public.feedbacks FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());
CREATE POLICY "fb_update" ON public.feedbacks FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'rh'));

-- gaps
CREATE POLICY "gaps_read" ON public.gaps FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "gaps_write" ON public.gaps FOR ALL TO authenticated
USING (public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh') OR public.is_self_emp(auth.uid(), employee_id))
WITH CHECK (public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh') OR public.is_self_emp(auth.uid(), employee_id));

-- pdis
CREATE POLICY "pdi_read" ON public.pdis FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "pdi_write" ON public.pdis FOR ALL TO authenticated
USING (public.is_self_emp(auth.uid(), employee_id) OR public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh'))
WITH CHECK (public.is_self_emp(auth.uid(), employee_id) OR public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh'));

CREATE POLICY "pdi_pts_read" ON public.pdi_development_points FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.pdis p WHERE p.id = pdi_id
  AND (public.is_self_emp(auth.uid(), p.employee_id) OR public.is_manager_of_emp(auth.uid(), p.employee_id) OR public.has_role(auth.uid(), 'rh'))));
CREATE POLICY "pdi_pts_write" ON public.pdi_development_points FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.pdis p WHERE p.id = pdi_id
  AND (public.is_self_emp(auth.uid(), p.employee_id) OR public.is_manager_of_emp(auth.uid(), p.employee_id) OR public.has_role(auth.uid(), 'rh'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.pdis p WHERE p.id = pdi_id
  AND (public.is_self_emp(auth.uid(), p.employee_id) OR public.is_manager_of_emp(auth.uid(), p.employee_id) OR public.has_role(auth.uid(), 'rh'))));

CREATE POLICY "pdi_act_read" ON public.pdi_actions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.pdi_development_points dp
  JOIN public.pdis p ON p.id = dp.pdi_id
  WHERE dp.id = development_point_id
  AND (public.is_self_emp(auth.uid(), p.employee_id) OR public.is_manager_of_emp(auth.uid(), p.employee_id) OR public.has_role(auth.uid(), 'rh'))));
CREATE POLICY "pdi_act_write" ON public.pdi_actions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.pdi_development_points dp
  JOIN public.pdis p ON p.id = dp.pdi_id
  WHERE dp.id = development_point_id
  AND (public.is_self_emp(auth.uid(), p.employee_id) OR public.is_manager_of_emp(auth.uid(), p.employee_id) OR public.has_role(auth.uid(), 'rh'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.pdi_development_points dp
  JOIN public.pdis p ON p.id = dp.pdi_id
  WHERE dp.id = development_point_id
  AND (public.is_self_emp(auth.uid(), p.employee_id) OR public.is_manager_of_emp(auth.uid(), p.employee_id) OR public.has_role(auth.uid(), 'rh'))));

-- checkins
CREATE POLICY "ck_read" ON public.checkins FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "ck_write" ON public.checkins FOR ALL TO authenticated
USING (public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh') OR public.is_self_emp(auth.uid(), employee_id))
WITH CHECK (public.is_manager_of_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh') OR public.is_self_emp(auth.uid(), employee_id));

-- learning_logs
CREATE POLICY "ll_read" ON public.learning_logs FOR SELECT TO authenticated
USING (
  public.is_self_emp(auth.uid(), employee_id)
  OR public.is_manager_of_emp(auth.uid(), employee_id)
  OR public.has_role(auth.uid(), 'rh')
);
CREATE POLICY "ll_write" ON public.learning_logs FOR ALL TO authenticated
USING (public.is_self_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh'))
WITH CHECK (public.is_self_emp(auth.uid(), employee_id) OR public.has_role(auth.uid(), 'rh'));
