// Cliente da Solarman OpenAPI (contas Solarman Business: inversores Deye e
// Sofar com coletor Solarman). A Solarman libera um App ID e um App Secret por
// pedido ao suporte. O token sai de POST /account/v1.0/token?appId= com o App
// Secret, o e-mail e a senha (SHA-256 em hexadecimal) e vale alguns dias; conta
// Business precisa do ID da empresa (orgId) no token para enxergar as usinas.
import "server-only";
import { createHash } from "crypto";
import { ErroIntegracao, fimDoMes, paraWh, urlDe, type Credenciais } from "./credenciais";

type Resp = { success?: boolean; code?: string | number; msg?: string } & Record<string, unknown>;

async function post(c: Credenciais, caminho: string, corpo: unknown, token?: string): Promise<Resp> {
  let r: Response;
  try {
    r = await fetch(urlDe("solarman", c) + caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `bearer ${token}` } : {}) },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new ErroIntegracao("A Solarman não respondeu. Tentamos de novo mais tarde.");
  }
  const j = (await r.json().catch(() => null)) as Resp | null;
  if (!r.ok || !j) throw new ErroIntegracao(`A Solarman respondeu com erro ${r.status}.`);
  if (j.success === false) throw new ErroIntegracao(`A Solarman recusou o pedido${j.msg ? `: ${String(j.msg).slice(0, 120)}` : ""}.`);
  return j;
}

// Token em memória por conta, renovado 1 hora antes de vencer.
const tokens = new Map<string, { token: string; vence: number }>();

export const hashSenha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

async function pedirToken(c: Credenciais, orgId?: string) {
  const corpo: Record<string, unknown> = { appSecret: c.appSecret.trim(), email: c.email.trim(), password: hashSenha(c.senha) };
  if (orgId) corpo.orgId = Number(orgId);
  const j = await post(c, `/account/v1.0/token?appId=${encodeURIComponent(c.appId.trim())}&language=en`, corpo);
  const token = String(j.access_token ?? "");
  if (!token) throw new ErroIntegracao("A Solarman não devolveu o acesso. Confira o App ID, o App Secret, o e-mail e a senha.");
  return { token, segundos: Number(j.expires_in) || 3600 };
}

async function token(c: Credenciais): Promise<string> {
  const chave = `${c.url}|${c.appId}|${c.email}|${c.orgId}|${hashSenha(c.senha + c.appSecret)}`;
  const t = tokens.get(chave);
  if (t && t.vence > Date.now()) return t.token;
  let org = c.orgId?.trim();
  let novo = await pedirToken(c, org);
  if (!org) {
    // Conta Business: descobre a empresa da conta e pede o token dela.
    const info = await post(c, "/account/v1.0/info?language=en", {}, novo.token).catch(() => null);
    const orgs = ((info?.orgInfoList as { companyId?: unknown }[] | undefined) ?? []).map((o) => String(o.companyId ?? "")).filter(Boolean);
    if (orgs.length === 1) {
      org = orgs[0];
      novo = await pedirToken(c, org);
    } else if (orgs.length > 1) {
      throw new ErroIntegracao(`A conta Solarman tem ${orgs.length} empresas (${orgs.join(", ")}). Informe o ID da empresa.`);
    }
  }
  tokens.set(chave, { token: novo.token, vence: Date.now() + Math.max(60, novo.segundos - 3600) * 1000 });
  return novo.token;
}

export async function usinasSolarman(c: Credenciais): Promise<{ id: string; nome: string }[]> {
  const t = await token(c);
  const lista: { id: string; nome: string }[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const j = await post(c, "/station/v1.0/list?language=en", { page: pagina, size: 100 }, t);
    const recs = ((j.stationList as { id?: unknown; name?: unknown }[] | undefined) ?? []);
    for (const r of recs) if (r.id) lista.push({ id: String(r.id).slice(0, 80), nome: String(r.name ?? r.id).slice(0, 80) });
    if (recs.length < 100 || lista.length >= Number(j.total ?? 0)) break;
  }
  return lista;
}

// Geração de cada dia de um mês ("AAAA-MM"): histórico da usina com timeType 2 (por dia), em kWh.
export async function geracaoDoMesSolarman(c: Credenciais, id: string, mes: string): Promise<{ dia: string; wh: number }[]> {
  const t = await token(c);
  const j = await post(c, "/station/v1.0/history?language=en", { stationId: Number(id), startTime: `${mes}-01`, endTime: fimDoMes(mes), timeType: 2 }, t);
  // A rota do histórico da usina não tem documentação pública: aceita o dia em
  // year/month/day, em dateTime (segundos) ou em data "AAAA-MM-DD".
  const recs = ((j.stationDataItems ?? j.dataList) as { year?: unknown; month?: unknown; day?: unknown; dateTime?: unknown; date?: unknown; generationValue?: unknown }[] | undefined) ?? [];
  const saida: { dia: string; wh: number }[] = [];
  for (const r of recs) {
    const dia = r.year && r.month && r.day
      ? `${r.year}-${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`
      : Number(r.dateTime) > 0
        ? new Date(Number(r.dateTime) * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
        : String(r.date ?? "").slice(0, 10);
    const wh = paraWh(r.generationValue, "kWh");
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && dia.startsWith(mes) && wh !== null) saida.push({ dia, wh });
  }
  return saida;
}
