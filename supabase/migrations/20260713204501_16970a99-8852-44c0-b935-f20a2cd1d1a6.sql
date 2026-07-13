
-- 1) PROFILES: escopar RH por empresa
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_rh_insert  ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = public.profiles.id
        AND public.has_org_role(auth.uid(), om.org_id, ARRAY['admin'::org_role,'rh'::org_role])
    )
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = public.profiles.id
        AND public.has_org_role(auth.uid(), om.org_id, ARRAY['admin'::org_role,'rh'::org_role])
    )
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 2) EVALUATION_SCORES: escopar via evaluations.org_id
DROP POLICY IF EXISTS scores_read  ON public.evaluation_scores;
DROP POLICY IF EXISTS scores_write ON public.evaluation_scores;

CREATE POLICY scores_read ON public.evaluation_scores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evaluation_scores.evaluation_id
      AND public.is_org_member(auth.uid(), e.org_id)
      AND (
        public.is_self_emp(auth.uid(), e.employee_id)
        OR public.is_manager_of_emp(auth.uid(), e.employee_id)
        OR public.has_org_role(auth.uid(), e.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

CREATE POLICY scores_write ON public.evaluation_scores
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evaluation_scores.evaluation_id
      AND (
        e.evaluator_id = auth.uid()
        OR public.has_org_role(auth.uid(), e.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evaluation_scores.evaluation_id
      AND (
        e.evaluator_id = auth.uid()
        OR public.has_org_role(auth.uid(), e.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

-- 3) INTERVIEW_ANSWERS: escopar via interviews.org_id
DROP POLICY IF EXISTS answers_read  ON public.interview_answers;
DROP POLICY IF EXISTS answers_write ON public.interview_answers;

CREATE POLICY answers_read ON public.interview_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_answers.interview_id
      AND public.is_org_member(auth.uid(), i.org_id)
      AND (
        public.is_self_emp(auth.uid(), i.employee_id)
        OR public.is_manager_of_emp(auth.uid(), i.employee_id)
        OR i.conducted_by = auth.uid()
        OR public.has_org_role(auth.uid(), i.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

CREATE POLICY answers_write ON public.interview_answers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_answers.interview_id
      AND (
        i.conducted_by = auth.uid()
        OR public.has_org_role(auth.uid(), i.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_answers.interview_id
      AND (
        i.conducted_by = auth.uid()
        OR public.has_org_role(auth.uid(), i.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

-- 4) PDI_DEVELOPMENT_POINTS: escopar via pdis.org_id
DROP POLICY IF EXISTS pdi_pts_read  ON public.pdi_development_points;
DROP POLICY IF EXISTS pdi_pts_write ON public.pdi_development_points;

CREATE POLICY pdi_pts_read ON public.pdi_development_points
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pdis p
    WHERE p.id = pdi_development_points.pdi_id
      AND public.is_org_member(auth.uid(), p.org_id)
      AND (
        public.is_self_emp(auth.uid(), p.employee_id)
        OR public.is_manager_of_emp(auth.uid(), p.employee_id)
        OR public.has_org_role(auth.uid(), p.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

CREATE POLICY pdi_pts_write ON public.pdi_development_points
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pdis p
    WHERE p.id = pdi_development_points.pdi_id
      AND public.is_org_member(auth.uid(), p.org_id)
      AND (
        public.is_self_emp(auth.uid(), p.employee_id)
        OR public.is_manager_of_emp(auth.uid(), p.employee_id)
        OR public.has_org_role(auth.uid(), p.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pdis p
    WHERE p.id = pdi_development_points.pdi_id
      AND public.is_org_member(auth.uid(), p.org_id)
      AND (
        public.is_self_emp(auth.uid(), p.employee_id)
        OR public.is_manager_of_emp(auth.uid(), p.employee_id)
        OR public.has_org_role(auth.uid(), p.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

-- 5) PDI_ACTIONS: escopar via pdi_development_points -> pdis.org_id
DROP POLICY IF EXISTS pdi_act_read  ON public.pdi_actions;
DROP POLICY IF EXISTS pdi_act_write ON public.pdi_actions;

CREATE POLICY pdi_act_read ON public.pdi_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pdi_development_points dp
    JOIN public.pdis p ON p.id = dp.pdi_id
    WHERE dp.id = pdi_actions.development_point_id
      AND public.is_org_member(auth.uid(), p.org_id)
      AND (
        public.is_self_emp(auth.uid(), p.employee_id)
        OR public.is_manager_of_emp(auth.uid(), p.employee_id)
        OR public.has_org_role(auth.uid(), p.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

CREATE POLICY pdi_act_write ON public.pdi_actions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pdi_development_points dp
    JOIN public.pdis p ON p.id = dp.pdi_id
    WHERE dp.id = pdi_actions.development_point_id
      AND public.is_org_member(auth.uid(), p.org_id)
      AND (
        public.is_self_emp(auth.uid(), p.employee_id)
        OR public.is_manager_of_emp(auth.uid(), p.employee_id)
        OR public.has_org_role(auth.uid(), p.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pdi_development_points dp
    JOIN public.pdis p ON p.id = dp.pdi_id
    WHERE dp.id = pdi_actions.development_point_id
      AND public.is_org_member(auth.uid(), p.org_id)
      AND (
        public.is_self_emp(auth.uid(), p.employee_id)
        OR public.is_manager_of_emp(auth.uid(), p.employee_id)
        OR public.has_org_role(auth.uid(), p.org_id, ARRAY['admin'::org_role,'rh'::org_role])
      )
  ));

-- 6) STORAGE: remover upload anônimo (uploads públicos passam pelo servidor)
DROP POLICY IF EXISTS "Anon can upload public CVs" ON storage.objects;

-- 7) Revogar EXECUTE público em função interna de trigger
REVOKE ALL ON FUNCTION public.tg_quality_occurrence_code() FROM PUBLIC, anon, authenticated;
