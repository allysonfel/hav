// Investidores: lista com totais. Quem não é admin não recebe valores de
// usinas em captação (somarCaptacao = false).
import "server-only";
import { sql } from "./db";

export type InvestidorLinha = {
  id: number;
  nome: string;
  email: string;
  celular: string;
  ativo: boolean;
  usinas: string[];
  investido_centavos: number;
  recebido_centavos: number;
  pendentes: number;
};

const semCuringa = (s: string) => s.replace(/[%_\\]/g, "");

export function listarInvestidores(somarCaptacao: boolean, busca = "") {
  const b = semCuringa(busca.trim().slice(0, 80));
  return sql<InvestidorLinha[]>`
    SELECT i.id, i.nome, i.email, i.celular, i.ativo,
      coalesce(c.usinas, '{}') AS usinas,
      coalesce(c.investido, 0)::bigint AS investido_centavos,
      coalesce(r.recebido, 0)::bigint AS recebido_centavos,
      coalesce(r.pendentes, 0)::int AS pendentes
    FROM investidores i
    LEFT JOIN LATERAL (
      SELECT array_agg(u.nome ORDER BY u.nome) AS usinas, sum(ct.valor_centavos) AS investido
      FROM cotas ct JOIN usinas u ON u.id = ct.usina_id
      WHERE ct.investidor_id = i.id AND ct.ativa AND (${somarCaptacao} OR u.status <> 'captacao')
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT sum(ra.receita_centavos) AS recebido, count(*) FILTER (WHERE ra.repasse_status = 'pendente') AS pendentes
      FROM rateios ra WHERE ra.investidor_id = i.id
    ) r ON true
    ${b ? sql`WHERE unaccent_simples(i.nome) LIKE unaccent_simples(${`%${b}%`}) OR i.email LIKE ${`%${b.toLowerCase()}%`}` : sql``}
    ORDER BY i.ativo DESC, i.nome`;
}

export const nomeCurtoUsina = (n: string) => n.replace(/^Usina\s+/i, "");
