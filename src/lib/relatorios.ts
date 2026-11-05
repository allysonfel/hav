// Dados dos relatórios em PDF (Plus). Toda consulta recebe quem pode ver:
// o investidor só chega ao próprio rateio; o painel, a qualquer mês fechado.
import "server-only";
import { sql } from "./db";
import { getSettings, type Settings } from "./settings";
import { decifrar } from "./cifra";
import { abrirConta, type Conta } from "./contaBancaria";
import { diasDoPeriodo } from "./monitoramento";

export type RelatorioInvestidor = {
  empresa: Settings;
  investidor: { id: number; nome: string; email: string };
  fechamento: { id: number; comp: string; fechado_em: Date; usina: string; cidade: string; uf: string; capacidade_wp: number; geracao_wh: number; receita_centavos: number };
  rateio: { cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string; pago_em: Date | null };
  // Modelo do relatório da HAV: tarifa e disponibilidade do mês, esperado da
  // usina, valor investido na cota (aporte) e dados para o pagamento.
  extra: { tarifa_aferida: number | null; tarifa_kwh: number | null; disponibilidade_ppm: number | null; esperada_wh: number | null; aporte_centavos: number; pix: string; conta: Conta | null };
  // Geração de cada dia do período (da usina inteira), quando há integração.
  dias: { dia: string; geracao_wh: number }[];
  historico: { comp: string; geracao_wh: number; receita_centavos: number }[];
  acumulado_centavos: number;
};

export async function relatorioInvestidor(fechamentoId: number, investidorId: number): Promise<RelatorioInvestidor | null> {
  type Linha = Omit<RelatorioInvestidor["fechamento"], "geracao_wh" | "receita_centavos"> & RelatorioInvestidor["rateio"]
    & { usina_id: number; f_geracao: number; f_receita: number; inv_nome: string; inv_email: string; tarifa_kwh: number | null; disponibilidade_ppm: number | null; esperada_wh: number | null; tarifa_aferida: number | null; aporte_centavos: number | null; pix_cifrado: string | null; conta_cifrada: string | null };
  const [l] = await sql<Linha[]>`
    SELECT f.id, to_char(f.competencia, 'YYYY-MM') AS comp, f.fechado_em, u.id AS usina_id, u.nome AS usina, u.cidade, u.uf, u.capacidade_wp,
      f.geracao_wh AS f_geracao, f.receita_centavos AS f_receita,
      r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status, r.pago_em, i.nome AS inv_nome, i.email AS inv_email,
      f.tarifa_kwh, f.disponibilidade_ppm, u.geracao_esperada_wh AS esperada_wh, u.tarifa_aferida, i.pix_cifrado, i.conta_cifrada,
      (SELECT c.valor_centavos FROM cotas c WHERE c.usina_id = u.id AND c.investidor_id = i.id) AS aporte_centavos
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id JOIN usinas u ON u.id = f.usina_id JOIN investidores i ON i.id = r.investidor_id
    WHERE r.fechamento_id = ${fechamentoId} AND r.investidor_id = ${investidorId} AND f.status = 'fechado'`;
  if (!l) return null;
  const historico = await sql<{ comp: string; geracao_wh: number; receita_centavos: number }[]>`
    SELECT to_char(f.competencia, 'YYYY-MM') AS comp, r.geracao_wh, r.receita_centavos
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id
    WHERE r.investidor_id = ${investidorId} AND f.usina_id = ${l.usina_id} AND f.competencia <= ${l.comp + "-01"}::date
    ORDER BY f.competencia DESC LIMIT 12`;
  const [{ total }] = await sql<{ total: number }[]>`
    SELECT coalesce(sum(r.receita_centavos), 0)::bigint AS total
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id
    WHERE r.investidor_id = ${investidorId} AND f.usina_id = ${l.usina_id} AND f.competencia <= ${l.comp + "-01"}::date`;
  return {
    empresa: await getSettings(),
    investidor: { id: investidorId, nome: l.inv_nome, email: l.inv_email },
    fechamento: { id: l.id, comp: l.comp, fechado_em: l.fechado_em, usina: l.usina, cidade: l.cidade, uf: l.uf, capacidade_wp: l.capacidade_wp, geracao_wh: l.f_geracao, receita_centavos: l.f_receita },
    rateio: { cota_ppm: l.cota_ppm, geracao_wh: l.geracao_wh, receita_centavos: l.receita_centavos, repasse_status: l.repasse_status, pago_em: l.pago_em },
    extra: { tarifa_aferida: l.tarifa_aferida, tarifa_kwh: l.tarifa_kwh, disponibilidade_ppm: l.disponibilidade_ppm, esperada_wh: l.esperada_wh, aporte_centavos: l.aporte_centavos ?? 0, pix: decifrar(l.pix_cifrado), conta: abrirConta(l.conta_cifrada) },
    historico: [...historico].reverse(),
    acumulado_centavos: total,
    dias: (await diasDoPeriodo(l.usina_id, l.comp, (await getSettings()).inicioPeriodo)).dias,
  };
}

export type RelatorioFechamento = {
  empresa: Settings;
  fechamento: RelatorioInvestidor["fechamento"] & { quem: string | null };
  linhas: { nome: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string; pago_em: Date | null }[];
};

export async function relatorioFechamento(fechamentoId: number): Promise<RelatorioFechamento | null> {
  const [f] = await sql<(RelatorioFechamento["fechamento"])[]>`
    SELECT f.id, to_char(f.competencia, 'YYYY-MM') AS comp, f.fechado_em, u.nome AS usina, u.cidade, u.uf, u.capacidade_wp,
      f.geracao_wh, f.receita_centavos, q.nome AS quem
    FROM fechamentos f JOIN usinas u ON u.id = f.usina_id LEFT JOIN usuarios q ON q.id = f.fechado_por
    WHERE f.id = ${fechamentoId} AND f.status = 'fechado'`;
  if (!f) return null;
  const linhas = await sql<RelatorioFechamento["linhas"]>`
    SELECT i.nome, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status, r.pago_em
    FROM rateios r JOIN investidores i ON i.id = r.investidor_id
    WHERE r.fechamento_id = ${fechamentoId} ORDER BY r.cota_ppm DESC, i.nome`;
  return { empresa: await getSettings(), fechamento: f, linhas: [...linhas] };
}
