// Geração por dia vinda das plataformas de monitoramento dos inversores
// (Solis, Solarman para Deye/Sofar e Solplanet), configuradas no painel em Integrações.
// Sincroniza os meses do período de apuração atual e do anterior, guarda em
// geracao_diaria e serve para: geração do dia no painel e no app, o "até agora"
// do período (com a receita pela tarifa), o lançamento do mês já preenchido e
// a tabela diária do relatório.
import "server-only";
import { sql } from "../db";
import { periodo, somarMeses, TZ } from "../format";
import { geracaoDoMesSolis, usinasSolis } from "./solis";
import { geracaoDoMesSolarman, usinasSolarman } from "./solarman";
import { geracaoDoMesSolplanet, usinasSolplanet } from "./solplanet";
import { ErroIntegracao, PLATAFORMAS, TIPOS_LISTA, credenciais, eTipo, type Credenciais, type Tipo } from "./credenciais";

export type { Tipo };
export const TIPOS = Object.fromEntries(TIPOS_LISTA.map((t) => [t, PLATAFORMAS[t].nome])) as Record<Tipo, string>;
export { configurada as integracaoConfigurada } from "./credenciais";

type Usina = { id: string; nome: string };
const CLIENTES: Record<Tipo, { usinas: (c: Credenciais) => Promise<Usina[]>; mes: (c: Credenciais, id: string, mes: string) => Promise<{ dia: string; wh: number }[]> }> = {
  solis: { usinas: usinasSolis, mes: geracaoDoMesSolis },
  solarman: { usinas: usinasSolarman, mes: geracaoDoMesSolarman },
  solplanet: { usinas: usinasSolplanet, mes: geracaoDoMesSolplanet },
};

// Usinas da conta de uma plataforma (para ligar às usinas da HAV). Erro vira mensagem.
export async function usinasDaPlataforma(tipo: Tipo, c?: Credenciais | null): Promise<{ configurada: boolean; usinas: Usina[]; erro?: string }> {
  const cred = c ?? (await credenciais(tipo));
  if (!cred) return { configurada: false, usinas: [] };
  try {
    return { configurada: true, usinas: await CLIENTES[tipo].usinas(cred) };
  } catch (e) {
    if (!(e instanceof ErroIntegracao)) console.error("[monitoramento]", tipo, e instanceof Error ? e.message : e);
    return { configurada: true, usinas: [], erro: e instanceof ErroIntegracao ? e.message : "falha na consulta" };
  }
}

// Usinas de todas as plataformas configuradas (para o cadastro da usina).
export async function usinasDasPlataformas(): Promise<Record<Tipo, { configurada: boolean; usinas: Usina[]; erro?: string }>> {
  const r = await Promise.all(TIPOS_LISTA.map((t) => usinasDaPlataforma(t)));
  return Object.fromEntries(TIPOS_LISTA.map((t, i) => [t, r[i]])) as Record<Tipo, { configurada: boolean; usinas: Usina[]; erro?: string }>;
}

// Dados de mais de 30 min são atualizados quando alguém abre a tela.
const VALIDADE_MS = 30 * 60_000;

export const hojeIso = (agora = new Date()) => agora.toLocaleDateString("en-CA", { timeZone: TZ });

// Competência do período em andamento (com início 21: de 21/10 a 20/11 é novembro).
export function competenciaAtual(inicio: number, agora = new Date()): string {
  const hoje = hojeIso(agora);
  const mes = hoje.slice(0, 7);
  return inicio > 1 && Number(hoje.slice(8, 10)) >= inicio ? somarMeses(mes, 1) : mes;
}

// Meses do calendário que um período cobre (21/10 a 20/11 = outubro e novembro).
function mesesDoPeriodo(comp: string, inicio: number): string[] {
  const p = periodo(comp, inicio);
  return [...new Set([p.ini.slice(0, 7), p.fim.slice(0, 7)])];
}

// Puxa da plataforma da usina e grava. Erro fica anotado na usina (aparece no painel), sem derrubar a tela.
export async function sincronizarUsina(usinaId: number, inicio: number, forcar = false): Promise<{ ok: boolean; erro?: string }> {
  const [u] = await sql<{ monitoramento_tipo: string; monitoramento_id: string; monitoramento_sinc: Date | null }[]>`
    SELECT monitoramento_tipo, monitoramento_id, monitoramento_sinc FROM usinas WHERE id = ${usinaId}`;
  const tipo = u?.monitoramento_tipo;
  const cred = u && u.monitoramento_id && eTipo(tipo) ? await credenciais(tipo) : null;
  if (!u || !eTipo(tipo) || !cred) return { ok: false, erro: "sem integração" };
  if (!forcar && u.monitoramento_sinc && Date.now() - new Date(u.monitoramento_sinc).getTime() < VALIDADE_MS) return { ok: true };
  // Marca antes de buscar: duas telas abertas juntas não chamam a plataforma duas vezes.
  await sql`UPDATE usinas SET monitoramento_sinc = now() WHERE id = ${usinaId}`;
  const atual = competenciaAtual(inicio);
  const meses = [...new Set([...mesesDoPeriodo(somarMeses(atual, -1), inicio), ...mesesDoPeriodo(atual, inicio)])];
  const hoje = hojeIso();
  try {
    for (const mes of meses) {
      const dias = (await CLIENTES[tipo].mes(cred, u.monitoramento_id, mes)).filter((d) => d.dia <= hoje);
      for (const d of dias) {
        await sql`
          INSERT INTO geracao_diaria (usina_id, dia, geracao_wh, fonte) VALUES (${usinaId}, ${d.dia}, ${d.wh}, ${tipo})
          ON CONFLICT (usina_id, dia) DO UPDATE SET geracao_wh = excluded.geracao_wh, fonte = excluded.fonte, atualizado_em = now()`;
      }
    }
    await sql`UPDATE usinas SET monitoramento_erro = '' WHERE id = ${usinaId}`;
    return { ok: true };
  } catch (e) {
    const erro = e instanceof ErroIntegracao ? e.message : `Falha ao ler os dados da ${PLATAFORMAS[tipo].nome}.`;
    if (!(e instanceof ErroIntegracao)) console.error("[monitoramento]", e instanceof Error ? e.message : e);
    await sql`UPDATE usinas SET monitoramento_erro = ${erro.slice(0, 200)} WHERE id = ${usinaId}`;
    return { ok: false, erro };
  }
}

// Atualiza em segundo plano as usinas integradas com dados velhos (chamado com after()).
export async function sincronizarVencidas(inicio: number, usinaIds?: number[]) {
  const us = await sql<{ id: number }[]>`
    SELECT id FROM usinas WHERE monitoramento_tipo <> '' AND monitoramento_id <> '' AND status <> 'captacao'
      AND (monitoramento_sinc IS NULL OR monitoramento_sinc < now() - interval '30 minutes')
      ${usinaIds ? sql`AND id IN ${sql(usinaIds.length ? usinaIds : [0])}` : sql``}`;
  for (const u of us) await sincronizarUsina(u.id, inicio);
}

export type Dia = { dia: string; geracao_wh: number };

// Geração de cada dia do período de uma competência.
export async function diasDoPeriodo(usinaId: number, comp: string, inicio: number): Promise<{ dias: Dia[]; total: number; p: ReturnType<typeof periodo> }> {
  const p = periodo(comp, inicio);
  const dias = await sql<Dia[]>`
    SELECT to_char(dia, 'YYYY-MM-DD') AS dia, geracao_wh FROM geracao_diaria
    WHERE usina_id = ${usinaId} AND dia BETWEEN ${p.ini}::date AND ${p.fim}::date ORDER BY dia`;
  return { dias: [...dias], total: dias.reduce((a, d) => a + d.geracao_wh, 0), p };
}

// Situação da integração para mostrar no painel.
export async function situacaoIntegracao(usinaId: number) {
  const [u] = await sql<{ monitoramento_tipo: string; monitoramento_id: string; monitoramento_sinc: Date | null; monitoramento_erro: string }[]>`
    SELECT monitoramento_tipo, monitoramento_id, monitoramento_sinc, monitoramento_erro FROM usinas WHERE id = ${usinaId}`;
  if (!u) return null;
  return { ...u, configurada: eTipo(u.monitoramento_tipo) && !!(await credenciais(u.monitoramento_tipo)), nome: TIPOS[u.monitoramento_tipo as Tipo] ?? "" };
}

// Todos os dias do período, com null nos que ainda não têm dado (para o gráfico).
export function grade(p: { ini: string; dias: number }, dias: Dia[]): { dia: string; geracao_wh: number | null }[] {
  const mapa = new Map(dias.map((d) => [d.dia, d.geracao_wh]));
  const ini = new Date(p.ini + "T12:00:00Z").getTime();
  return Array.from({ length: p.dias }, (_, i) => {
    const dia = new Date(ini + i * 86_400_000).toISOString().slice(0, 10);
    return { dia, geracao_wh: mapa.get(dia) ?? null };
  });
}
