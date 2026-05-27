import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeCandidateCv } from "./cv-analysis.server";

async function assertInviteAccess(userId: string, inviteId: string) {
  const { data: rh } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (rh) return;
  const { data: inv } = await supabaseAdmin.from("candidate_invites").select("created_by").eq("id", inviteId).maybeSingle();
  if (!inv) throw new Error("Convite não encontrado");
  if (inv.created_by === userId) return;
  throw new Error("Acesso negado");
}

export const analyzeCandidateCvFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inviteId: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertInviteAccess(context.userId, data.inviteId);
    return analyzeCandidateCv(data.inviteId, !!data.force);
  });

export const getCandidateCvUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertInviteAccess(context.userId, data.inviteId);
    const { data: inv } = await supabaseAdmin.from("candidate_invites").select("cv_path, cv_filename").eq("id", data.inviteId).maybeSingle();
    if (!inv?.cv_path) throw new Error("Sem currículo");
    const { data: signed, error } = await supabaseAdmin.storage.from("candidate-cvs").createSignedUrl(inv.cv_path, 300, { download: inv.cv_filename ?? undefined });
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl, filename: inv.cv_filename };
  });

export const convertCandidateToEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    inviteId: z.string().uuid(),
    email: z.string().email(),
    password: z.string().min(6).max(72),
    fullName: z.string().min(1).max(200),
    roleId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Apenas RH pode criar colaborador
    const { data: rh } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "rh").maybeSingle();
    if (!rh) throw new Error("Apenas o RH pode converter candidatos em colaboradores");

    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (existing) throw new Error("E-mail já cadastrado");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newUid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({ id: newUid, email: data.email, full_name: data.fullName });
    const { data: empRow, error: e2 } = await supabaseAdmin.from("employees").insert({
      user_id: newUid, role_id: data.roleId ?? null, department_id: data.departmentId ?? null, manager_id: data.managerId ?? null,
    }).select("id").single();
    if (e2) throw new Error(e2.message);

    await supabaseAdmin.from("candidate_invites").update({
      hire_status: "contratado",
      hired_at: new Date().toISOString(),
      hired_employee_id: empRow.id,
    }).eq("id", data.inviteId);

    return { ok: true, employeeId: empRow.id, userId: newUid };
  });
