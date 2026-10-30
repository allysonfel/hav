// Senha gerada para mostrar UMA vez (senha provisória
// de usuário). Vai num cookie curto, httpOnly, só do painel: nunca na URL,
// que fica no histórico do navegador e nos logs.
import { cookies } from "next/headers";

const NOME = "hav_segredo";

export async function guardarSegredo(tipo: "usuario" | "acesso", id: number, senha: string) {
  (await cookies()).set(NOME, `${tipo}:${id}:${senha}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/painel",
    maxAge: 120,
  });
}

export async function lerSegredo(tipo: "usuario" | "acesso", id: number): Promise<string> {
  const v = (await cookies()).get(NOME)?.value ?? "";
  const prefixo = `${tipo}:${id}:`;
  return v.startsWith(prefixo) ? v.slice(prefixo.length) : "";
}
