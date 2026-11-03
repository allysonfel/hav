// Histórico estendido (até 24 meses fechados) e projeção simples (Plus).
// A projeção é sempre feita usina a usina e depois somada: juntar usinas antes
// misturaria meses com quantidades diferentes de usinas fechadas.
import "server-only";
import { sql } from "./db";
import { projetar, somarProjecoes, type Ponto, type Projetado } from "./projecao";

const mesesEntre = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

export type Mes = { comp: string; geracao_wh: number; receita_centavos: number };
export type Historico = { real: Mes[]; projGeracao: Projetado[]; projReceita: Projetado[] };

export const PERIODOS = [12, 24] as const;
export const periodoDe = (v: unknown) => (Number(v) === 24 ? 24 : 12);

const pontos = (l: Mes[], campo: "geracao_wh" | "receita_centavos"): Ponto[] => l.map((m) => ({ comp: m.comp, valor: m[campo] }));

// Meses fechados por usina (até 36, para a projeção sazonal ter o ano anterior).
async function porUsina(usinaId: number | null) {
  const linhas = await sql<{ usina_id: number; comp: string; geracao_wh: number; receita_centavos: number }[]>`
    SELECT usina_id, to_char(competencia, 'YYYY-MM') AS comp, geracao_wh, receita_centavos
    FROM fechamentos
    WHERE status = 'fechado' ${usinaId ? sql`AND usina_id = ${usinaId}` : sql``}
      AND competencia >= date_trunc('month', now()) - interval '36 months'
    ORDER BY competencia`;
  const mapa = new Map<number, Mes[]>();
  for (const l of linhas) {
    const lista = mapa.get(l.usina_id) ?? [];
    lista.push({ comp: l.comp, geracao_wh: l.geracao_wh, receita_centavos: l.receita_centavos });
    mapa.set(l.usina_id, lista);
  }
  return mapa;
}

// Projeção só depois do último mês real do gráfico: mês em que parte das usinas
// já fechou aparece como real (parcial), sem barra de projeção em cima.
const depoisDe = (h: Historico): Historico => {
  const ultimo = h.real[h.real.length - 1]?.comp ?? "";
  return { ...h, projGeracao: h.projGeracao.filter((p) => p.comp > ultimo), projReceita: h.projReceita.filter((p) => p.comp > ultimo) };
};

function montar(series: Mes[][], meses: number, projetarMeses: number, soOperando = true): Historico {
  const soma = new Map<string, Mes>();
  for (const s of series) {
    for (const m of s) {
      const a = soma.get(m.comp) ?? { comp: m.comp, geracao_wh: 0, receita_centavos: 0 };
      a.geracao_wh += m.geracao_wh;
      a.receita_centavos += m.receita_centavos;
      soma.set(m.comp, a);
    }
  }
  const real = [...soma.values()].sort((a, b) => (a.comp < b.comp ? -1 : 1)).slice(-meses);
  const com = (soOperando ? series : []).filter((s) => s.length);
  // Todas projetam até o mesmo mês final: usina com mês ainda aberto projeta um mês a mais,
  // senão o último mês projetado somaria só parte das usinas.
  const fim = com.reduce((a, s) => (s[s.length - 1].comp > a ? s[s.length - 1].comp : a), "");
  const quantos = (s: Mes[]) => projetarMeses + mesesEntre(s[s.length - 1].comp, fim);
  return {
    real,
    projGeracao: projetarMeses ? somarProjecoes(com.map((s) => projetar(pontos(s, "geracao_wh"), quantos(s)))) : [],
    projReceita: projetarMeses ? somarProjecoes(com.map((s) => projetar(pontos(s, "receita_centavos"), quantos(s)))) : [],
  };
}

// Uma usina, ou todas (null). Na consolidada, só usinas operando entram na projeção.
export async function historicoUsinas(usinaId: number | null, meses: number, projetarMeses = 3): Promise<Historico> {
  const mapa = await porUsina(usinaId);
  if (usinaId) return montar([mapa.get(usinaId) ?? []], meses, projetarMeses);
  const operando = new Set((await sql<{ id: number }[]>`SELECT id FROM usinas WHERE status = 'operando'`).map((u) => u.id));
  const todas = [...mapa.values()];
  const h = montar(todas, meses, 0);
  const proj = montar([...mapa.entries()].filter(([id]) => operando.has(id)).map(([, s]) => s), meses, projetarMeses);
  return depoisDe({ real: h.real, projGeracao: proj.projGeracao, projReceita: proj.projReceita });
}

// Parte do investidor (rateios), projetada usina a usina.
export async function historicoInvestidor(investidorId: number, meses: number, projetarMeses = 3): Promise<Historico> {
  const linhas = await sql<{ usina_id: number; status: string; comp: string; geracao_wh: number; receita_centavos: number }[]>`
    SELECT f.usina_id, u.status, to_char(f.competencia, 'YYYY-MM') AS comp, r.geracao_wh, r.receita_centavos
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id JOIN usinas u ON u.id = f.usina_id
    WHERE r.investidor_id = ${investidorId} AND f.competencia >= date_trunc('month', now()) - interval '36 months'
    ORDER BY f.competencia`;
  const mapa = new Map<number, Mes[]>();
  const operando = new Set<number>();
  for (const l of linhas) {
    const lista = mapa.get(l.usina_id) ?? [];
    lista.push({ comp: l.comp, geracao_wh: l.geracao_wh, receita_centavos: l.receita_centavos });
    mapa.set(l.usina_id, lista);
    if (l.status === "operando") operando.add(l.usina_id);
  }
  // A cota de hoje pode ser diferente da do passado: projeta só usinas em que ele ainda tem cota ativa.
  const ativas = new Set((await sql<{ usina_id: number }[]>`SELECT usina_id FROM cotas WHERE investidor_id = ${investidorId} AND ativa`).map((c) => c.usina_id));
  const h = montar([...mapa.values()], meses, 0);
  const proj = montar([...mapa.entries()].filter(([id]) => operando.has(id) && ativas.has(id)).map(([, s]) => s), meses, projetarMeses);
  return depoisDe({ real: h.real, projGeracao: proj.projGeracao, projReceita: proj.projReceita });
}
