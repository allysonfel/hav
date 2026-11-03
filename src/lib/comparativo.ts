// Comparativo entre usinas (Plus): mesma métrica, mesmo período, lado a lado.
// Produtividade = kWh gerado por kWp instalado: é o que permite comparar
// usinas de tamanhos diferentes.
import "server-only";
import { sql } from "./db";
import { mesAtual, somarMeses } from "./format";

export type Metrica = "geracao" | "receita" | "produtividade" | "receita_kwp";
export const METRICAS: Record<Metrica, { nome: string; unidade: string }> = {
  geracao: { nome: "Geração", unidade: "kWh" },
  receita: { nome: "Receita", unidade: "R$" },
  produtividade: { nome: "Produtividade", unidade: "kWh por kWp" },
  receita_kwp: { nome: "Receita por kWp", unidade: "R$ por kWp" },
};
export const metricaDe = (v: unknown): Metrica => (typeof v === "string" && v in METRICAS ? (v as Metrica) : "produtividade");

// Cores fixas por usina (ordem de cadastro), nunca pela posição no ranking:
// filtrar o período não pode trocar a cor de uma usina. Paleta validada para
// daltonismo (vizinhas); passou de 8 usinas, as demais ficam só na tabela.
export const CORES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export type SerieUsina = {
  id: number;
  nome: string;
  cor: string | null;
  capacidade_wp: number;
  pontos: { comp: string; geracao_wh: number; receita_centavos: number }[];
};

// Valor da métrica num mês. Dinheiro em centavos; energia em Wh; produtividade em Wh/Wp (= kWh/kWp).
export function valorDe(m: Metrica, p: { geracao_wh: number; receita_centavos: number }, capacidadeWp: number): number {
  if (m === "geracao") return p.geracao_wh;
  if (m === "receita") return p.receita_centavos;
  if (m === "produtividade") return capacidadeWp ? p.geracao_wh / capacidadeWp : 0;
  return capacidadeWp ? (p.receita_centavos / capacidadeWp) * 1000 : 0; // centavos por kWp
}

// usinaIds: restringe (app do investidor). Sem lista, todas as que já tiveram mês fechado.
export async function comparativo(meses: number, usinaIds?: number[]) {
  const ate = mesAtual();
  const de = somarMeses(ate, -meses);
  const usinas = await sql<{ id: number; nome: string; capacidade_wp: number }[]>`
    SELECT id, nome, capacidade_wp FROM usinas
    WHERE status <> 'captacao' ${usinaIds ? sql`AND id = ANY(${usinaIds})` : sql``}
    ORDER BY id`;
  const fech = usinas.length
    ? await sql<{ usina_id: number; comp: string; geracao_wh: number; receita_centavos: number }[]>`
        SELECT usina_id, to_char(competencia, 'YYYY-MM') AS comp, geracao_wh, receita_centavos FROM fechamentos
        WHERE status = 'fechado' AND usina_id = ANY(${usinas.map((u) => u.id)})
          AND competencia >= ${de + "-01"}::date AND competencia < ${somarMeses(ate, 1) + "-01"}::date
        ORDER BY competencia`
    : [];
  const series: SerieUsina[] = usinas.map((u, i) => ({
    id: u.id,
    nome: u.nome,
    cor: CORES[i] ?? null,
    capacidade_wp: u.capacidade_wp,
    pontos: fech.filter((f) => f.usina_id === u.id).map((f) => ({ comp: f.comp, geracao_wh: f.geracao_wh, receita_centavos: f.receita_centavos })),
  })).filter((s) => s.pontos.length > 0);
  const comps = [...new Set(fech.map((f) => f.comp))].sort().slice(-meses);
  return { series, comps };
}
