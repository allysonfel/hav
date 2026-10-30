// Sessão da equipe do painel. O proxy só redireciona quem não tem cookie; a
// checagem de verdade (assinatura, validade, usuário ativo, versão da sessão,
// perfil) é feita aqui, em toda página, server action e rota.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "./db";
import { createToken, readToken } from "./auth";

export const SESSION_COOKIE = "hav_equipe";
const HORAS = 12;

export type Perfil = "admin" | "operador";
export const PERFIL_NOME: Record<Perfil, string> = { admin: "Administrador", operador: "Operador" };

export type Usuario = { id: number; nome: string; email: string; perfil: Perfil; telefone: string; cargo: string };

export async function startSession(id: number, versao: number, persistente = true) {
  (await cookies()).set(SESSION_COOKIE, createToken({ uid: id, v: versao, t: "equipe" }, HORAS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(persistente ? { maxAge: HORAS * 3600 } : {}),
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getUser(): Promise<Usuario | null> {
  const data = readToken<{ uid: number; v: number; t: string }>((await cookies()).get(SESSION_COOKIE)?.value);
  if (!data || data.t !== "equipe") return null;
  await ensureSchema();
  const [u] = await sql<Usuario[]>`
    SELECT id, nome, email, perfil, telefone, cargo FROM usuarios
    WHERE id = ${data.uid} AND ativo AND sessao_versao = ${data.v}`;
  return u ?? null;
}

// Garante usuário logado (e, se pedido, com um dos perfis). Usar no início
// de toda página e server action do painel.
export async function requireUser(perfis?: Perfil[]): Promise<Usuario> {
  const u = await getUser();
  if (!u) redirect("/painel/entrar");
  if (perfis && !perfis.includes(u.perfil)) redirect("/painel?erro=permissao");
  return u;
}

export const eAdmin = (u: Usuario) => u.perfil === "admin";
