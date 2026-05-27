import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const lookupCnpjFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cnpj: z.string().min(11).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) throw new Error("CNPJ inválido (14 dígitos)");
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado");
    if (!res.ok) throw new Error(`Falha ao consultar CNPJ (${res.status})`);
    const j = await res.json() as any;
    const code = j.cnae_fiscal ? String(j.cnae_fiscal) : "";
    const formattedCnae = code.length === 7 ? `${code.slice(0,4)}-${code.slice(4,5)}/${code.slice(5,7)}` : code;
    return {
      legal_name: j.razao_social ?? "",
      trade_name: j.nome_fantasia ?? "",
      cnae_code: formattedCnae,
      cnae_description: j.cnae_fiscal_descricao ?? "",
      segment: j.cnae_fiscal_descricao ?? "",
    };
  });
