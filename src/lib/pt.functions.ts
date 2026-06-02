import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ptAssertMember, ptAssertRole, ptAuditLog, ptListUserCompanies, haversineMeters } from "./pt-auth.server";
import { computeDay, type DayPunch, type Schedule } from "./pt-engine.server";

const RH_ROLES = ["admin", "rh"] as const;
const MGR_ROLES = ["admin", "rh", "gestor", "supervisor", "auditor"] as const;

// ---------------- Companies & membership ----------------

export const ptListMyCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return ptListUserCompanies(context.userId);
  });

export const ptCreateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      legal_name: z.string().min(2).max(200),
      trade_name: z.string().max(200).optional(),
      cnpj: z.string().max(20).optional(),
      timezone: z.string().default("America/Sao_Paulo"),
      block_outside_geofence: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: company, error } = await supabaseAdmin
      .from("pt_companies")
      .insert({ ...data, created_by: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // creator becomes admin
    await supabaseAdmin.from("pt_company_members").insert({
      user_id: context.userId,
      company_id: company.id,
      role: "admin" as any,
    });
    await ptAuditLog({ companyId: company.id, actorId: context.userId, action: "company.create", targetTable: "pt_companies", targetId: company.id, after: company });
    return company;
  });

export const ptInviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      company_id: z.string().uuid(),
      user_id: z.string().uuid(),
      role: z.enum(["admin", "rh", "gestor", "supervisor", "funcionario", "auditor"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertRole(context.userId, data.company_id, [...RH_ROLES]);
    const { error } = await supabaseAdmin.from("pt_company_members").insert({
      user_id: data.user_id, company_id: data.company_id, role: data.role as any,
    });
    if (error) throw new Error(error.message);
    await ptAuditLog({ companyId: data.company_id, actorId: context.userId, action: "member.invite", after: data });
    return { ok: true };
  });

// ---------------- Branches ----------------

export const ptListBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const { data: rows, error } = await supabaseAdmin
      .from("pt_branches").select("*").eq("company_id", data.company_id).order("name");
    if (error) throw new Error(error.message);
    return rows;
  });

export const ptUpsertBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      company_id: z.string().uuid(),
      name: z.string().min(1).max(120),
      address: z.string().max(300).optional().nullable(),
      lat: z.number().min(-90).max(90).optional().nullable(),
      lng: z.number().min(-180).max(180).optional().nullable(),
      geofence_radius_m: z.number().int().min(20).max(50000).default(200),
      active: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertRole(context.userId, data.company_id, [...RH_ROLES]);
    const { id, ...rest } = data;
    const q = id
      ? supabaseAdmin.from("pt_branches").update(rest).eq("id", id).select("*").single()
      : supabaseAdmin.from("pt_branches").insert(rest).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    await ptAuditLog({ companyId: data.company_id, actorId: context.userId, action: id ? "branch.update" : "branch.create", targetTable: "pt_branches", targetId: row.id, after: row });
    return row;
  });

// ---------------- Schedules ----------------

const WeeklyPatternSchema = z.record(
  z.string(),
  z.object({ start: z.string(), end: z.string(), break_min: z.number().int().min(0).max(480).optional() }).nullable(),
);

export const ptListSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const { data: rows, error } = await supabaseAdmin
      .from("pt_schedules").select("*").eq("company_id", data.company_id).order("name");
    if (error) throw new Error(error.message);
    return rows;
  });

export const ptUpsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      company_id: z.string().uuid(),
      name: z.string().min(1).max(120),
      kind: z.enum(["fixa", "5x2", "6x1", "12x36", "flex"]).default("fixa"),
      weekly_pattern: WeeklyPatternSchema,
      tolerance_min: z.number().int().min(0).max(60).default(10),
      night_shift_start: z.string().default("22:00"),
      night_shift_end: z.string().default("05:00"),
      interjornada_min: z.number().int().min(0).default(660),
      intrajornada_min: z.number().int().min(0).default(60),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertRole(context.userId, data.company_id, [...RH_ROLES]);
    const { id, ...rest } = data;
    const q = id
      ? supabaseAdmin.from("pt_schedules").update(rest as any).eq("id", id).select("*").single()
      : supabaseAdmin.from("pt_schedules").insert(rest as any).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    await ptAuditLog({ companyId: data.company_id, actorId: context.userId, action: id ? "schedule.update" : "schedule.create", targetTable: "pt_schedules", targetId: row.id, after: row });
    return row;
  });

// ---------------- Employees (unified with `employees`) ----------------

async function fetchEmployeeWithRefs(orgId: string, filter: (q: any) => any) {
  const baseQ = filter(
    supabaseAdmin
      .from("employees")
      .select("id, user_id, org_id, full_name, cpf, registration, branch_id, schedule_id, weekly_hours, contract_type, hire_date, active, manager_id, role_id, profile:profiles(full_name), role:roles_catalog(title)")
      .eq("org_id", orgId),
  );
  const { data, error } = await baseQ;
  if (error) throw new Error(error.message);
  const rows: any[] = Array.isArray(data) ? data : data ? [data] : [];
  const branchIds = Array.from(new Set(rows.map((r) => r.branch_id).filter(Boolean)));
  const schedIds = Array.from(new Set(rows.map((r) => r.schedule_id).filter(Boolean)));
  const [{ data: branches }, { data: schedules }] = await Promise.all([
    branchIds.length
      ? supabaseAdmin.from("pt_branches").select("id, name, lat, lng, geofence_radius_m").in("id", branchIds)
      : Promise.resolve({ data: [] as any[] }),
    schedIds.length
      ? supabaseAdmin.from("pt_schedules").select("*").in("id", schedIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const bMap = new Map((branches ?? []).map((b: any) => [b.id, b]));
  const sMap = new Map((schedules ?? []).map((s: any) => [s.id, s]));
  return rows.map((r) => ({
    ...r,
    full_name: r.full_name || r.profile?.full_name || "—",
    role_title: r.role?.title ?? null,
    branch: r.branch_id ? bMap.get(r.branch_id) ?? null : null,
    schedule: r.schedule_id ? sMap.get(r.schedule_id) ?? null : null,
  }));
}

export const ptListEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const rows = await fetchEmployeeWithRefs(data.company_id, (q) => q.order("full_name"));
    return rows;
  });

export const ptUpsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      company_id: z.string().uuid(),
      branch_id: z.string().uuid().nullable().optional(),
      user_id: z.string().uuid().nullable().optional(),
      full_name: z.string().min(1).max(200),
      cpf: z.string().max(20).optional().nullable(),
      registration: z.string().max(50).optional().nullable(),
      role_title: z.string().max(120).optional().nullable(),
      hire_date: z.string().optional().nullable(),
      contract_type: z.string().max(40).default("CLT"),
      weekly_hours: z.number().min(0).max(168).default(44),
      schedule_id: z.string().uuid().nullable().optional(),
      manager_id: z.string().uuid().nullable().optional(),
      active: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertRole(context.userId, data.company_id, [...RH_ROLES]);
    const { id, company_id, role_title: _ignored, ...rest } = data;
    const payload = { ...rest, org_id: company_id };
    const q = id
      ? supabaseAdmin.from("employees").update(payload).eq("id", id).select("*").single()
      : supabaseAdmin.from("employees").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    await ptAuditLog({ companyId: company_id, actorId: context.userId, action: id ? "employee.update" : "employee.create", targetTable: "employees", targetId: row.id, after: row });
    return row;
  });

export const ptGetMyEmployee = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const rows = await fetchEmployeeWithRefs(data.company_id, (q) => q.eq("user_id", context.userId).limit(1));
    return rows[0] ?? null;
  });

// ---------------- Punches ----------------

export const ptRegisterPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      company_id: z.string().uuid(),
      kind: z.enum(["entrada", "saida", "inicio_intervalo", "fim_intervalo"]),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
      accuracy_m: z.number().optional().nullable(),
      selfie_base64: z.string().max(2_000_000).optional().nullable(),
      device_info: z.record(z.string(), z.any()).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);

    // find my employee
    const { data: empBase, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, branch_id")
      .eq("org_id", data.company_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    if (!empBase) throw new Error("Você não está cadastrado como funcionário nesta empresa.");
    let emp: { id: string; branch_id: string | null; branch: { id: string; lat: number | null; lng: number | null; geofence_radius_m: number | null } | null } = { ...empBase, branch: null };
    if (empBase.branch_id) {
      const { data: br } = await supabaseAdmin
        .from("pt_branches").select("id, lat, lng, geofence_radius_m").eq("id", empBase.branch_id).maybeSingle();
      emp.branch = br as any;
    }

    // company config for blocking
    const { data: company } = await supabaseAdmin
      .from("pt_companies").select("block_outside_geofence").eq("id", data.company_id).single();

    const anomaly_flags: string[] = [];
    let inside_geofence: boolean | null = null;
    let distance: number | null = null;
    const branch: any = emp.branch;
    if (branch && branch.lat != null && branch.lng != null && data.lat != null && data.lng != null) {
      distance = haversineMeters({ lat: branch.lat, lng: branch.lng }, { lat: data.lat, lng: data.lng });
      inside_geofence = distance <= (branch.geofence_radius_m ?? 200);
      if (!inside_geofence) anomaly_flags.push("fora_da_cerca");
    } else if (data.lat == null || data.lng == null) {
      anomaly_flags.push("sem_geolocalizacao");
    }

    if (company?.block_outside_geofence && inside_geofence === false) {
      throw new Error("Você está fora da cerca virtual da filial.");
    }

    // upload selfie if provided
    let selfie_path: string | null = null;
    if (data.selfie_base64) {
      const match = data.selfie_base64.match(/^data:(image\/\w+);base64,(.+)$/);
      const b64 = match ? match[2] : data.selfie_base64;
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 1_500_000) throw new Error("Selfie muito grande (máx 1.5MB).");
      const path = `${data.company_id}/${emp.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabaseAdmin.storage.from("pt-selfies").upload(path, buf, {
        contentType: match?.[1] ?? "image/jpeg",
        upsert: false,
      });
      if (upErr) throw new Error(`Falha ao salvar selfie: ${upErr.message}`);
      selfie_path = path;
    }

    const { data: punch, error } = await supabaseAdmin
      .from("pt_punches")
      .insert({
        company_id: data.company_id,
        employee_id: emp.id,
        branch_id: emp.branch_id,
        kind: data.kind as any,
        source: "web" as any,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        accuracy_m: data.accuracy_m ?? null,
        inside_geofence,
        distance_to_branch_m: distance,
        selfie_path,
        device_info: data.device_info ?? null,
        anomaly_flags,
        status: anomaly_flags.length ? ("pendente" as any) : ("ok" as any),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await ptAuditLog({
      companyId: data.company_id,
      actorId: context.userId,
      action: "punch.create",
      targetTable: "pt_punches",
      targetId: punch.id,
      after: punch,
    });

    return punch;
  });

export const ptListMyTodayPunches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    const { data: emp } = await supabaseAdmin
      .from("employees").select("id").eq("org_id", data.company_id).eq("user_id", context.userId).maybeSingle();
    if (!emp) return [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const { data: rows, error } = await supabaseAdmin
      .from("pt_punches").select("*")
      .eq("employee_id", emp.id)
      .gte("ts", start.toISOString()).lte("ts", end.toISOString())
      .order("ts");
    if (error) throw new Error(error.message);
    return rows;
  });

// ---------------- Mirror (espelho de ponto) ----------------

export const ptGetMirror = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      company_id: z.string().uuid(),
      employee_id: z.string().uuid().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ptAssertMember(context.userId, data.company_id);
    let employee_id = data.employee_id;
    if (!employee_id) {
      const { data: emp } = await supabaseAdmin
        .from("pt_employees").select("id").eq("company_id", data.company_id).eq("user_id", context.userId).maybeSingle();
      if (!emp) {
        return {
          employee: null as any,
          days: [],
          totals: { worked_min: 0, expected_min: 0, late_min: 0, extra_min_50: 0, extra_min_100: 0, night_min: 0, balance_min: 0 },
          missing: true as const,
        };
      }
      employee_id = emp.id;
    } else {
      await ptAssertRole(context.userId, data.company_id, [...MGR_ROLES]);
    }

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("pt_employees")
      .select("*, schedule:pt_schedules(*)")
      .eq("id", employee_id).single();
    if (empErr) throw new Error(empErr.message);

    const [y, m] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));

    const { data: punches } = await supabaseAdmin
      .from("pt_punches").select("ts, kind")
      .eq("employee_id", employee_id)
      .gte("ts", start.toISOString()).lt("ts", end.toISOString())
      .order("ts");

    const { data: holidays } = await supabaseAdmin
      .from("pt_holidays").select("date")
      .eq("company_id", data.company_id)
      .gte("date", start.toISOString().slice(0, 10))
      .lt("date", end.toISOString().slice(0, 10));
    const holidaySet = new Set((holidays ?? []).map((h: any) => h.date));

    const schedule: Schedule | null = emp.schedule
      ? {
          kind: (emp.schedule as any).kind,
          weekly_pattern: (emp.schedule as any).weekly_pattern,
          tolerance_min: (emp.schedule as any).tolerance_min,
          night_shift_start: (emp.schedule as any).night_shift_start,
          night_shift_end: (emp.schedule as any).night_shift_end,
          interjornada_min: (emp.schedule as any).interjornada_min,
          intrajornada_min: (emp.schedule as any).intrajornada_min,
        }
      : null;

    const days: ReturnType<typeof computeDay>[] = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayPunches: DayPunch[] = (punches ?? [])
        .filter((p: any) => p.ts.startsWith(dateStr))
        .map((p: any) => ({ ts: p.ts, kind: p.kind }));
      days.push(computeDay({ date: dateStr, punches: dayPunches, schedule, isHoliday: holidaySet.has(dateStr) }));
    }

    const totals = days.reduce(
      (acc, d) => ({
        worked_min: acc.worked_min + d.worked_min,
        expected_min: acc.expected_min + d.expected_min,
        late_min: acc.late_min + d.late_min,
        extra_min_50: acc.extra_min_50 + d.extra_min_50,
        extra_min_100: acc.extra_min_100 + d.extra_min_100,
        night_min: acc.night_min + d.night_min,
        balance_min: acc.balance_min + d.balance_min,
      }),
      { worked_min: 0, expected_min: 0, late_min: 0, extra_min_50: 0, extra_min_100: 0, night_min: 0, balance_min: 0 },
    );

    return { employee: { id: emp.id, full_name: emp.full_name, role_title: emp.role_title }, days, totals };
  });

// ---------------- Dashboard ----------------

export const ptGetDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertRole(context.userId, data.company_id, [...MGR_ROLES]);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [employees, todayPunches, anomalies] = await Promise.all([
      supabaseAdmin.from("pt_employees").select("id, active").eq("company_id", data.company_id),
      supabaseAdmin.from("pt_punches").select("id, employee_id, kind, anomaly_flags, inside_geofence")
        .eq("company_id", data.company_id)
        .gte("ts", start.toISOString()).lte("ts", end.toISOString()),
      supabaseAdmin.from("pt_anomalies").select("id, severity").eq("company_id", data.company_id).eq("resolved", false),
    ]);

    const activeEmployees = (employees.data ?? []).filter((e: any) => e.active).length;
    const punchesToday = todayPunches.data ?? [];
    const outFence = punchesToday.filter((p: any) => p.inside_geofence === false).length;
    const workingNow = new Set(
      punchesToday
        .sort((a: any, b: any) => a.id.localeCompare(b.id))
        .filter((p: any) => p.kind === "entrada" || p.kind === "fim_intervalo")
        .map((p: any) => p.employee_id),
    ).size;

    return {
      activeEmployees,
      punchesToday: punchesToday.length,
      workingNow,
      outFence,
      openAnomalies: anomalies.data?.length ?? 0,
    };
  });

export const ptGetSelfieUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid(), path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await ptAssertRole(context.userId, data.company_id, [...MGR_ROLES]);
    const { data: signed, error } = await supabaseAdmin.storage.from("pt-selfies").createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
