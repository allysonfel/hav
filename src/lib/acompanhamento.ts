// Acompanhamento que dá clareza ao investidor e à equipe:
// - geração real × esperada (meta mensal do projeto da usina);
// - data prevista do repasse (prazo em Configurações) e atraso;
// - rentabilidade do investidor (só números reais, nunca promessa).
import "server-only";
import { sql } from "./db";
import { num } from "./format";

// Abaixo de 85% do esperado a usina aparece como "abaixo do esperado".
export const LIMITE_ESPERADO = 0.85;

export function relacaoEsperado(geracaoWh: number | null | undefined, esperadaWh: number | null | undefined): number | null {
  if (!geracaoWh && geracaoWh !== 0) return null;
  if (!esperadaWh) return null;
  return geracaoWh / esperadaWh;
}

export function situacaoEsperado(r: number | null): { texto: string; classe: "pill-ok" | "pill-warn"; abaixo: boolean } | null {
  if (r === null) return null;
  const abaixo = r < LIMITE_ESPERADO;
  return { texto: `${num(r * 100)}% do esperado`, classe: abaixo ? "pill-warn" : "pill-ok", abaixo };
}

const DIA = 86_400_000;
export function previsaoRepasse(fechadoEm: Date | string | null, prazoDias: number): Date | null {
  if (!fechadoEm) return null;
  return new Date(new Date(fechadoEm).getTime() + prazoDias * DIA);
}
export const atrasado = (prevista: Date | null, status: string) => status === "pendente" && !!prevista && prevista.getTime() < Date.now();

// Rentabilidade em % (2 casas), ex.: "1,85%".
export const pctTexto = (parte: number, total: number) => (total > 0 ? `${num((parte / total) * 100, 2)}%` : "—");

export type Rendimento = {
  investido: number;
  recebido: number; // repasses pagos
  aReceber: number; // repasses de meses fechados ainda não pagos
  ultimo: { comp: string; receita: number } | null;
  usinas: { usina_id: number; investido: number; total: number; pago: number; meses: number; ultimaComp: string | null; ultimaReceita: number }[];
};

// Tudo em centavos. Investido = cotas ativas; recebido e a receber = meses fechados.
export async function rendimentoInvestidor(investidorId: number): Promise<Rendimento> {
  const usinas = await sql<{ usina_id: number; investido: number; total: number; pago: number; meses: number; ultima_comp: string | null; ultima_receita: number }[]>`
    SELECT c.usina_id, c.valor_centavos::bigint AS investido,
      coalesce(sum(r.receita_centavos), 0)::bigint AS total,
      coalesce(sum(r.receita_centavos) FILTER (WHERE r.repasse_status = 'pago'), 0)::bigint AS pago,
      count(r.id)::int AS meses,
      to_char(max(f.competencia), 'YYYY-MM') AS ultima_comp,
      coalesce((SELECT r2.receita_centavos FROM rateios r2 JOIN fechamentos f2 ON f2.id = r2.fechamento_id
        WHERE r2.investidor_id = c.investidor_id AND f2.usina_id = c.usina_id ORDER BY f2.competencia DESC LIMIT 1), 0)::bigint AS ultima_receita
    FROM cotas c
    LEFT JOIN fechamentos f ON f.usina_id = c.usina_id AND f.status = 'fechado'
    LEFT JOIN rateios r ON r.fechamento_id = f.id AND r.investidor_id = c.investidor_id
    WHERE c.investidor_id = ${investidorId} AND c.ativa
    GROUP BY c.usina_id, c.valor_centavos, c.investidor_id`;
  const [ult] = await sql<{ comp: string; receita: number }[]>`
    SELECT to_char(f.competencia, 'YYYY-MM') AS comp, sum(r.receita_centavos)::bigint AS receita
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id
    WHERE r.investidor_id = ${investidorId}
    GROUP BY f.competencia ORDER BY f.competencia DESC LIMIT 1`;
  const n = (v: unknown) => Number(v) || 0;
  const lista = usinas.map((u) => ({ usina_id: u.usina_id, investido: n(u.investido), total: n(u.total), pago: n(u.pago), meses: u.meses, ultimaComp: u.ultima_comp, ultimaReceita: n(u.ultima_receita) }));
  const total = lista.reduce((a, u) => a + u.total, 0);
  const recebido = lista.reduce((a, u) => a + u.pago, 0);
  return {
    investido: lista.reduce((a, u) => a + u.investido, 0),
    recebido,
    aReceber: total - recebido,
    ultimo: ult ? { comp: ult.comp, receita: n(ult.receita) } : null,
    usinas: lista,
  };
}
