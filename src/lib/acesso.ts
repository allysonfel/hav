// Links de acesso do investidor (primeiro acesso e nova senha). O token é
// aleatório, de uso único, e só o hash fica no banco. Pedir um link novo
// cancela o anterior.
import "server-only";
import { createHash, randomBytes } from "crypto";
import { sql } from "./db";
import { enviarEmail } from "./email";
import { getSettings } from "./settings";

export const VALIDADE = { convite: "7 days", senha: "30 minutes" } as const;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

const base = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

export async function criarLink(investidorId: number, validade: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql`UPDATE acesso_tokens SET usado_em = now() WHERE investidor_id = ${investidorId} AND usado_em IS NULL`;
  await sql`
    INSERT INTO acesso_tokens (investidor_id, token_hash, expira_em)
    VALUES (${investidorId}, ${hashToken(token)}, now() + ${validade}::interval)`;
  return `${base()}/acesso?t=${token}`;
}

export async function tokenValido(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [r] = await sql<{ id: number; investidor_id: number; aceite: Date | null }[]>`
    SELECT t.id, t.investidor_id, i.aceite_em AS aceite
    FROM acesso_tokens t JOIN investidores i ON i.id = t.investidor_id
    WHERE t.token_hash = ${hashToken(token)} AND t.usado_em IS NULL AND t.expira_em > now() AND i.ativo`;
  return r ?? null;
}

export async function enviarLink(email: string, nome: string, link: string, tipo: "convite" | "senha"): Promise<boolean> {
  const s = await getSettings();
  const primeiro = nome.split(" ")[0];
  return tipo === "convite"
    ? enviarEmail(email, `${s.empresa}: seu acesso ao app do investidor`,
      `Olá, ${primeiro}.\n\nSeu acesso ao app do investidor da ${s.empresa} está pronto. Para criar sua senha, abra o link abaixo (vale por 7 dias):\n${link}\n\nNo app você acompanha a geração das usinas, sua receita proporcional e seus relatórios.`)
    : enviarEmail(email, `${s.empresa}: criar ou redefinir senha`,
      `Olá, ${primeiro}.\n\nPara criar sua senha, abra o link abaixo (vale por 30 minutos):\n${link}\n\nSe não foi você, ignore este e-mail.`);
}
