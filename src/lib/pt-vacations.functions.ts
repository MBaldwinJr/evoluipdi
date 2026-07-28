import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ptAssertMember, ptAssertRole } from "./pt-auth.server";

const RH_ROLES = ["admin", "rh"] as const;
const MGR_ROLES = ["admin", "rh", "gestor"] as const;

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000) + 1;
}

// -------- List --------

export const ptListVacations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      company_id: z.string().uuid(),
      year: z.number().int().min(2000).max(2100).optional(),
      status: z.string().optional(),
      employee_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const isMgr = await supabaseAdmin
      .rpc("pt_has_role", { _user: context.userId, _company: data.company_id, _roles: [...MGR_ROLES, "supervisor", "auditor"] as any });

    let q = supabaseAdmin
      .from("pt_vacations")
      .select("*, employee:pt_employees(id, full_name, branch_id, role_title)")
      .eq("company_id", data.company_id)
      .order("start_date", { ascending: false });

    if (data.year) {
      q = q.gte("start_date", `${data.year}-01-01`).lte("start_date", `${data.year}-12-31`);
    }
    if (data.status) q = q.eq("status", data.status as any);
    if (data.employee_id) q = q.eq("employee_id", data.employee_id);

    if (!isMgr.data) {
      const { data: me } = await supabaseAdmin
        .from("pt_employees").select("id").eq("company_id", data.company_id).eq("user_id", context.userId).maybeSingle();
      if (!me) return [];
      q = q.eq("employee_id", me.id);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- Balance --------

export const ptGetVacationBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid(), employee_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const { data: emp } = await supabaseAdmin
      .from("pt_employees").select("id, full_name, hire_date").eq("id", data.employee_id).maybeSingle();
    if (!emp) throw new Error("Funcionário não encontrado");
    if (!emp.hire_date) return { periods: [], warnings: ["Data de admissão não cadastrada"] };

    const today = new Date().toISOString().slice(0, 10);
    const periods: Array<{
      acquisition_start: string;
      acquisition_end: string;
      concessive_deadline: string;
      days_available: number;
      days_used: number;
      days_scheduled: number;
      status: "aberto" | "gozo" | "vencido" | "concluido";
    }> = [];

    // Generate all acquisition periods from hire_date until today + 1yr
    let acqStart = emp.hire_date;
    const limit = addDaysISO(today, 366);
    while (acqStart <= limit) {
      const acqEnd = addDaysISO(acqStart, 364); // 365 days
      const concDeadline = addDaysISO(acqEnd, 365);
      const { data: taken } = await supabaseAdmin
        .from("pt_vacations")
        .select("days_total, abono_days, status")
        .eq("employee_id", emp.id)
        .eq("acquisition_start", acqStart);
      const usedDays = (taken ?? [])
        .filter((v: any) => ["aprovada_rh", "agendada", "em_curso", "concluida"].includes(v.status))
        .reduce((s: number, v: any) => s + (v.days_total ?? 0), 0);
      const scheduledDays = (taken ?? [])
        .filter((v: any) => ["solicitada", "aprovada_gestor"].includes(v.status))
        .reduce((s: number, v: any) => s + (v.days_total ?? 0), 0);
      const available = Math.max(0, 30 - usedDays - scheduledDays);
      let status: "aberto" | "gozo" | "vencido" | "concluido" = "aberto";
      if (usedDays >= 30) status = "concluido";
      else if (concDeadline < today) status = "vencido";
      periods.push({
        acquisition_start: acqStart,
        acquisition_end: acqEnd,
        concessive_deadline: concDeadline,
        days_available: available,
        days_used: usedDays,
        days_scheduled: scheduledDays,
        status,
      });
      acqStart = addDaysISO(acqEnd, 1);
    }
    return { periods, employee: emp };
  });

// -------- Request / Create --------

export const ptRequestVacation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      company_id: z.string().uuid(),
      employee_id: z.string().uuid(),
      acquisition_start: z.string().optional().nullable(),
      acquisition_end: z.string().optional().nullable(),
      concessive_deadline: z.string().optional().nullable(),
      start_date: z.string(),
      end_date: z.string(),
      abono_days: z.number().int().min(0).max(10).default(0),
      advance_13: z.boolean().default(false),
      notes: z.string().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const days_total = daysBetween(data.start_date, data.end_date);
    if (days_total <= 0) throw new Error("Datas inválidas");
    if (days_total + data.abono_days > 30) throw new Error("Total (gozo + abono) excede 30 dias");

    // Check overlap
    const { data: overlap } = await supabaseAdmin
      .from("pt_vacations")
      .select("id")
      .eq("employee_id", data.employee_id)
      .not("status", "in", "(rejeitada,cancelada)")
      .lte("start_date", data.end_date)
      .gte("end_date", data.start_date);
    if (overlap && overlap.length) throw new Error("Já existe férias sobrepondo este período");

    const { data: created, error } = await supabaseAdmin
      .from("pt_vacations")
      .insert({
        company_id: data.company_id,
        employee_id: data.employee_id,
        acquisition_start: data.acquisition_start || addDaysISO(data.start_date, -365),
        acquisition_end: data.acquisition_end || addDaysISO(data.start_date, -1),
        concessive_deadline: data.concessive_deadline || addDaysISO(data.start_date, 365),
        start_date: data.start_date,
        end_date: data.end_date,
        days_total,
        abono_days: data.abono_days,
        advance_13: data.advance_13,
        notes: data.notes,
        status: "solicitada" as any,
        requested_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("pt_vacation_events").insert({
      vacation_id: created.id, company_id: data.company_id, actor_id: context.userId,
      event_type: "requested", to_status: "solicitada" as any,
    });
    return created;
  });

// -------- Approve / Reject / Cancel --------

export const ptTransitionVacation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve_manager", "approve_rh", "reject", "cancel", "complete", "start"]),
      reason: z.string().max(1000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: vac, error: e0 } = await supabaseAdmin
      .from("pt_vacations").select("*").eq("id", data.id).maybeSingle();
    if (e0 || !vac) throw new Error("Solicitação não encontrada");

    const now = new Date().toISOString();
    const patch: Record<string, any> = {};
    let toStatus = vac.status as string;

    switch (data.action) {
      case "approve_manager":
        await ptAssertRole(context.userId, vac.company_id, ["admin", "rh", "gestor"]);
        if (vac.status !== "solicitada") throw new Error("Estado inválido para aprovação do gestor");
        patch.status = toStatus = "aprovada_gestor";
        patch.approved_by_manager = context.userId;
        patch.approved_by_manager_at = now;
        break;
      case "approve_rh":
        await ptAssertRole(context.userId, vac.company_id, [...RH_ROLES]);
        if (!["solicitada", "aprovada_gestor"].includes(vac.status)) throw new Error("Estado inválido");
        patch.status = toStatus = "aprovada_rh";
        patch.approved_by_rh = context.userId;
        patch.approved_by_rh_at = now;
        break;
      case "reject":
        await ptAssertRole(context.userId, vac.company_id, ["admin", "rh", "gestor"]);
        patch.status = toStatus = "rejeitada";
        patch.rejected_by = context.userId;
        patch.rejected_at = now;
        patch.rejection_reason = data.reason ?? null;
        break;
      case "cancel": {
        const { data: me } = await supabaseAdmin
          .from("pt_employees").select("user_id").eq("id", vac.employee_id).maybeSingle();
        const isSelf = me?.user_id === context.userId;
        if (!isSelf) await ptAssertRole(context.userId, vac.company_id, [...RH_ROLES]);
        patch.status = toStatus = "cancelada";
        break;
      }
      case "start":
        await ptAssertRole(context.userId, vac.company_id, [...RH_ROLES]);
        patch.status = toStatus = "em_curso";
        break;
      case "complete":
        await ptAssertRole(context.userId, vac.company_id, [...RH_ROLES]);
        patch.status = toStatus = "concluida";
        break;
    }

    const { error } = await supabaseAdmin.from("pt_vacations").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("pt_vacation_events").insert({
      vacation_id: data.id, company_id: vac.company_id, actor_id: context.userId,
      event_type: data.action, from_status: vac.status as any, to_status: toStatus as any,
      notes: data.reason ?? null,
    });
    return { ok: true, status: toStatus };
  });

export const ptDeleteVacation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vac } = await supabaseAdmin
      .from("pt_vacations").select("company_id").eq("id", data.id).maybeSingle();
    if (!vac) throw new Error("Não encontrado");
    await ptAssertRole(context.userId, vac.company_id, [...RH_ROLES]);
    const { error } = await supabaseAdmin.from("pt_vacations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Events --------

export const ptListVacationEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ vacation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vac } = await supabaseAdmin
      .from("pt_vacations").select("company_id").eq("id", data.vacation_id).maybeSingle();
    if (!vac) return [];
    await ptAssertMember(context.userId, vac.company_id);
    const { data: rows, error } = await supabaseAdmin
      .from("pt_vacation_events").select("*").eq("vacation_id", data.vacation_id).order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- Employees list (for filters) --------

export const ptListVacationEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const { data: rows } = await supabaseAdmin
      .from("pt_employees")
      .select("id, full_name, role_title, hire_date, branch_id, active")
      .eq("company_id", data.company_id)
      .order("full_name");
    return rows ?? [];
  });
