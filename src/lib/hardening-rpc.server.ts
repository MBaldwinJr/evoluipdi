import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Kept separate from generated types until the reviewed migration is applied.
type HardeningDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      hardening_create_org: { Args: { actor_id: string; company: Json }; Returns: string };
      hardening_accept_invite: { Args: { actor_id: string; invite_token: string; verified_email: string }; Returns: string };
      hardening_update_plan: { Args: { actor_id: string; target_org: string; new_plan: string; new_modules: string[] }; Returns: undefined };
    };
  };
};

export const hardeningRpcClient = supabaseAdmin as SupabaseClient<HardeningDatabase>;

export function assertRpcSuccess(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883") throw new Error("Operação indisponível até a revisão e aplicação da migração de segurança");
  throw new Error("Não foi possível concluir a operação de segurança");
}