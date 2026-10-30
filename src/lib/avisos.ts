// Sino do painel: pendências calculadas na hora, a partir dos dados. O que é
// de captação e repasse só aparece para o administrador.
import "server-only";
import { sql } from "./db";
import { competenciaEsperada, mesAno } from "./format";
import { PPM_TOTAL } from "./rateio";
import type { Usuario } from "./session";
import { getSettings } from "./settings";

export type Aviso = { texto: string; href: string };

export async function avisosDe(u: Usuario): Promise<Aviso[]> {
  const s = await getSettings();
  const comp = competenciaEsperada(s.diaFechamento);
  const avisos: Aviso[] = [];

  const faltam = await sql<{ id: number; nome: string }[]>`
    SELECT u.id, u.nome FROM usinas u
    WHERE u.status = 'operando'
      AND NOT EXISTS (SELECT 1 FROM fechamentos f WHERE f.usina_id = u.id AND f.competencia = ${comp + "-01"}::date)
    ORDER BY u.nome`;
  for (const f of faltam) avisos.push({ texto: `${f.nome}: falta lançar ${mesAno(comp)}`, href: `/painel/usinas/${f.id}/lancar` });

  if (u.perfil !== "admin") return avisos;

  const rascunhos = await sql<{ id: number; nome: string; comp: string }[]>`
    SELECT f.id, u.nome, to_char(f.competencia, 'YYYY-MM') AS comp
    FROM fechamentos f JOIN usinas u ON u.id = f.usina_id
    WHERE f.status = 'rascunho' ORDER BY f.competencia`;
  for (const r of rascunhos) avisos.push({ texto: `${r.nome}: ${mesAno(r.comp)} aguarda fechamento`, href: `/painel/fechamentos/${r.id}` });

  const cotas = await sql<{ id: number; nome: string }[]>`
    SELECT u.id, u.nome FROM usinas u
    WHERE u.status = 'operando'
      AND coalesce((SELECT sum(c.cota_ppm) FROM cotas c WHERE c.usina_id = u.id AND c.ativa), 0) <> ${PPM_TOTAL}
    ORDER BY u.nome`;
  for (const c of cotas) avisos.push({ texto: `${c.nome}: cotas não somam 100%`, href: `/painel/usinas/${c.id}` });

  const [{ n: interessados }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM interesses WHERE status = 'aguardando'`;
  if (interessados) avisos.push({ texto: `${interessados} interessado(s) aguardando contato`, href: "/painel/captacao" });

  const [{ n: repasses }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM rateios WHERE repasse_status = 'pendente'`;
  if (repasses) avisos.push({ texto: `${repasses} repasse(s) pendente(s)`, href: "/painel/relatorios?repasse=pendente" });
  return avisos;
}
