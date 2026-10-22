import { z } from "zod";

// Strip legacy plan_code/payload before the handler sees client-controlled data.
export const orgCreateInputSchema = z.object({
  cnpj: z.string().min(11).max(20),
  timezone: z.string().max(100).default("America/Sao_Paulo").refine((value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido"),
});