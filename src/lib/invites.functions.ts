import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEmail, requireInviteIdentity, requireInvitePermission } from "./security-access";

function randomToken() {
  // 32 bytes hex
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const inviteList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireInvitePermission(context.supabase, context.userId, data.org_id);
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
    z
      .object({
        org_id: z.string().uuid(),
        email: z.string().trim().email().max(255),
        role: z.enum(["admin", "rh", "gestor", "colaborador"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireInvitePermission(context.supabase, context.userId, data.org_id, data.role);
    const token = randomToken();
    const { data: row, error } = await context.supabase
      .from("org_invites")
      .insert({
        org_id: data.org_id,
        email: normalizeEmail(data.email),
        role: data.role,
        token,
        invited_by: context.userId,
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
      .from("org_invites")
      .select("org_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Convite não encontrado");
    await requireInvitePermission(context.supabase, context.userId, inv.org_id);
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
      .select(
        "id, email, role, org_id, accepted_at, expires_at, orgs:org_id(legal_name, trade_name)",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Convite inválido ou expirado");
    const i = inv;
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
    const { data: identity, error: identityError } = await supabase.auth.getUser();
    if (identityError || !identity.user || identity.user.id !== userId)
      throw new Error("Identidade não comprovada");
    const email = requireInviteIdentity(
      identity.user.email,
      identity.user.email_confirmed_at,
      claims,
    );
    const { data: invite, error: inviteError } = await supabase
      .from("org_invites")
      .select("email")
      .eq("token", data.token)
      .maybeSingle();
    if (inviteError || !invite) throw new Error("Convite inválido ou acesso negado");
    requireInviteIdentity(
      identity.user.email,
      identity.user.email_confirmed_at,
      claims,
      invite.email,
    );
    const { hardeningRpcClient, assertRpcSuccess } = await import("./hardening-rpc.server");
    const { data: orgId, error } = await hardeningRpcClient.rpc("hardening_accept_invite", {
      actor_id: userId,
      invite_token: data.token,
      verified_email: email,
    });
    assertRpcSuccess(error);
    if (!orgId) throw new Error("Não foi possível aceitar o convite");
    return { org_id: orgId };
  });
