import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertRH(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (!data) throw new Error("Apenas o RH pode executar esta ação");
}

export const createUserAndEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(1).max(200),
    roleId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (existing) throw new Error("E-mail já cadastrado");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newUid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({ id: newUid, email: data.email, full_name: data.fullName });
    const { error: e2 } = await supabaseAdmin.from("employees").insert({
      user_id: newUid, role_id: data.roleId ?? null, department_id: data.departmentId ?? null, manager_id: data.managerId ?? null,
    });
    if (e2) throw new Error(e2.message);
    return { ok: true, userId: newUid };
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["colaborador","gestor","rh"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });