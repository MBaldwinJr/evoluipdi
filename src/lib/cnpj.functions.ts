import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBrasilApi(digits: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado");
    if (res.status === 429) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`brasilapi ${res.status}`);
    const j = (await res.json()) as any;
    const code = j.cnae_fiscal ? String(j.cnae_fiscal) : "";
    const formattedCnae = code.length === 7 ? `${code.slice(0, 4)}-${code.slice(4, 5)}/${code.slice(5, 7)}` : code;
    return {
      legal_name: j.razao_social ?? "",
      trade_name: j.nome_fantasia ?? "",
      cnae_code: formattedCnae,
      cnae_description: j.cnae_fiscal_descricao ?? "",
      segment: j.cnae_fiscal_descricao ?? "",
    };
  }
  throw new Error("rate_limited");
}

async function fetchReceitaWs(digits: string) {
  const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
  if (!res.ok) throw new Error(`receitaws ${res.status}`);
  const j = (await res.json()) as any;
  if (j.status === "ERROR") throw new Error(j.message || "CNPJ não encontrado");
  const atividade = Array.isArray(j.atividade_principal) ? j.atividade_principal[0] : null;
  return {
    legal_name: j.nome ?? "",
    trade_name: j.fantasia ?? "",
    cnae_code: atividade?.code ?? "",
    cnae_description: atividade?.text ?? "",
    segment: atividade?.text ?? "",
  };
}

export const lookupCnpjFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cnpj: z.string().min(11).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) throw new Error("CNPJ inválido (14 dígitos)");
    try {
      return await fetchBrasilApi(digits);
    } catch (e: any) {
      if (e.message === "CNPJ não encontrado") throw e;
      try {
        return await fetchReceitaWs(digits);
      } catch {
        if (e.message === "rate_limited") {
          throw new Error("Limite de consultas atingido. Aguarde alguns segundos e tente novamente.");
        }
        throw new Error("Falha ao consultar CNPJ. Tente novamente em instantes.");
      }
    }
  });
