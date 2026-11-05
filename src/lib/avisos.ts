// Sino do painel: pendências calculadas na hora, a partir dos dados. O que é
// de captação e repasse só aparece para o administrador.
import "server-only";
import { sql } from "./db";
import { competenciaEsperada, mesAno } from "./format";
import { PPM_TOTAL } from "./rateio";
import type { Usuario } from "./session";
import { getSettings } from "./settings";
import { LIMITE_ESPERADO } from "./acompanhamento";

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

  // Último mês lançado de cada usina abaixo do esperado (inversor parado, sujeira, sombra...).
  const abaixo = await sql<{ id: number; nome: string; comp: string; pct: number }[]>`
    SELECT u.id, u.nome, to_char(f.competencia, 'YYYY-MM') AS comp, round(f.geracao_wh * 100.0 / u.geracao_esperada_wh)::int AS pct
    FROM usinas u JOIN LATERAL (
      SELECT competencia, geracao_wh FROM fechamentos WHERE usina_id = u.id ORDER BY competencia DESC LIMIT 1
    ) f ON true
    WHERE u.status = 'operando' AND u.geracao_esperada_wh IS NOT NULL AND f.geracao_wh < u.geracao_esperada_wh * ${LIMITE_ESPERADO}::numeric
    ORDER BY u.nome`;
  for (const a of abaixo) avisos.push({ texto: `${a.nome}: gerou ${a.pct}% do esperado em ${mesAno(a.comp)}`, href: `/painel/usinas/${a.id}` });

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
  const [{ n: atrasados }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id
    WHERE r.repasse_status = 'pendente' AND f.fechado_em < now() - make_interval(days => ${s.prazoRepasse})`;
  if (atrasados) avisos.push({ texto: `${atrasados} repasse(s) atrasado(s), passou do prazo de ${s.prazoRepasse} dias`, href: "/painel/relatorios?repasse=pendente" });
  else if (repasses) avisos.push({ texto: `${repasses} repasse(s) pendente(s)`, href: "/painel/relatorios?repasse=pendente" });

  // O serviço de backup (pasta backup/) grava "backup.ok" no audit_log a cada execução.
  // Só monitora onde o backup está ligado (BACKUP_MONITORAR=sim).
  if (process.env.BACKUP_MONITORAR === "sim") {
    const [b] = await sql<{ atrasado: boolean }[]>`
      SELECT coalesce(max(criado_em) < now() - interval '36 hours', true) AS atrasado FROM audit_log WHERE acao = 'backup.ok'`;
    if (b.atrasado) avisos.push({ texto: "Backup atrasado: nenhum backup nas últimas 36 h. Avise a Logos.", href: "/painel" });
  }
  return avisos;
}
