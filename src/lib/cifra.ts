// Criptografia de dados financeiros dos investidores (CPF/CNPJ e chave Pix):
// AES-256-GCM com a chave DADOS_CHAVE, que fica só no ambiente. O hash serve
// para achar duplicidade sem precisar abrir o dado.
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

function chave(): Buffer {
  const c = process.env.DADOS_CHAVE?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(c)) throw new Error("DADOS_CHAVE não configurada (64 caracteres hexadecimais).");
  return Buffer.from(c, "hex");
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${corpo.toString("base64url")}`;
}

export function decifrar(guardado: string | null): string {
  if (!guardado) return "";
  const [v, iv, tag, corpo] = guardado.split(".");
  if (v !== "v1" || !iv || !tag || !corpo) return "";
  try {
    const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(corpo, "base64url")), d.final()]).toString("utf8");
  } catch {
    console.error("[cifra] dado não pôde ser aberto");
    return "";
  }
}

export const hashDocumento = (d: string) => createHmac("sha256", chave()).update(`doc:${d}`).digest("base64url");
