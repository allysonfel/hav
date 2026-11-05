// Comprovante do Pix de um repasse: confere o tipo pelos primeiros bytes (não
// pelo nome nem pelo que o navegador diz), guarda no banco e devolve para baixar.
import "server-only";
import { sql } from "./db";

export const COMPROVANTE_MAX = 3 * 1024 * 1024;

export function tipoComprovante(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (b.length > 5 && b.toString("latin1", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export const nomeSeguro = (nome: string) => nome.replace(/^.*[\/]/, "").replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 120);

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

// Resposta para abrir ou baixar, sem o navegador adivinhar o tipo e sem rodar nada.
export function respostaComprovante(c: { mime: string; nome: string; conteudo: Buffer }, base: string): Response {
  const nome = `${base}.${EXT[c.mime] ?? "bin"}`;
  return new Response(new Uint8Array(c.conteudo), {
    headers: {
      "Content-Type": c.mime,
      "Content-Disposition": `${c.mime === "application/pdf" ? "attachment" : "inline"}; filename="${nome}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export async function comprovanteDoRateio(rateioId: number) {
  const [c] = await sql<{ mime: string; nome: string; conteudo: Buffer }[]>`SELECT mime, nome, conteudo FROM comprovantes WHERE rateio_id = ${rateioId}`;
  return c ?? null;
}
