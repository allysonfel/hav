"use server";

// Ações do investidor. O id vem sempre da sessão; nada do formulário decide de
// quem é o dado.
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { encerrarSessaoInvestidor, getInvestidor, iniciarSessaoInvestidor, requireInvestidor } from "@/lib/investidor";
import { hashPassword, verifyPassword, SENHA_MINIMA } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { cifrar } from "@/lib/cifra";
import { celularValido } from "@/lib/cpf";
import { centavosDe } from "@/lib/format";
import { dentroDoLimite } from "@/lib/limiteRequisicoes";
import { getSettings } from "@/lib/settings";

export async function sair() {
  const i = await getInvestidor();
  if (i) await audit(`investidor:${i.id}`, "logout", "investidor", i.id);
  await encerrarSessaoInvestidor();
  redirect("/entrar");
}

export async function salvarCelular(fd: FormData) {
  const i = await requireInvestidor();
  const celular = celularValido(fd.get("celular"));
  if (!celular) redirect("/perfil/dados?erro=celular");
  await sql`UPDATE investidores SET celular = ${celular} WHERE id = ${i.id}`;
  await audit(`investidor:${i.id}`, "celular_alterado", "investidor", i.id);
  redirect("/perfil/dados?ok=1");
}

// Chave Pix decide para onde vai o dinheiro: pede a senha e fica no registro.
export async function salvarPix(fd: FormData) {
  const i = await requireInvestidor();
  const pix = String(fd.get("pix") ?? "").trim().slice(0, 140);
  const senha = String(fd.get("senha") ?? "").slice(0, 200);
  if (pix.length < 5) redirect("/perfil/pix?erro=pix");
  if (!dentroDoLimite(`pix:${i.id}`, 5, 15 * 60_000).ok) redirect("/perfil/pix?erro=limite");
  const [r] = await sql<{ senha_hash: string | null }[]>`SELECT senha_hash FROM investidores WHERE id = ${i.id}`;
  if (!verifyPassword(senha, r?.senha_hash)) redirect("/perfil/pix?erro=senha");
  await sql`UPDATE investidores SET pix_cifrado = ${cifrar(pix)} WHERE id = ${i.id}`;
  await audit(`investidor:${i.id}`, "pix_alterado", "investidor", i.id);
  redirect("/perfil/pix?ok=1");
}

export async function trocarSenha(fd: FormData) {
  const i = await requireInvestidor();
  const atual = String(fd.get("atual") ?? "").slice(0, 200);
  const nova = String(fd.get("nova") ?? "");
  if (!dentroDoLimite(`senha:${i.id}`, 5, 15 * 60_000).ok) redirect("/perfil/senha?erro=limite");
  const [r] = await sql<{ senha_hash: string | null }[]>`SELECT senha_hash FROM investidores WHERE id = ${i.id}`;
  if (!verifyPassword(atual, r?.senha_hash)) redirect("/perfil/senha?erro=atual");
  if (nova.length < SENHA_MINIMA || nova.length > 200) redirect("/perfil/senha?erro=curta");
  // Encerra as outras sessões (versão nova); esta continua.
  const [v] = await sql<{ v: number }[]>`
    UPDATE investidores SET senha_hash = ${hashPassword(nova)}, sessao_versao = sessao_versao + 1 WHERE id = ${i.id} RETURNING sessao_versao AS v`;
  await iniciarSessaoInvestidor(i.id, v.v);
  await audit(`investidor:${i.id}`, "senha_trocada", "investidor", i.id);
  redirect("/perfil/senha?ok=1");
}

// Interesse em usina em captação ou ampliação de cota em usina própria. Vai para
// o funil da equipe: não reserva cota nem movimenta dinheiro.
export async function quererInvestir(fd: FormData) {
  const i = await requireInvestidor();
  if (!(await getSettings()).oportunidades) redirect("/");
  const usina = Number(fd.get("usina"));
  const valor = centavosDe(fd.get("valor"));
  if (!Number.isInteger(usina) || usina < 1) redirect("/oportunidades");
  if (!valor) redirect("/oportunidades?erro=valor");
  if (!dentroDoLimite(`interesse:${i.id}`, 5).ok) redirect("/oportunidades?erro=limite");
  const [u] = await sql`
    SELECT 1 FROM usinas u WHERE u.id = ${usina}
      AND (u.status = 'captacao' OR EXISTS (SELECT 1 FROM cotas c WHERE c.usina_id = u.id AND c.investidor_id = ${i.id} AND c.ativa))`;
  if (!u) redirect("/oportunidades");
  const [n] = await sql<{ id: number }[]>`
    INSERT INTO interesses (usina_id, investidor_id, nome, telefone, valor_centavos, origem)
    VALUES (${usina}, ${i.id}, ${i.nome}, ${i.celular}, ${valor}, 'app')
    ON CONFLICT (usina_id, investidor_id) WHERE investidor_id IS NOT NULL AND status IN ('aguardando', 'negociacao')
    DO UPDATE SET valor_centavos = ${valor} RETURNING id`;
  await audit(`investidor:${i.id}`, "interesse_enviado", "interesse", n.id);
  redirect("/oportunidades/enviado");
}

// Liga ou desliga o relatório mensal por e-mail do próprio investidor.
export async function salvarEmailRelatorio(fd: FormData) {
  const i = await requireInvestidor();
  const ligado = fd.get("ligado") === "1";
  await sql`UPDATE investidores SET relatorio_email = ${ligado} WHERE id = ${i.id}`;
  await audit(`investidor:${i.id}`, "preferencia_email", "investidor", i.id, ligado ? "ligado" : "desligado");
  redirect("/avisos?ok=email");
}
