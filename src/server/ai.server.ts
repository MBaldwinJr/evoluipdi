// Server-only AI helper. Calls Lovable AI Gateway.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function callAIJson<T>(args: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
  model?: string;
}): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: args.model ?? "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      tools: [{
        type: "function",
        function: { name: args.toolName, description: args.toolDescription, parameters: args.parameters },
      }],
      tool_choice: { type: "function", function: { name: args.toolName } },
    }),
  });

  if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações > Workspace.");
  if (!res.ok) throw new Error(`Erro de IA: ${res.status} ${await res.text().catch(() => "")}`);

  const data = await res.json() as any;
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("IA não retornou resultado estruturado");
  return JSON.parse(call.function.arguments) as T;
}
