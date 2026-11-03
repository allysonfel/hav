// Envio de e-mail (acesso ao app, recuperação de senha e relatório mensal).
// Com RESEND_API_KEY usa o Resend; sem chave, em desenvolvimento escreve no log
// do servidor e em produção avisa que não enviou (a tela segue com mensagem genérica).
import "server-only";

export type Anexo = { nome: string; conteudo: Buffer };

export const emailConfigurado = () => !!process.env.RESEND_API_KEY?.trim();

export async function enviarEmail(para: string, assunto: string, texto: string, anexos: Anexo[] = []): Promise<boolean> {
  // Endereço .invalid (investidores da demonstração) nunca sai: evita devolução no provedor.
  if (/\.invalid$/i.test(para)) {
    console.log(`[email] não enviado: ${para} é de demonstração`);
    return false;
  }
  const chave = process.env.RESEND_API_KEY?.trim();
  const de = process.env.EMAIL_REMETENTE?.trim() || "HAV Energia <nao-responda@havenergia.com.br>";
  if (!chave) {
    if (process.env.NODE_ENV !== "production") console.log(`[email simulado] para ${para}: ${assunto}${anexos.length ? ` (${anexos.map((a) => a.nome).join(", ")})` : ""}\n${texto}`);
    else console.warn("[email] RESEND_API_KEY não configurada; e-mail não enviado");
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: de,
        to: [para],
        subject: assunto,
        text: texto,
        ...(anexos.length ? { attachments: anexos.map((a) => ({ filename: a.nome, content: a.conteudo.toString("base64") })) } : {}),
      }),
      signal: AbortSignal.timeout(anexos.length ? 30_000 : 10_000),
    });
    if (!r.ok) console.error("[email] falha no envio:", r.status);
    return r.ok;
  } catch (err) {
    console.error("[email] erro:", err instanceof Error ? err.message : err);
    return false;
  }
}
