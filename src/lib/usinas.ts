// Consultas de usinas e totais usados nas telas do painel.
import "server-only";
import { sql } from "./db";

export type StatusUsina = "operando" | "captacao" | "pausada";
export const STATUS_USINA: Record<StatusUsina, string> = { operando: "Operando", captacao: "Em captação", pausada: "Pausada" };

export type UsinaResumo = {
  id: number;
  nome: string;
  cidade: string;
  uf: string;
  capacidade_wp: number;
  investimento_centavos: number;
  status: StatusUsina;
  cotistas: number;
  cotas_ppm: number;
  captado_centavos: number;
  geracao_wh: number | null;
  receita_centavos: number | null;
  comp: string | null;
};

// Com os números do último mês fechado de cada usina.
export function listarUsinas() {
  return sql<UsinaResumo[]>`
    SELECT u.id, u.nome, u.cidade, u.uf, u.capacidade_wp, u.investimento_centavos, u.status,
      count(c.id)::int AS cotistas,
      coalesce(sum(c.cota_ppm), 0)::int AS cotas_ppm,
      coalesce(sum(c.valor_centavos), 0)::bigint AS captado_centavos,
      f.geracao_wh, f.receita_centavos, to_char(f.competencia, 'YYYY-MM') AS comp
    FROM usinas u
    LEFT JOIN cotas c ON c.usina_id = u.id AND c.ativa
    LEFT JOIN LATERAL (
      SELECT geracao_wh, receita_centavos, competencia FROM fechamentos
      WHERE usina_id = u.id AND status = 'fechado' ORDER BY competencia DESC LIMIT 1
    ) f ON true
    GROUP BY u.id, f.geracao_wh, f.receita_centavos, f.competencia
    ORDER BY CASE u.status WHEN 'operando' THEN 0 WHEN 'captacao' THEN 1 ELSE 2 END, u.nome`;
}

export const local = (u: { cidade: string; uf: string }) => [u.cidade, u.uf].filter(Boolean).join(", ");

// Totais dos últimos meses fechados (de uma usina ou de todas), do mais antigo ao mais novo.
export async function serieMensal(usinaId: number | null, meses = 6) {
  const linhas = await sql<{ comp: string; usinas: number; geracao_wh: number; receita_centavos: number }[]>`
    SELECT to_char(competencia, 'YYYY-MM') AS comp, count(*)::int AS usinas, sum(geracao_wh)::bigint AS geracao_wh, sum(receita_centavos)::bigint AS receita_centavos
    FROM fechamentos WHERE status = 'fechado' ${usinaId ? sql`AND usina_id = ${usinaId}` : sql``}
    GROUP BY competencia ORDER BY competencia DESC LIMIT ${meses}`;
  return [...linhas].reverse();
}
