"use server";

// Cadastro de investidores (só admin). CPF/CNPJ e chave Pix são gravados
// criptografados; o hash só impede documento repetido.
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { cifrar, hashDocumento } from "@/lib/cifra";
import { cifrarConta, contaDoForm } from "@/lib/contaBancaria";
import { celularValido, cnpjValido, cpfValido, soDigitos } from "@/lib/cpf";
import { EMAIL } from "@/lib/settings";
import { criarLink, enviarLink, VALIDADE } from "@/lib/acesso";
import { guardarSegredo } from "@/lib/segredo";

export async function salvarInvestidor(fd: FormData) {
  const u = await requireUser(["admin"]);
  const idN = Number(fd.get("id"));
  const id = Number.isInteger(idN) && idN > 0 ? idN : 0;
  const volta = id ? `/painel/investidores/${id}/editar` : "/painel/investidores/novo";
  const nome = String(fd.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const celTxt = String(fd.get("celular") ?? "").trim();
  const celular = celTxt ? celularValido(celTxt) : "";
  const docTxt = String(fd.get("documento") ?? "").trim();
  const pix = String(fd.get("pix") ?? "").trim().slice(0, 140);
  const documento = !docTxt ? "" : soDigitos(docTxt).length > 11 ? cnpjValido(docTxt) : cpfValido(docTxt);
  if (nome.length < 2) redirect(`${volta}?erro=nome`);
  if (!EMAIL.test(email)) redirect(`${volta}?erro=email`);
  if (celular === null) redirect(`${volta}?erro=celular`);
  if (documento === null) redirect(`${volta}?erro=documento`);
  const conta = contaDoForm(fd);
  if (conta === "incompleta") redirect(`${volta}?erro=conta`);

  const hash = documento ? hashDocumento(documento) : null;
  const [dupEmail] = await sql`SELECT 1 FROM investidores WHERE email = ${email} AND id <> ${id}`;
  if (dupEmail) redirect(`${volta}?erro=email_dup`);
  if (hash) {
    const [dupDoc] = await sql`SELECT 1 FROM investidores WHERE documento_hash = ${hash} AND id <> ${id}`;
    if (dupDoc) redirect(`${volta}?erro=documento_dup`);
  }
  const campos = {
    documento_cifrado: documento ? cifrar(documento) : null,
    documento_hash: hash,
    documento_final: documento ? documento.slice(-2) : "",
    pix_cifrado: pix ? cifrar(pix) : null,
    conta_cifrada: cifrarConta(conta),
  };
  if (id) {
    // Trocar o e-mail derruba a sessão do app: o login muda.
    const r = await sql`
      UPDATE investidores SET nome = ${nome}, email = ${email}, celular = ${celular}, documento_cifrado = ${campos.documento_cifrado},
        documento_hash = ${campos.documento_hash}, documento_final = ${campos.documento_final}, pix_cifrado = ${campos.pix_cifrado}, conta_cifrada = ${campos.conta_cifrada},
        sessao_versao = CASE WHEN email = ${email} THEN sessao_versao ELSE sessao_versao + 1 END
      WHERE id = ${id} RETURNING id`;
    if (!r.length) redirect("/painel/investidores");
    await audit(`usuario:${u.id}`, "investidor_editado", "investidor", id);
    redirect(`/painel/investidores/${id}?ok=salvo`);
  }
  const [n] = await sql<{ id: number }[]>`
    INSERT INTO investidores (nome, email, celular, documento_cifrado, documento_hash, documento_final, pix_cifrado, conta_cifrada)
    VALUES (${nome}, ${email}, ${celular}, ${campos.documento_cifrado}, ${campos.documento_hash}, ${campos.documento_final}, ${campos.pix_cifrado}, ${campos.conta_cifrada}) RETURNING id`;
  await audit(`usuario:${u.id}`, "investidor_criado", "investidor", n.id);
  redirect(`/painel/investidores/${n.id}?ok=salvo`);
}

export async function ativarInvestidor(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const ativo = fd.get("ativo") === "1";
  const r = await sql`UPDATE investidores SET ativo = ${ativo}, sessao_versao = sessao_versao + 1 WHERE id = ${id} RETURNING id`;
  if (r.length) await audit(`usuario:${u.id}`, ativo ? "investidor_reativado" : "investidor_desativado", "investidor", id);
  redirect(`/painel/investidores/${id}?ok=salvo`);
}

// Link de primeiro acesso ao app: vai por e-mail e aparece uma vez para o admin
// poder repassar pelo WhatsApp.
export async function gerarAcesso(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const [i] = await sql<{ nome: string; email: string }[]>`SELECT nome, email FROM investidores WHERE id = ${id} AND ativo`;
  if (!i) redirect(`/painel/investidores/${id}`);
  const link = await criarLink(id, VALIDADE.convite);
  const enviado = await enviarLink(i.email, i.nome, link, "convite");
  await audit(`usuario:${u.id}`, "acesso_gerado", "investidor", id);
  await guardarSegredo("acesso", id, link);
  redirect(`/painel/investidores/${id}?acesso=${enviado ? "enviado" : "gerado"}`);
}

// Só sai quem não tem cota nem rateio; com histórico, o caminho é desativar.
export async function excluirInvestidor(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const [mov] = await sql`
    SELECT 1 WHERE EXISTS (SELECT 1 FROM cotas WHERE investidor_id = ${id})
      OR EXISTS (SELECT 1 FROM rateios WHERE investidor_id = ${id}) OR EXISTS (SELECT 1 FROM interesses WHERE investidor_id = ${id})`;
  if (mov) redirect(`/painel/investidores/${id}/editar?erro=movimento`);
  const r = await sql`DELETE FROM investidores WHERE id = ${id} RETURNING id`;
  if (r.length) await audit(`usuario:${u.id}`, "investidor_excluido", "investidor", id);
  redirect("/painel/investidores?ok=excluido");
}
