// Consultas do app do investidor. Toda função recebe o id da sessão e filtra
// por ele. Só entra mês fechado: rascunho nunca aparece aqui.
import "server-only";
import { sql } from "./db";

export type MinhaUsina = {
  usina_id: number;
  nome: string;
  cidade: string;
  uf: string;
  status: string;
  capacidade_wp: number;
  desde: string | null;
  cota_ppm: number;
  valor_centavos: number;
  comp: string | null;
  geracao_wh: number | null;
  receita_centavos: number | null;
  geracao_esperada_wh: number | null;
};

export function minhasUsinas(investidorId: number) {
  return sql<MinhaUsina[]>`
    SELECT c.usina_id, u.nome, u.cidade, u.uf, u.status, u.capacidade_wp, to_char(u.operando_desde, 'YYYY-MM') AS desde, u.geracao_esperada_wh,
      c.cota_ppm, c.valor_centavos, r.comp, r.geracao_wh, r.receita_centavos
    FROM cotas c JOIN usinas u ON u.id = c.usina_id
    LEFT JOIN LATERAL (
      SELECT to_char(f.competencia, 'YYYY-MM') AS comp, ra.geracao_wh, ra.receita_centavos
      FROM rateios ra JOIN fechamentos f ON f.id = ra.fechamento_id
      WHERE ra.investidor_id = c.investidor_id AND f.usina_id = c.usina_id
      ORDER BY f.competencia DESC LIMIT 1
    ) r ON true
    WHERE c.investidor_id = ${investidorId} AND c.ativa ORDER BY u.nome`;
}

// Soma de todas as usinas por mês, do mais antigo ao mais novo.
export async function minhaSerie(investidorId: number, meses = 6) {
  const linhas = await sql<{ comp: string; usinas: number; geracao_wh: number; receita_centavos: number }[]>`
    SELECT to_char(f.competencia, 'YYYY-MM') AS comp, count(*)::int AS usinas,
      sum(r.geracao_wh)::bigint AS geracao_wh, sum(r.receita_centavos)::bigint AS receita_centavos
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id
    WHERE r.investidor_id = ${investidorId}
    GROUP BY f.competencia ORDER BY f.competencia DESC LIMIT ${meses}`;
  return [...linhas].reverse();
}

export function meusRelatorios(investidorId: number) {
  return sql<{ fechamento_id: number; usina_id: number; usina: string; comp: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string; fechado_em: Date; pago_em: Date | null; comprovante: boolean }[]>`
    SELECT f.id AS fechamento_id, f.usina_id, u.nome AS usina, to_char(f.competencia, 'YYYY-MM') AS comp,
      r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status, f.fechado_em, r.pago_em,
      EXISTS (SELECT 1 FROM comprovantes c WHERE c.rateio_id = r.id) AS comprovante
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id JOIN usinas u ON u.id = f.usina_id
    WHERE r.investidor_id = ${investidorId} ORDER BY f.competencia DESC, u.nome`;
}

export async function avisosNaoLidos(investidorId: number): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM avisos_investidor WHERE investidor_id = ${investidorId} AND lido_em IS NULL`;
  return n;
}

// Usinas abertas à captação, com o total captado (nunca quem investiu).
export function oportunidades() {
  return sql<{ id: number; nome: string; cidade: string; uf: string; capacidade_wp: number; meta_centavos: number; captado_centavos: number }[]>`
    SELECT u.id, u.nome, u.cidade, u.uf, u.capacidade_wp, u.investimento_centavos AS meta_centavos,
      coalesce((SELECT sum(c.valor_centavos) FROM cotas c WHERE c.usina_id = u.id AND c.ativa), 0)::bigint AS captado_centavos
    FROM usinas u WHERE u.status = 'captacao' ORDER BY u.nome`;
}
