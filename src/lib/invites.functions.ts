import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomToken() {
  // 32 bytes hex
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data: sa } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (sa) return;
  const { data: mem } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!mem || !["admin", "rh"].includes((mem as any).role)) {
    throw new Error("Acesso negado: apenas admin/RH da empresa pode convidar");
  }
}

export const inviteList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { data: rows, error } = await context.supabase
      .from("org_invites")
      .select("id, email, role, token, accepted_at, expires_at, created_at")
      .eq("org_id", data.org_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const inviteCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      email: z.string().email().max(255),
      role: z.enum(["admin", "rh", "gestor", "colaborador"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const token = randomToken();
    const { data: row, error } = await context.supabase
      .from("org_invites")
      .insert({
        org_id: data.org_id,
        email: data.email.toLowerCase().trim(),
        role: data.role,
        token,
        invited_by: context.userId!,
      })
      .select("id, token, email, role, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const inviteRevoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("org_invites").select("org_id").eq("id", data.id).maybeSingle();
    if (!inv) throw new Error("Convite não encontrado");
    await assertOrgAdmin(context.supabase, context.userId!, (inv as any).org_id);
    const { error } = await context.supabase.from("org_invites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteValidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("org_invites")
      .select("id, email, role, org_id, accepted_at, expires_at, orgs:org_id(legal_name, trade_name)")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Convite inválido ou expirado");
    const i: any = inv;
    if (i.accepted_at) throw new Error("Este convite já foi utilizado");
    if (new Date(i.expires_at).getTime() < Date.now()) throw new Error("Convite expirado");
    return {
      email: i.email,
      role: i.role,
      org_id: i.org_id,
      org_name: i.orgs?.trade_name || i.orgs?.legal_name,
    };
  });

export const inviteAccept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = (claims?.email as string | undefined)?.toLowerCase();
    const { data: inv } = await supabase
      .from("org_invites")
      .select("id, email, role, org_id, accepted_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Convite inválido");
    const i: any = inv;
    if (i.accepted_at) throw new Error("Convite já utilizado");
    if (new Date(i.expires_at).getTime() < Date.now()) throw new Error("Convite expirado");
    if (userEmail && userEmail !== i.email.toLowerCase()) {
      throw new Error(`Este convite foi enviado para ${i.email}. Entre com essa conta para aceitar.`);
    }

    // Idempotent membership (RLS on org_members allows admin/rh to insert; convidado se auto-anexa via aceite)
    const { error: memErr } = await supabase
      .from("org_members")
      .upsert({ org_id: i.org_id, user_id: userId!, role: i.role }, { onConflict: "org_id,user_id" });
    if (memErr) {
      // Fallback: usar service role via admin endpoint não disponível aqui — devolvemos o erro real
      throw new Error(`Falha ao vincular: ${memErr.message}`);
    }

    // Se o convite for de RH ou admin, garante a role global "rh" no user_roles para liberar páginas /admin
    if (i.role === "rh" || i.role === "admin") {
      await supabase.from("user_roles").insert({ user_id: userId!, role: "rh" }).select();
    }
    if (i.role === "gestor") {
      await supabase.from("user_roles").insert({ user_id: userId!, role: "gestor" }).select();
    }

    const { error: updErr } = await supabase
      .from("org_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", i.id);
    if (updErr) throw new Error(updErr.message);

    return { org_id: i.org_id };
  });
