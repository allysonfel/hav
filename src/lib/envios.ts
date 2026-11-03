// Relatório mensal por e-mail (Plus). Ao fechar o mês, cada cotista ganha uma
// linha na fila (envios_email); a fila é processada logo depois da resposta
// (after) e, para novas tentativas, a cada 5 minutos (instrumentation.ts).
// Falhou: tenta de novo em 10 min, 1 h e 6 h; na 4ª falha fica "falhou" e o
// admin pode reenviar pela tela do fechamento.
import "server-only";
import { sql } from "./db";
import { emailConfigurado, enviarEmail } from "./email";
import { brl, kwh, mesLongo, pct } from "./format";
import { relatorioInvestidor } from "./relatorios";
import { pdfInvestidor } from "./pdf/RelatoriosPdf";
import { getSettings } from "./settings";
import { EMAIL_DEMO } from "./demo";

const ESPERA_MIN = [10, 60, 360];
const MAX_TENTATIVAS = ESPERA_MIN.length + 1;

export type StatusEnvio = "pendente" | "enviando" | "enviado" | "simulado" | "falhou" | "cancelado";
export const STATUS_ENVIO: Record<StatusEnvio, string> = {
  pendente: "Na fila",
  enviando: "Enviando",
  enviado: "Enviado",
  simulado: "Simulado (sem e-mail configurado)",
  falhou: "Falhou",
  cancelado: "Não enviado",
};

// Põe (ou volta) na fila os cotistas do mês. Investidor inativo ou que desligou
// o relatório por e-mail fica como "cancelado", para a tela mostrar o motivo.
export async function enfileirar(fechamentoId: number) {
  const s = await getSettings();
  if (!s.emailRelatorio) return;
  await sql`
    INSERT INTO envios_email (fechamento_id, investidor_id, status, erro)
    SELECT r.fechamento_id, r.investidor_id,
      CASE WHEN i.ativo AND i.relatorio_email AND i.email NOT LIKE ${"%" + EMAIL_DEMO} THEN 'pendente' ELSE 'cancelado' END,
      CASE WHEN i.email LIKE ${"%" + EMAIL_DEMO} THEN 'Investidor de demonstração' WHEN NOT i.ativo THEN 'Investidor inativo'
        WHEN NOT i.relatorio_email THEN 'Investidor desligou o e-mail' ELSE '' END
    FROM rateios r JOIN investidores i ON i.id = r.investidor_id
    WHERE r.fechamento_id = ${fechamentoId}
    ON CONFLICT (fechamento_id, investidor_id) DO UPDATE
      SET status = EXCLUDED.status, erro = EXCLUDED.erro, tentativas = 0, proxima_em = now(), enviado_em = NULL`;
}

// Reabrir o mês: o que ainda não saiu não sai mais.
export async function cancelarPendentes(fechamentoId: number) {
  await sql`UPDATE envios_email SET status = 'cancelado', erro = 'Mês reaberto' WHERE fechamento_id = ${fechamentoId} AND status IN ('pendente', 'falhou')`;
}

export async function reenviar(fechamentoId: number, investidorId?: number) {
  await sql`
    UPDATE envios_email e SET status = 'pendente', erro = '', tentativas = 0, proxima_em = now()
    FROM investidores i
    WHERE i.id = e.investidor_id AND i.ativo AND i.email NOT LIKE ${"%" + EMAIL_DEMO} AND e.fechamento_id = ${fechamentoId}
      ${investidorId ? sql`AND e.investidor_id = ${investidorId}` : sql`AND e.status IN ('falhou', 'simulado')`}`;
}

function textoEmail(r: NonNullable<Awaited<ReturnType<typeof relatorioInvestidor>>>) {
  const f = r.fechamento;
  const app = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  const primeiro = r.investidor.nome.split(" ")[0];
  return [
    `Olá, ${primeiro}.`,
    "",
    `O relatório de ${mesLongo(f.comp)} da ${f.usina} está pronto. O PDF segue anexo.`,
    "",
    `Sua cota: ${pct(r.rateio.cota_ppm)}`,
    `Sua geração proporcional: ${kwh(r.rateio.geracao_wh)}`,
    `Sua receita proporcional: ${brl(r.rateio.receita_centavos)}`,
    `Repasse: ${r.rateio.repasse_status === "pago" ? "pago" : "pendente (avisamos no app quando for pago)"}`,
    "",
    app ? `Veja o histórico completo no app: ${app}` : "",
    "",
    `Não quer mais receber este e-mail? No app, vá em Perfil > Notificações.`,
    "",
    r.empresa.empresa,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

let rodando = false;

// Processa até 25 envios vencidos. Uma execução por vez neste processo; o
// SKIP LOCKED evita envio duplo se houver mais de uma instância.
export async function processarFila(): Promise<number> {
  if (rodando) return 0;
  rodando = true;
  let feitos = 0;
  try {
    // Linha presa em "enviando" (servidor caiu no meio) volta para a fila.
    await sql`UPDATE envios_email SET status = 'pendente' WHERE status = 'enviando' AND proxima_em < now() - interval '15 minutes'`;
    const lote = await sql<{ id: number; fechamento_id: number; investidor_id: number; tentativas: number }[]>`
      UPDATE envios_email SET status = 'enviando', proxima_em = now()
      WHERE id IN (
        SELECT id FROM envios_email WHERE status = 'pendente' AND proxima_em <= now()
        ORDER BY id LIMIT 25 FOR UPDATE SKIP LOCKED
      )
      RETURNING id, fechamento_id, investidor_id, tentativas`;
    for (const e of lote) {
      let erro = "";
      let status: StatusEnvio = "enviado";
      try {
        const r = await relatorioInvestidor(e.fechamento_id, e.investidor_id);
        if (!r) {
          status = "cancelado";
          erro = "Mês não está mais fechado";
        } else {
          const pdf = await pdfInvestidor(r);
          const assunto = `Relatório de ${mesLongo(r.fechamento.comp)} · ${r.fechamento.usina}`;
          const ok = await enviarEmail(r.investidor.email, assunto, textoEmail(r), [{ nome: `relatorio-${r.fechamento.comp}.pdf`, conteudo: pdf }]);
          if (!ok) {
            if (!emailConfigurado() && process.env.NODE_ENV !== "production") status = "simulado";
            else {
              status = "falhou";
              erro = emailConfigurado() ? "O provedor de e-mail recusou ou não respondeu" : "E-mail não configurado (RESEND_API_KEY)";
            }
          }
        }
      } catch (err) {
        status = "falhou";
        erro = "Erro ao gerar o relatório";
        console.error("[envios]", err instanceof Error ? err.message : err);
      }
      const tentativas = e.tentativas + 1;
      // Falha com tentativas sobrando volta para a fila mais tarde.
      if (status === "falhou" && emailConfigurado() && tentativas < MAX_TENTATIVAS) {
        await sql`UPDATE envios_email SET status = 'pendente', tentativas = ${tentativas}, erro = ${erro},
          proxima_em = now() + make_interval(mins => ${ESPERA_MIN[tentativas - 1]}) WHERE id = ${e.id}`;
      } else {
        await sql`UPDATE envios_email SET status = ${status}, tentativas = ${tentativas}, erro = ${erro},
          enviado_em = ${status === "enviado" || status === "simulado" ? sql`now()` : null} WHERE id = ${e.id}`;
      }
      feitos++;
    }
  } catch (err) {
    console.error("[envios] fila:", err instanceof Error ? err.message : err);
  } finally {
    rodando = false;
  }
  return feitos;
}

export function enviosDoFechamento(fechamentoId: number) {
  return sql<{ investidor_id: number; status: StatusEnvio; erro: string; tentativas: number; enviado_em: Date | null }[]>`
    SELECT investidor_id, status, erro, tentativas, enviado_em FROM envios_email WHERE fechamento_id = ${fechamentoId}`;
}
