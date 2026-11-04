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
      <div className="login-marca">
        <div className="login-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icone-64.png" alt="" />
          <div><b>HAV Energia</b><small>Painel interno</small></div>
        </div>
        <div className="login-chamada">
          <h2>Usinas, investidores e captação num painel só.</h2>
          <p>Lance a geração do mês, feche o rateio por cota e acompanhe os repasses de cada investidor.</p>
        </div>
        <div className="login-pontos">
          <div><b>Rateio</b><span>por cota, fechado no mês</span></div>
          <div><b>Investidores</b><span>app com a receita de cada um</span></div>
          <div><b>Captação</b><span>interessados de cada usina</span></div>
        </div>
      </div>
      <div className="login-lado">
        <form className="login-card" action={login}>
          <h1>Entrar no painel</h1>
          <p className="sub">Use o e-mail cadastrado pela administração da HAV.</p>
          {erro && <div className="aviso erro">{erro === "bloqueado" ? "Muitas tentativas. Aguarde 15 minutos e tente de novo." : "E-mail ou senha incorretos."}</div>}
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
        </form>
      </div>
    </div>
  );
}
