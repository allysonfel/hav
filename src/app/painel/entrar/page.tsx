import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { startSession, getUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { isBlocked, registerFailure, clearFailures, LIMITE_EMAIL, LIMITE_IP } from "@/lib/limits";

async function login(fd: FormData) {
  "use server";
  await ensureSchema();
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const senha = String(fd.get("senha") ?? "").slice(0, 200);
  const chaveEmail = `login:${email}`;
  const chaveIp = `ip:${await clientIp()}`;
  if (await isBlocked([[chaveEmail, LIMITE_EMAIL], [chaveIp, LIMITE_IP]])) redirect("/painel/entrar?erro=bloqueado");

  const [u] = await sql<{ id: number; senha_hash: string; sessao_versao: number }[]>`
    SELECT id, senha_hash, sessao_versao FROM usuarios WHERE email = ${email} AND ativo`;
  if (!u || !verifyPassword(senha, u.senha_hash)) {
    await registerFailure(chaveEmail, chaveIp);
    await audit(`email:${email.slice(0, 3)}***`, "login_falhou");
    redirect("/painel/entrar?erro=1");
  }
  await clearFailures(chaveEmail);
  await sql`UPDATE usuarios SET ultimo_acesso = now() WHERE id = ${u.id}`;
  await startSession(u.id, u.sessao_versao);
  await audit(`usuario:${u.id}`, "login");
  redirect("/painel");
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; esqueci?: string }> }) {
  if (await getUser()) redirect("/painel");
  const { erro, esqueci } = await searchParams;
  return (
    <div className="login">
      <form className="login-card" action={login}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-hav.png" alt="HAV Energia" />
        <h1>Painel HAV Energia</h1>
        <p className="sub">Gestão de usinas, investidores e captação.</p>
        {erro && <div className="aviso erro">{erro === "bloqueado" ? "Muitas tentativas. Aguarde 15 minutos." : "E-mail ou senha incorretos."}</div>}
        {esqueci && <div className="aviso info">Peça ao administrador uma senha provisória. Ele gera em Equipe, no seu nome.</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" name="email" required maxLength={160} autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" name="senha" required maxLength={200} autoComplete="current-password" />
        </div>
        <button className="btn btn-primary btn-block">Entrar</button>
        <a className="login-link" href="/painel/entrar?esqueci=1">Esqueci minha senha</a>
        <div className="login-foot"><span>HAV Energia</span><span>Ambiente interno</span></div>
      </form>
    </div>
  );
}
