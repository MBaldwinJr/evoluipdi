import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserOrgId } from "./org.server";

export const ONBOARDING_CATEGORIES = ["document", "integration", "training"] as const;
export const ONBOARDING_STATUSES = ["pending", "in_progress", "done", "skipped"] as const;

export type OnboardingCategory = (typeof ONBOARDING_CATEGORIES)[number];
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export interface OnboardingTask {
  id: string;
  org_id: string;
  employee_id: string;
  application_id: string | null;
  category: OnboardingCategory;
  title: string;
  description: string | null;
  status: OnboardingStatus;
  due_date: string | null;
  order_index: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingEmployeeRow {
  employee_id: string;
  full_name: string;
  hire_date: string | null;
  role_title: string | null;
  department_name: string | null;
  total: number;
  done: number;
  pending: number;
  progress: number;
}

interface DefaultTaskSeed {
  category: OnboardingCategory;
  title: string;
  description?: string;
}

export const DEFAULT_ONBOARDING_TEMPLATE: readonly DefaultTaskSeed[] = [
  { category: "document", title: "RG e CPF", description: "Coletar cópias digitalizadas." },
  { category: "document", title: "Comprovante de residência" },
  { category: "document", title: "Carteira de Trabalho Digital" },
  { category: "document", title: "Exame admissional" },
  { category: "document", title: "Contrato assinado" },
  { category: "integration", title: "Boas-vindas e tour pela empresa" },
  { category: "integration", title: "Acesso a sistemas internos (e-mail, ERP, etc.)" },
  { category: "integration", title: "Apresentação ao time e ao gestor" },
  { category: "integration", title: "Entrega de equipamentos e crachá" },
  { category: "training", title: "Treinamento de cultura e código de conduta" },
  { category: "training", title: "Treinamento de segurança da informação (LGPD)" },
  { category: "training", title: "Treinamento técnico inicial do cargo" },
];

export const seedDefaultOnboardingTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employee_id: z.string().uuid(),
      application_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);

    const { count } = await supabase
      .from("onboarding_tasks")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", data.employee_id);
    if ((count ?? 0) > 0) return { inserted: 0 };

    const rows = DEFAULT_ONBOARDING_TEMPLATE.map((t, idx) => ({
      org_id: orgId,
      employee_id: data.employee_id,
      application_id: data.application_id ?? null,
      category: t.category,
      title: t.title,
      description: t.description ?? null,
      order_index: idx,
      created_by: userId,
    }));
    const { error } = await supabase.from("onboarding_tasks").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const listOnboardingEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: tasks, error } = await supabase
      .from("onboarding_tasks")
      .select("employee_id, status, employee:employees!inner(id, full_name, hire_date, role:roles_catalog(title), department:departments(name))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const map = new Map<string, OnboardingEmployeeRow>();
    for (const t of tasks ?? []) {
      const emp = (t as { employee: { id: string; full_name: string | null; hire_date: string | null; role: { title: string | null } | null; department: { name: string | null } | null } | null }).employee;
      if (!emp) continue;
      const row = map.get(emp.id) ?? {
        employee_id: emp.id,
        full_name: emp.full_name ?? "—",
        hire_date: emp.hire_date,
        role_title: emp.role?.title ?? null,
        department_name: emp.department?.name ?? null,
        total: 0, done: 0, pending: 0, progress: 0,
      };
      row.total += 1;
      if (t.status === "done") row.done += 1;
      else row.pending += 1;
      map.set(emp.id, row);
    }
    return Array.from(map.values()).map((r) => ({
      ...r,
      progress: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
    }));
  });

export const listOnboardingTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employee_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tasks, error } = await supabase
      .from("onboarding_tasks")
      .select("*")
      .eq("employee_id", data.employee_id)
      .order("category", { ascending: true })
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (tasks ?? []) as OnboardingTask[];
  });

export const updateOnboardingTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(ONBOARDING_STATUSES).optional(),
      due_date: z.string().nullable().optional(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (rest.status === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = userId;
    } else if (rest.status && rest.status !== "done") {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    const { error } = await supabase.from("onboarding_tasks").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addOnboardingTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employee_id: z.string().uuid(),
      category: z.enum(ONBOARDING_CATEGORIES),
      title: z.string().min(1),
      description: z.string().optional(),
      due_date: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);
    const { error } = await supabase.from("onboarding_tasks").insert({
      org_id: orgId,
      employee_id: data.employee_id,
      category: data.category,
      title: data.title,
      description: data.description ?? null,
      due_date: data.due_date ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOnboardingTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("onboarding_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
