"use server";

// Usinas, cotistas, lançamento do mês e fechamento. Cadastro, cotas, fechar e
// repasses são só do admin; operador lança a geração como rascunho.
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cancelarPendentes, enfileirar, processarFila, reenviar } from "@/lib/envios";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { COMPETENCIA, centavosDe, mesAno, mesAtual, mesLongo, ppmDe, whDe, wpDe } from "@/lib/format";
import { PPM_TOTAL, dividir, somaPpm } from "@/lib/rateio";

const texto = (fd: FormData, campo: string, max: number) => String(fd.get(campo) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const idDe = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : 0;
};

export async function salvarUsina(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = idDe(fd.get("id"));
  const volta = id ? `/painel/usinas/${id}/editar` : "/painel/usinas/nova";
  const nome = texto(fd, "nome", 80);
  const cidade = texto(fd, "cidade", 80);
  const uf = texto(fd, "uf", 2).toUpperCase();
  const capacidade = wpDe(fd.get("capacidade"));
  const investimento = centavosDe(fd.get("investimento"));
  const s = String(fd.get("status") ?? "");
  const status = s === "captacao" || s === "pausada" ? s : "operando";
  const desdeTxt = String(fd.get("desde") ?? "");
  const desde = COMPETENCIA.test(desdeTxt) ? `${desdeTxt}-01` : null;
  const marca = texto(fd, "marca", 60);
  const modelo = texto(fd, "modelo", 60);
  const qtd = Number(fd.get("qtd") || 0);
  const monitoramento = texto(fd, "monitoramento", 120);
  if (nome.length < 2) redirect(`${volta}?erro=nome`);
  if (uf && !/^[A-Z]{2}$/.test(uf)) redirect(`${volta}?erro=uf`);
  if (!capacidade) redirect(`${volta}?erro=capacidade`);
  if (!investimento) redirect(`${volta}?erro=investimento`);
  if (!Number.isInteger(qtd) || qtd < 0 || qtd > 100000) redirect(`${volta}?erro=qtd`);
  const [mesmoNome] = await sql`SELECT 1 FROM usinas WHERE nome = ${nome} AND id <> ${id}`;
  if (mesmoNome) redirect(`${volta}?erro=duplicada`);

  if (id) {
    const r = await sql`
      UPDATE usinas SET nome = ${nome}, cidade = ${cidade}, uf = ${uf}, capacidade_wp = ${capacidade}, investimento_centavos = ${investimento},
        status = ${status}, operando_desde = ${desde}, inversor_marca = ${marca}, inversor_modelo = ${modelo}, inversor_qtd = ${qtd}, monitoramento = ${monitoramento}
      WHERE id = ${id} RETURNING id`;
    if (!r.length) redirect("/painel/usinas");
    await audit(`usuario:${u.id}`, "usina_editada", "usina", id, nome);
    redirect(`/painel/usinas/${id}?ok=usina`);
  }
  const [n] = await sql<{ id: number }[]>`
    INSERT INTO usinas (nome, cidade, uf, capacidade_wp, investimento_centavos, status, operando_desde, inversor_marca, inversor_modelo, inversor_qtd, monitoramento)
    VALUES (${nome}, ${cidade}, ${uf}, ${capacidade}, ${investimento}, ${status}, ${desde}, ${marca}, ${modelo}, ${qtd}, ${monitoramento}) RETURNING id`;
  await audit(`usuario:${u.id}`, "usina_criada", "usina", n.id, nome);
  redirect(`/painel/usinas/${n.id}?ok=usina`);
}

// Só sai usina sem movimento. Com histórico, o caminho é o status Pausada.
export async function excluirUsina(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = idDe(fd.get("id"));
  const [mov] = await sql`
    SELECT 1 WHERE EXISTS (SELECT 1 FROM fechamentos WHERE usina_id = ${id})
      OR EXISTS (SELECT 1 FROM cotas WHERE usina_id = ${id}) OR EXISTS (SELECT 1 FROM interesses WHERE usina_id = ${id})`;
  if (mov) redirect(`/painel/usinas/${id}/editar?erro=movimento`);
  const [x] = await sql<{ nome: string }[]>`DELETE FROM usinas WHERE id = ${id} RETURNING nome`;
  if (x) await audit(`usuario:${u.id}`, "usina_excluida", "usina", id, x.nome);
  redirect("/painel/usinas?ok=excluida");
}

// Grava a cota. Sem percentual digitado, calcula: valor / investimento total.
export async function salvarCota(fd: FormData) {
  const u = await requireUser(["admin"]);
  const usinaId = idDe(fd.get("usina"));
  const investidorId = idDe(fd.get("investidor"));
  const valor = centavosDe(fd.get("valor"));
  const pctTxt = String(fd.get("cota") ?? "").trim();
  const volta = `/painel/usinas/${usinaId}`;
  if (!valor) redirect(`${volta}?erro=valor#cotistas`);

  const erro = await sql.begin(async (tx) => {
    const [usina] = await tx<{ investimento_centavos: number }[]>`SELECT investimento_centavos FROM usinas WHERE id = ${usinaId} FOR UPDATE`;
    if (!usina) return "usina";
    const [inv] = await tx`SELECT 1 FROM investidores WHERE id = ${investidorId} AND ativo`;
    if (!inv) return "investidor";
    const ppm = pctTxt ? ppmDe(pctTxt) : Math.round((valor / usina.investimento_centavos) * PPM_TOTAL);
    if (!ppm || ppm > PPM_TOTAL) return "cota";
    const outras = await tx<{ cota_ppm: number }[]>`SELECT cota_ppm FROM cotas WHERE usina_id = ${usinaId} AND ativa AND investidor_id <> ${investidorId}`;
    if (somaPpm(outras) + ppm > PPM_TOTAL) return "excede";
    await tx`
      INSERT INTO cotas (usina_id, investidor_id, cota_ppm, valor_centavos) VALUES (${usinaId}, ${investidorId}, ${ppm}, ${valor})
      ON CONFLICT (usina_id, investidor_id) DO UPDATE SET cota_ppm = ${ppm}, valor_centavos = ${valor}, ativa = true`;
    return "";
  });
  if (erro) redirect(`${volta}?erro=${erro}#cotistas`);
  await audit(`usuario:${u.id}`, "cota_salva", "usina", usinaId, `investidor ${investidorId}`);
  redirect(`${volta}?ok=cota#cotistas`);
}

export async function removerCota(fd: FormData) {
  const u = await requireUser(["admin"]);
  const usinaId = idDe(fd.get("usina"));
  const investidorId = idDe(fd.get("investidor"));
  const r = await sql`UPDATE cotas SET ativa = false WHERE usina_id = ${usinaId} AND investidor_id = ${investidorId} RETURNING id`;
  if (r.length) await audit(`usuario:${u.id}`, "cota_removida", "usina", usinaId, `investidor ${investidorId}`);
  redirect(`/painel/usinas/${usinaId}?ok=cota_removida#cotistas`);
}

// Lança ou corrige o rascunho do mês. Mês fechado não muda por aqui.
export async function lancarGeracao(fd: FormData) {
  const u = await requireUser(["admin", "operador"]);
  const usinaId = idDe(fd.get("usina"));
  const comp = String(fd.get("comp") ?? "");
  const wh = whDe(fd.get("geracao"));
  const receita = centavosDe(fd.get("receita"));
  const volta = `/painel/usinas/${usinaId}/lancar`;
  if (!COMPETENCIA.test(comp) || comp > mesAtual()) redirect(`${volta}?erro=mes`);
  if (wh === null) redirect(`${volta}?erro=geracao&comp=${comp}`);
  if (receita === null) redirect(`${volta}?erro=receita&comp=${comp}`);
  const [usina] = await sql`SELECT 1 FROM usinas WHERE id = ${usinaId} AND status <> 'captacao'`;
  if (!usina) redirect("/painel/usinas");
  const [f] = await sql<{ id: number }[]>`
    INSERT INTO fechamentos (usina_id, competencia, geracao_wh, receita_centavos, lancado_por)
    VALUES (${usinaId}, ${comp + "-01"}::date, ${wh}, ${receita}, ${u.id})
    ON CONFLICT (usina_id, competencia) DO UPDATE
      SET geracao_wh = ${wh}, receita_centavos = ${receita}, lancado_por = ${u.id}, lancado_em = now()
      WHERE fechamentos.status = 'rascunho'
    RETURNING id`;
  if (!f) redirect(`${volta}?erro=fechado&comp=${comp}`);
  await audit(`usuario:${u.id}`, "geracao_lancada", "fechamento", f.id, `${mesAno(comp)}: ${wh} Wh, ${receita} centavos`);
  redirect(`/painel/fechamentos/${f.id}?ok=lancado`);
}

// Fecha o mês: tira a foto das cotas e grava o rateio de cada cotista. Daqui em
// diante o mês aparece nos relatórios e entra nos repasses.
export async function fecharMes(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = idDe(fd.get("id"));
  const volta = `/painel/fechamentos/${id}`;
  const erro = await sql.begin(async (tx) => {
    const [f] = await tx<{ usina_id: number; geracao_wh: number; receita_centavos: number; status: string }[]>`
      SELECT usina_id, geracao_wh, receita_centavos, status FROM fechamentos WHERE id = ${id} FOR UPDATE`;
    if (!f) return "nao_achou";
    if (f.status !== "rascunho") return "ja_fechado";
    const cotas = await tx<{ investidor_id: number; cota_ppm: number }[]>`
      SELECT investidor_id, cota_ppm FROM cotas WHERE usina_id = ${f.usina_id} AND ativa ORDER BY investidor_id`;
    if (somaPpm(cotas) !== PPM_TOTAL) return "cotas";
    const ppms = cotas.map((c) => c.cota_ppm);
    const geracao = dividir(f.geracao_wh, ppms);
    const receita = dividir(f.receita_centavos, ppms);
    for (let i = 0; i < cotas.length; i++) {
      await tx`
        INSERT INTO rateios (fechamento_id, investidor_id, cota_ppm, geracao_wh, receita_centavos)
        VALUES (${id}, ${cotas[i].investidor_id}, ${ppms[i]}, ${geracao[i]}, ${receita[i]})`;
    }
    await tx`UPDATE fechamentos SET status = 'fechado', fechado_por = ${u.id}, fechado_em = now() WHERE id = ${id}`;
    return "";
  });
  if (erro) redirect(`${volta}?erro=${erro}`);
  await audit(`usuario:${u.id}`, "mes_fechado", "fechamento", id);
  const [f] = await sql<{ usina: string; comp: string }[]>`
    SELECT u.nome AS usina, to_char(f.competencia, 'YYYY-MM') AS comp FROM fechamentos f JOIN usinas u ON u.id = f.usina_id WHERE f.id = ${id}`;
  await sql`
    INSERT INTO avisos_investidor (investidor_id, titulo, texto, href)
    SELECT investidor_id, ${`Relatório de ${mesLongo(f.comp)}`}, ${`${f.usina}: sua receita do mês já está disponível.`}, '/relatorios'
    FROM rateios WHERE fechamento_id = ${id}`;
  // Relatório por e-mail: entra na fila agora e sai depois da resposta.
  await enfileirar(id);
  after(() => processarFila());
  redirect(`${volta}?ok=fechado`);
}

// Reabre para correção, desde que nada tenha sido pago. Os valores antigos
// ficam no audit_log.
export async function reabrirMes(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = idDe(fd.get("id"));
  const volta = `/painel/fechamentos/${id}`;
  const erro = await sql.begin(async (tx) => {
    const [f] = await tx<{ status: string }[]>`SELECT status FROM fechamentos WHERE id = ${id} FOR UPDATE`;
    if (!f || f.status !== "fechado") return "nao_achou";
    const [pago] = await tx`SELECT 1 FROM rateios WHERE fechamento_id = ${id} AND repasse_status = 'pago' LIMIT 1`;
    if (pago) return "tem_pago";
    await tx`DELETE FROM rateios WHERE fechamento_id = ${id}`;
    await tx`UPDATE fechamentos SET status = 'rascunho', fechado_por = NULL, fechado_em = NULL WHERE id = ${id}`;
    return "";
  });
  if (erro) redirect(`${volta}?erro=${erro}`);
  await audit(`usuario:${u.id}`, "mes_reaberto", "fechamento", id);
  await cancelarPendentes(id);
  redirect(`${volta}?ok=reaberto`);
}

// Só registra o repasse: o pagamento é feito fora do sistema.
export async function marcarRepasse(fd: FormData) {
  const u = await requireUser(["admin"]);
  const fechamento = idDe(fd.get("fechamento"));
  const rateio = idDe(fd.get("rateio"));
  const pago = fd.get("pago") === "1";
  const r = pago
    ? await sql`
        UPDATE rateios SET repasse_status = 'pago', pago_em = now(), pago_por = ${u.id}
        WHERE fechamento_id = ${fechamento} AND repasse_status = 'pendente' ${rateio ? sql`AND id = ${rateio}` : sql``} RETURNING id, investidor_id`
    : await sql`
        UPDATE rateios SET repasse_status = 'pendente', pago_em = NULL, pago_por = NULL
        WHERE fechamento_id = ${fechamento} AND id = ${rateio} AND repasse_status = 'pago' RETURNING id, investidor_id`;
  if (r.length) await audit(`usuario:${u.id}`, pago ? "repasse_pago" : "repasse_desfeito", "fechamento", fechamento, `${r.length} repasse(s)`);
  if (pago && r.length) {
    const [f] = await sql<{ usina: string; comp: string }[]>`
      SELECT u.nome AS usina, to_char(f.competencia, 'YYYY-MM') AS comp FROM fechamentos f JOIN usinas u ON u.id = f.usina_id WHERE f.id = ${fechamento}`;
    const ids = r.map((x) => x.investidor_id as number);
    await sql`
      INSERT INTO avisos_investidor (investidor_id, titulo, texto, href)
      SELECT unnest(${ids}::int[]), ${`Repasse de ${mesLongo(f.comp)}`}, ${`${f.usina}: repasse registrado como pago.`}, '/relatorios'`;
  }
  redirect(`/painel/fechamentos/${fechamento}?ok=repasse`);
}

export async function reenviarEmail(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = idDe(fd.get("fechamento"));
  const inv = idDe(fd.get("investidor"));
  if (!id) redirect("/painel/relatorios");
  await reenviar(id, inv || undefined);
  await audit(`usuario:${u.id}`, "email_reenviado", "fechamento", id, inv ? `investidor ${inv}` : "falhas");
  after(() => processarFila());
  redirect(`/painel/fechamentos/${id}?ok=reenvio`);
}
