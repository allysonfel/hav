// Cliente da API da Solplanet / AISWEI para conta Pro (empresa). Cada chamada é
// um GET em /pro/<método> com os parâmetros em ordem alfabética, assinado com
// HMAC-SHA256 (base64) do texto
// "GET\napplication/json\n\napplication/json; charset=UTF-8\n\nX-Ca-Key:<appKey>\n<caminho?parâmetros>"
// usando o App Secret. O token da conta Pro vai nos parâmetros; cada usina tem a
// própria API key (apikey), que é o identificador dela no sistema.
// ATENÇÃO: o formato foi montado a partir de um cliente público (a Solplanet não
// publica a documentação). Conferir com a chave real: o endereço da Estação
// Internacional e o formato da geração por mês (getPlantOutputPro, bymonth).
import "server-only";
import { createHmac } from "crypto";
import { ErroIntegracao, paraWh, urlDe, type Credenciais } from "./credenciais";

const ACCEPT = "application/json";
const TIPO = "application/json; charset=UTF-8";

export function caminhoAssinado(metodo: string, params: Record<string, string>) {
  const q = Object.entries(params).map(([k, v]) => `${k}=${v}`).sort().join("&");
  return `/pro/${metodo}${q ? `?${q}` : ""}`;
}

export function assinarSolplanet(caminho: string, appKey: string, appSecret: string) {
  const texto = `GET\n${ACCEPT}\n\n${TIPO}\n\nX-Ca-Key:${appKey}\n${caminho}`;
  return createHmac("sha256", appSecret).update(texto, "utf8").digest("base64");
}

async function chamar(c: Credenciais, metodo: string, params: Record<string, string>): Promise<unknown> {
  const appKey = c.appKey?.trim(), appSecret = c.appSecret?.trim();
  if (!appKey || !appSecret || !c.token?.trim()) throw new ErroIntegracao("Integração com a Solplanet não configurada.");
  const caminho = caminhoAssinado(metodo, { ...params, token: encodeURIComponent(c.token.trim()) });
  let r: Response;
  try {
    r = await fetch(urlDe("solplanet", c) + caminho, {
      headers: { "User-Agent": "app 1.0", "Content-Type": TIPO, Accept: ACCEPT, "X-Ca-Signature-Headers": "X-Ca-Key", "X-Ca-Key": appKey, "X-Ca-Signature": assinarSolplanet(caminho, appKey, appSecret) },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new ErroIntegracao("A Solplanet não respondeu. Tentamos de novo mais tarde.");
  }
  if (r.status === 401 || r.status === 403) throw new ErroIntegracao("A Solplanet recusou a chave de acesso (confira App Key, App Secret e token).");
  const j = (await r.json().catch(() => null)) as { success?: boolean; errorCode?: unknown; errorMsg?: unknown; data?: unknown } | null;
  if (!r.ok || !j) throw new ErroIntegracao(`A Solplanet respondeu com erro ${r.status}.`);
  if (j.success === false || (j.errorCode !== undefined && String(j.errorCode) !== "0"))
    throw new ErroIntegracao(`A Solplanet recusou o pedido${j.errorMsg ? `: ${String(j.errorMsg).slice(0, 120)}` : ""}.`);
  return j.data;
}

const lista = (d: unknown): Record<string, unknown>[] => {
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  const o = (d ?? {}) as Record<string, unknown>;
  for (const k of ["list", "records", "rows", "result", "data"]) if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  return [];
};

export async function usinasSolplanet(c: Credenciais): Promise<{ id: string; nome: string }[]> {
  const saida: { id: string; nome: string }[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const recs = lista(await chamar(c, "getPlanListPro", { page: String(pagina), size: "100" }));
    for (const r of recs) {
      const id = String(r.apikey ?? r.apiKey ?? r.psno ?? "").trim();
      if (id) saida.push({ id: id.slice(0, 80), nome: String(r.name ?? r.plantName ?? r.plant_name ?? r.stationName ?? id).slice(0, 80) });
    }
    if (recs.length < 100) break;
  }
  return saida;
}

// Geração de cada dia de um mês ("AAAA-MM") de uma usina (pela API key dela).
export async function geracaoDoMesSolplanet(c: Credenciais, apikey: string, mes: string): Promise<{ dia: string; wh: number }[]> {
  const d = await chamar(c, "getPlantOutputPro", { apikey: encodeURIComponent(apikey), period: "bymonth", date: mes });
  return lerMes(d, mes);
}

// Aceita os formatos vistos nas APIs da AISWEI: lista de {data|time|x, valor|value|y}
// ou um par de listas x/y; a unidade vem em "unit"/"y_unit" (padrão kWh).
export function lerMes(d: unknown, mes: string): { dia: string; wh: number }[] {
  const o = (d ?? {}) as Record<string, unknown>;
  const unidade = o.unit ?? o.y_unit ?? o.unitY ?? "kWh";
  const pares: [unknown, unknown][] = Array.isArray(o.x) && Array.isArray(o.y)
    ? (o.x as unknown[]).map((x, i) => [x, (o.y as unknown[])[i]])
    : lista(d).map((r) => [r.date ?? r.time ?? r.x ?? r.day, r.value ?? r.energy ?? r.y ?? r.eday]);
  const saida: { dia: string; wh: number }[] = [];
  for (const [x, v] of pares) {
    const t = String(x ?? "").trim();
    const dia = /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : /^\d{1,2}$/.test(t) ? `${mes}-${t.padStart(2, "0")}` : "";
    const wh = paraWh(v, unidade);
    if (dia.startsWith(mes) && wh !== null) saida.push({ dia, wh });
  }
  return saida;
}
