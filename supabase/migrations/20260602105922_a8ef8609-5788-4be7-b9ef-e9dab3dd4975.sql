-- Add default current_org_id() to org_id columns so inserts can omit it.
-- The existing tg_set_org_id trigger function isn't attached; using DEFAULT
-- makes the column optional in the generated Insert types as well.

ALTER TABLE public.employees           ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.departments         ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.roles_catalog       ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.role_processes      ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.rcf_items           ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.interview_templates ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.interviews          ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.evaluations         ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.gaps                ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.pdis                ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.learning_logs       ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.checkins            ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.feedbacks           ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.candidate_invites   ALTER COLUMN org_id SET DEFAULT public.current_org_id();
