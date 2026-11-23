// Cliente da API oficial da SolisCloud (Platform API 2.0). Cada chamada é um
// POST com JSON assinado: Content-MD5 (MD5 do corpo em base64), Date em GMT e
// Authorization "API <KeyId>:<assinatura>", onde a assinatura é o HMAC-SHA1
// (base64) de "POST\n<md5>\napplication/json\n<data>\n<caminho>".
// A chave (KeyId e KeySecret) é ativada pelo dono da conta em SolisCloud >
// Conta > Gerenciamento de API e é cadastrada no painel (Integrações).
import "server-only";
import { createHash, createHmac } from "crypto";
import { ErroIntegracao as ErroSolis, paraWh, urlDe, type Credenciais } from "./credenciais";

export function assinar(caminho: string, corpo: string, agora: Date, keyId: string, secret: string) {
  const md5 = createHash("md5").update(corpo, "utf8").digest("base64");
  const data = agora.toUTCString(); // "Thu, 05 Nov 2026 20:10:00 GMT"
  const texto = `POST\n${md5}\napplication/json\n${data}\n${caminho}`;
  const sign = createHmac("sha1", secret).update(texto, "utf8").digest("base64");
  return { "Content-MD5": md5, "Content-Type": "application/json", Date: data, Authorization: `API ${keyId}:${sign}` };
}

async function chamar(c: Credenciais, recurso: string, params: Record<string, unknown>): Promise<unknown> {
  const keyId = c.keyId?.trim(), secret = c.keySecret?.trim();
  if (!keyId || !secret) throw new ErroSolis("Integração com a Solis não configurada.");
  const caminho = `/v1/api/${recurso}`;
  const corpo = JSON.stringify(params);
  let resp: Response;
  try {
    resp = await fetch(urlDe("solis", c) + caminho, { method: "POST", headers: assinar(caminho, corpo, new Date(), keyId, secret), body: corpo, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    throw new ErroSolis("A Solis não respondeu. Tentamos de novo mais tarde.");
  }
  // 408: relógio do servidor fora de 15 min do da Solis; 403: chave inválida.
  if (resp.status === 403) throw new ErroSolis("A Solis recusou a chave de acesso (confira KeyId e KeySecret).");
  if (!resp.ok) throw new ErroSolis(`A Solis respondeu com erro ${resp.status}.`);
  const j = (await resp.json().catch(() => null)) as { code?: string | number; msg?: string; data?: unknown } | null;
  if (!j || String(j.code) !== "0") throw new ErroSolis(`A Solis recusou o pedido${j?.msg ? `: ${String(j.msg).slice(0, 120)}` : ""}.`);
  return j.data;
}

// Usinas da conta (para escolher qual é qual no cadastro).
export async function usinasSolis(c: Credenciais): Promise<{ id: string; nome: string }[]> {
  const lista: { id: string; nome: string }[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const d = (await chamar(c, "userStationList", { pageNo: pagina, pageSize: 100 })) as { page?: { records?: unknown[]; pages?: number } } | null;
    const recs = (d?.page?.records ?? []) as { id?: unknown; stationName?: unknown }[];
    for (const r of recs) if (r.id) lista.push({ id: String(r.id).slice(0, 40), nome: String(r.stationName ?? r.id).slice(0, 80) });
    if (recs.length < 100 || pagina >= Number(d?.page?.pages ?? 1)) break;
  }
  return lista;
}

// Geração de cada dia de um mês ("AAAA-MM") de uma usina.
export async function geracaoDoMesSolis(c: Credenciais, id: string, mes: string): Promise<{ dia: string; wh: number }[]> {
  const d = await chamar(c, "stationMonth", { money: "BRL", month: mes, id });
  const recs = (Array.isArray(d) ? d : ((d as { records?: unknown[] } | null)?.records ?? [])) as { dateStr?: unknown; date?: unknown; energy?: unknown; energyStr?: unknown }[];
  const saida: { dia: string; wh: number }[] = [];
  for (const r of recs) {
    let dia = String(r.dateStr ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) && Number(r.date) > 0) dia = new Date(Number(r.date) + 12 * 3_600_000).toISOString().slice(0, 10);
    const wh = paraWh(r.energy, r.energyStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && dia.startsWith(mes) && wh !== null) saida.push({ dia, wh });
  }
  return saida;
}
