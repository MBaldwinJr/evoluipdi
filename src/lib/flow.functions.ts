import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRH } from "./admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NodeSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(["start", "task", "decision", "end"]),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  owner: z.string().max(200).optional().nullable(),
  position: z.object({ x: z.number(), y: z.number() }),
});
const EdgeSchema = z.object({
  id: z.string().min(1).max(64),
  source: z.string().min(1).max(64),
  target: z.string().min(1).max(64),
  label: z.string().max(200).optional().nullable(),
});

export type FlowNode = z.infer<typeof NodeSchema>;
export type FlowEdge = z.infer<typeof EdgeSchema>;
export type FlowDoc = { nodes: FlowNode[]; edges: FlowEdge[] };

export const getProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ processId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("role_processes").select("id, title, steps, objective, success_criteria, tools").eq("id", data.processId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Processo não encontrado");
    const steps: any = row.steps ?? [];
    // If already in flow doc shape, return as is
    if (steps && !Array.isArray(steps) && Array.isArray(steps.nodes) && Array.isArray(steps.edges)) {
      return { process: row, flow: steps as FlowDoc };
    }
    // Linearize legacy array -> nodes/edges
    const arr: Array<{ title: string; how: string }> = Array.isArray(steps) ? steps : [];
    const nodes: FlowNode[] = [
      { id: "start", type: "start", label: "Início", description: null, owner: null, position: { x: 0, y: 0 } },
      ...arr.map((s, i) => ({
        id: `n${i + 1}`,
        type: "task" as const,
        label: s.title || `Etapa ${i + 1}`,
        description: s.how || null,
        owner: null,
        position: { x: 0, y: (i + 1) * 120 },
      })),
      { id: "end", type: "end" as const, label: "Fim", description: null, owner: null, position: { x: 0, y: (arr.length + 1) * 120 } },
    ];
    const edges: FlowEdge[] = [];
    let prev = "start";
    for (let i = 0; i < arr.length; i++) {
      edges.push({ id: `e-${prev}-n${i + 1}`, source: prev, target: `n${i + 1}`, label: null });
      prev = `n${i + 1}`;
    }
    edges.push({ id: `e-${prev}-end`, source: prev, target: "end", label: null });
    return { process: row, flow: { nodes, edges } as FlowDoc };
  });

export const saveProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      processId: z.string().uuid(),
      nodes: z.array(NodeSchema).max(200),
      edges: z.array(EdgeSchema).max(400),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const doc: FlowDoc = { nodes: data.nodes, edges: data.edges };
    const { error } = await supabaseAdmin
      .from("role_processes").update({ steps: doc as any }).eq("id", data.processId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
