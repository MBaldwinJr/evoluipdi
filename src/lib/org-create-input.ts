import { z } from "zod";

// Preserve the existing caller contract; legacy fields never grant a plan or verified facts.
export const orgCreateInputSchema = z.object({
  cnpj: z.string().min(11).max(20),
  plan_code: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
  payload: z.unknown().optional(),
  timezone: z.string().max(100).default("America/Sao_Paulo").refine((value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido"),
});