// Conta bancária do investidor para o repasse (banco, agência e conta),
// guardada criptografada como a chave Pix (lib/cifra.ts).
import "server-only";
import { cifrar, decifrar } from "./cifra";

export type Conta = { banco: string; agencia: string; conta: string };

const limpo = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

// Lê os 3 campos do formulário. Tudo vazio = sem conta (null); faltando parte = "incompleta".
export function contaDoForm(fd: FormData): Conta | null | "incompleta" {
  const c = { banco: limpo(fd.get("banco"), 60), agencia: limpo(fd.get("agencia"), 12), conta: limpo(fd.get("conta"), 24) };
  if (!c.banco && !c.agencia && !c.conta) return null;
  if (c.banco.length < 2 || !/^[\d-]{1,12}$/.test(c.agencia) || !/^[\dXx-]{2,24}$/.test(c.conta)) return "incompleta";
  return c;
}

export const cifrarConta = (c: Conta | null) => (c ? cifrar(JSON.stringify(c)) : null);

export function abrirConta(guardado: string | null): Conta | null {
  const t = decifrar(guardado);
  if (!t) return null;
  try {
    const c = JSON.parse(t) as Conta;
    return c && typeof c.banco === "string" ? c : null;
  } catch {
    return null;
  }
}

export const contaTexto = (c: Conta | null) => (c ? `${c.banco} · Ag. ${c.agencia} · Conta ${c.conta}` : "");
