// Sessão do investidor (app). Separada da equipe: cookie próprio, validade de
// 7 dias e a mesma checagem a cada requisição: assinatura, validade, conta
// ativa e versão da sessão. O id usado nas consultas vem sempre daqui, nunca
// do formulário ou da URL.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "./db";
import { createToken, readToken } from "./auth";

export const COOKIE_INVESTIDOR = "hav_investidor";
const DIAS = 7;

export type Investidor = { id: number; nome: string; email: string; celular: string };

export async function iniciarSessaoInvestidor(id: number, versao: number) {
  (await cookies()).set(COOKIE_INVESTIDOR, createToken({ iid: id, v: versao, t: "investidor" }, DIAS * 24), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS * 86_400,
  });
}

export async function encerrarSessaoInvestidor() {
  (await cookies()).delete(COOKIE_INVESTIDOR);
}

export async function getInvestidor(): Promise<Investidor | null> {
  const d = readToken<{ iid: number; v: number; t: string }>((await cookies()).get(COOKIE_INVESTIDOR)?.value);
  if (!d || d.t !== "investidor") return null;
  await ensureSchema();
  const [i] = await sql<Investidor[]>`
    SELECT id, nome, email, celular FROM investidores WHERE id = ${d.iid} AND ativo AND sessao_versao = ${d.v}`;
  return i ?? null;
}

export async function requireInvestidor(): Promise<Investidor> {
  const i = await getInvestidor();
  if (!i) redirect("/entrar");
  return i;
}
