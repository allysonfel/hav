"use server";

// Login e links de acesso do investidor. O acesso é só para quem a equipe
// cadastrou. A resposta de pedirLink é sempre a mesma: não revela se o e-mail
// existe. Criar senha é o mesmo caminho de redefinir senha.
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { hashPassword, verifyPassword, SENHA_MINIMA } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { clearFailures, isBlocked, LIMITE_EMAIL, LIMITE_IP, registerFailure } from "@/lib/limits";
import { iniciarSessaoInvestidor } from "@/lib/investidor";
import { criarLink, enviarLink, tokenValido, VALIDADE } from "@/lib/acesso";

export async function entrar(fd: FormData) {
  await ensureSchema();
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const senha = String(fd.get("senha") ?? "").slice(0, 200);
  const chaveEmail = `app:${email}`;
  const chaveIp = `ip:${await clientIp()}`;
  if (await isBlocked([[chaveEmail, LIMITE_EMAIL], [chaveIp, LIMITE_IP]])) redirect("/entrar?erro=bloqueado");
  const [i] = await sql<{ id: number; senha_hash: string | null; sessao_versao: number }[]>`
    SELECT id, senha_hash, sessao_versao FROM investidores WHERE email = ${email} AND ativo`;
  if (!i || !verifyPassword(senha, i.senha_hash)) {
    await registerFailure(chaveEmail, chaveIp);
    await audit(`email:${email.slice(0, 3)}***`, "login_app_falhou");
    redirect("/entrar?erro=1");
  }
  await clearFailures(chaveEmail);
  await sql`UPDATE investidores SET ultimo_acesso = now() WHERE id = ${i.id}`;
  await iniciarSessaoInvestidor(i.id, i.sessao_versao);
  await audit(`investidor:${i.id}`, "login", "investidor", i.id);
  redirect("/");
}

export async function pedirLink(fd: FormData) {
  await ensureSchema();
  const destino = fd.get("origem") === "criar-conta" ? "/criar-conta" : "/recuperar";
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const chaveIp = `link:${await clientIp()}`;
  if (await isBlocked([[chaveIp, 5], [`link:${email}`, 3]])) redirect(`${destino}?enviado=1`);
  await registerFailure(chaveIp, `link:${email}`);
  const [i] = await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM investidores WHERE email = ${email} AND ativo`;
  if (i) await enviarLink(email, i.nome, await criarLink(i.id, VALIDADE.senha), "senha");
  redirect(`${destino}?enviado=1`);
}

export async function definirSenha(fd: FormData) {
  await ensureSchema();
  const token = String(fd.get("t") ?? "");
  const senha = String(fd.get("senha") ?? "");
  const r = await tokenValido(token);
  if (!r) redirect("/acesso?erro=link");
  const volta = `/acesso?t=${encodeURIComponent(token)}`;
  if (senha.length < SENHA_MINIMA || senha.length > 200) redirect(`${volta}&erro=senha`);
  if (!r.aceite && fd.get("aceite") !== "1") redirect(`${volta}&erro=aceite`);
  // Senha nova derruba as sessões abertas (versão nova) e o link não vale de novo.
  await sql.begin(async (tx) => {
    await tx`UPDATE acesso_tokens SET usado_em = now() WHERE id = ${r.id}`;
    await tx`
      UPDATE investidores SET senha_hash = ${hashPassword(senha)}, sessao_versao = sessao_versao + 1, aceite_em = coalesce(aceite_em, now())
      WHERE id = ${r.investidor_id}`;
  });
  await audit(`investidor:${r.investidor_id}`, "senha_definida", "investidor", r.investidor_id);
  redirect("/entrar?ok=senha");
}
