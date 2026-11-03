// IA do plano Plus (agente do painel e do app). Provedor: Groq (GROQ_API_KEY),
// modelo gpt-oss-120b. Motivo: rápido, barato, não treina com os dados e, com
// "Zero Data Retention" ligado em console.groq.com > Data Controls, não guarda
// as perguntas. Plano grátis tem cota diária baixa (tokens/dia): com uso real,
// passar a conta da HAV para o plano pago (Developer). No grátis o 120b aceita
// 8 mil tokens por minuto (umas 2 perguntas do agente): passou do limite (429),
// tenta o modelo reserva (GROQ_MODEL_RESERVA, padrão gpt-oss-20b).
import "server-only";

export const iaConfigurada = () => !!process.env.GROQ_API_KEY?.trim();

export type MsgIa = { role: "system" | "user" | "assistant"; content: string };

export async function perguntarIa(mensagens: MsgIa[], opts: { maxTokens?: number; json?: boolean; timeoutMs?: number } = {}): Promise<string | "limite" | null> {
  const chave = process.env.GROQ_API_KEY?.trim();
  if (!chave) return null;
  const modelos = [process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b", process.env.GROQ_MODEL_RESERVA?.trim() || "openai/gpt-oss-20b"];
  let limite = false;
  for (const modelo of modelos) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          reasoning_effort: "low",
          messages: mensagens,
          temperature: 0.2,
          max_tokens: opts.maxTokens ?? 700,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      });
      const r = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
      if (res.status === 429) {
        console.warn(`[ia] limite do ${modelo}`);
        limite = true;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${r.error?.message ?? ""}`.slice(0, 200));
      return r.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.error("[ia]", (e as Error).message);
      return null;
    }
  }
  // "limite": os dois modelos recusaram por volume (tela pede para esperar 1 minuto).
  return limite ? "limite" : null;
}
