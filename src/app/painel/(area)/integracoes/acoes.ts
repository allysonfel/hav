"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { PLATAFORMAS, anotarTeste, completas, credenciaisSalvas, eTipo, removerCredenciais, salvarCredenciais, type Credenciais } from "@/lib/monitoramento/credenciais";
import { sincronizarUsina, usinasDaPlataforma } from "@/lib/monitoramento";

const volta = (tipo: string, q: string) => `/painel/integracoes?${q}&t=${tipo}#${tipo}`;

// Salva as credenciais e já testa a conexão listando as usinas da conta.
// Campo secreto em branco mantém o que estava guardado.
export async function salvarIntegracao(fd: FormData) {
  const u = await requireUser(["admin"]);
  const tipo = String(fd.get("tipo"));
  if (!eTipo(tipo)) redirect("/painel/integracoes");
  const antes = await credenciaisSalvas(tipo);
  const c: Credenciais = {};
  for (const f of PLATAFORMAS[tipo].campos) {
    const v = String(fd.get(f.k) ?? "").trim().slice(0, 400);
    c[f.k] = f.secreto && !v ? (antes[f.k] ?? "") : v;
  }
  // Só https; fora de produção também aceita o simulador local (http://localhost).
  const local = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(c.url);
  if (c.url && !local && !/^https:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(c.url)) redirect(volta(tipo, "erro=url"));
  if (c.orgId && !/^\d{1,20}$/.test(c.orgId)) redirect(volta(tipo, "erro=org"));
  if (!completas(tipo, c)) redirect(volta(tipo, "erro=campos"));
  await salvarCredenciais(tipo, c);
  const teste = await usinasDaPlataforma(tipo, c);
  const ok = !teste.erro;
  await anotarTeste(tipo, ok, ok ? `${teste.usinas.length} usina(s) encontrada(s)` : teste.erro!);
  await audit(`usuario:${u.id}`, "integracao_salva", null, null, `${tipo}: ${ok ? "conectou" : "falhou"}`);
  redirect(volta(tipo, ok ? "ok=testada" : "erro=teste"));
}

export async function removerIntegracao(fd: FormData) {
  const u = await requireUser(["admin"]);
  const tipo = String(fd.get("tipo"));
  if (!eTipo(tipo)) redirect("/painel/integracoes");
  await removerCredenciais(tipo);
  await audit(`usuario:${u.id}`, "integracao_removida", null, null, tipo);
  redirect(volta(tipo, "ok=removida"));
}

// Liga uma usina da plataforma a uma usina da HAV (ou desliga, com usina 0).
export async function ligarUsina(fd: FormData) {
  const u = await requireUser(["admin"]);
  const tipo = String(fd.get("tipo"));
  const idPlataforma = String(fd.get("id_plataforma") ?? "").trim();
  const usinaId = Number(fd.get("usina"));
  if (!eTipo(tipo) || !/^[\w-]{1,80}$/.test(idPlataforma) || !Number.isInteger(usinaId) || usinaId < 0) redirect("/painel/integracoes");
  await sql.begin(async (tx) => {
    // Uma usina da plataforma alimenta uma só usina da HAV.
    await tx`UPDATE usinas SET monitoramento_tipo = '', monitoramento_id = '', monitoramento_sinc = NULL, monitoramento_erro = ''
      WHERE monitoramento_tipo = ${tipo} AND monitoramento_id = ${idPlataforma} AND id <> ${usinaId}`;
    if (usinaId) await tx`UPDATE usinas SET monitoramento_tipo = ${tipo}, monitoramento_id = ${idPlataforma}, monitoramento_sinc = NULL, monitoramento_erro = '' WHERE id = ${usinaId}`;
  });
  await audit(`usuario:${u.id}`, usinaId ? "integracao_usina_ligada" : "integracao_usina_desligada", usinaId ? "usina" : null, usinaId || null, `${tipo} ${idPlataforma}`);
  if (usinaId) await sincronizarUsina(usinaId, (await getSettings()).inicioPeriodo, true);
  redirect(volta(tipo, usinaId ? "ok=ligada" : "ok=desligada"));
}
