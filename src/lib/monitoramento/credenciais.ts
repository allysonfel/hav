// Credenciais das plataformas de monitoramento, cadastradas pela HAV no painel
// (Integrações). Ficam no banco em JSON criptografado com a DADOS_CHAVE e só
// são abertas no servidor. A Solis ainda aceita a chave pelas variáveis
// SOLIS_KEY_ID/SOLIS_KEY_SECRET (como era antes do painel).
import "server-only";
import { sql } from "../db";
import { cifrar, decifrar } from "../cifra";

export class ErroIntegracao extends Error {}

export type Tipo = "solis" | "solarman" | "solplanet";
export type Campo = { k: string; rotulo: string; secreto?: boolean; opcional?: boolean; padrao?: string; dica?: string };
export type Plataforma = {
  nome: string;
  marcas: string;
  campos: Campo[];
  // Como a HAV consegue a chave (aparece no card da plataforma).
  comoPegar: string[];
  // Nome do identificador da usina na plataforma.
  idRotulo: string;
};

export const PLATAFORMAS: Record<Tipo, Plataforma> = {
  solis: {
    nome: "Solis (SolisCloud)",
    marcas: "Inversores Solis",
    campos: [
      { k: "keyId", rotulo: "KeyId" },
      { k: "keySecret", rotulo: "KeySecret", secreto: true },
      { k: "url", rotulo: "Endereço da API", opcional: true, padrao: "https://www.soliscloud.com:13333" },
    ],
    comoPegar: [
      "No site soliscloud.com, entre com a conta da HAV e abra Conta, Gerenciamento de API.",
      "Se a opção não aparecer, peça a liberação da API ao suporte da Solis.",
      "Ative e copie o KeyId e o KeySecret para cá.",
    ],
    idRotulo: "ID da usina no SolisCloud",
  },
  solarman: {
    nome: "Solarman Business",
    marcas: "Inversores Deye e Sofar (coletor Solarman)",
    campos: [
      { k: "appId", rotulo: "App ID" },
      { k: "appSecret", rotulo: "App Secret", secreto: true },
      { k: "email", rotulo: "E-mail da conta Solarman" },
      { k: "senha", rotulo: "Senha da conta Solarman", secreto: true },
      { k: "orgId", rotulo: "ID da empresa", opcional: true, dica: "Só se a conta tiver mais de uma empresa. Em branco, o sistema usa a única empresa da conta." },
      { k: "url", rotulo: "Endereço da API", opcional: true, padrao: "https://globalapi.solarmanpv.com" },
    ],
    comoPegar: [
      "Peça a API ao suporte da Solarman (pelo e-mail da conta), informando a conta Business da HAV.",
      "A Solarman responde com o App ID e o App Secret.",
      "Cole os dois aqui, junto com o e-mail e a senha da conta.",
    ],
    idRotulo: "ID da usina na Solarman",
  },
  solplanet: {
    nome: "Solplanet (AISWEI)",
    marcas: "Inversores Solplanet / AISWEI",
    campos: [
      { k: "appKey", rotulo: "App Key" },
      { k: "appSecret", rotulo: "App Secret", secreto: true },
      { k: "token", rotulo: "Token da conta Pro", secreto: true },
      { k: "url", rotulo: "Endereço da API", opcional: true, padrao: "https://eu-api-genergal.aisweicloud.com", dica: "A conta da HAV fica na Estação Internacional: confirme o endereço com o suporte ao pedir a chave." },
    ],
    comoPegar: [
      "No portal internation-pro-cloud.solplanet.net, entre com a conta da HAV e procure em Central do usuário o código de autorização da API.",
      "Se não aparecer, peça a liberação ao suporte da Solplanet (App Key, App Secret e token da conta Pro).",
      "Cada usina tem a própria chave (API key), que é o identificador dela aqui.",
    ],
    idRotulo: "API key da usina na Solplanet",
  },
};

export const TIPOS_LISTA = Object.keys(PLATAFORMAS) as Tipo[];
export const eTipo = (t: unknown): t is Tipo => typeof t === "string" && t in PLATAFORMAS;

export type Credenciais = Record<string, string>;

function doAmbiente(tipo: Tipo): Credenciais | null {
  if (tipo !== "solis") return null;
  const keyId = process.env.SOLIS_KEY_ID?.trim(), keySecret = process.env.SOLIS_KEY_SECRET?.trim();
  return keyId && keySecret ? { keyId, keySecret, url: process.env.SOLIS_API_URL?.trim() ?? "" } : null;
}

// Credenciais salvas no painel (ou, na Solis, as do ambiente).
export async function credenciais(tipo: Tipo): Promise<Credenciais | null> {
  const [r] = await sql<{ c: string }[]>`SELECT credenciais_cifradas AS c FROM integracoes WHERE tipo = ${tipo}`;
  if (r) {
    try {
      const c = JSON.parse(decifrar(r.c) || "null") as Credenciais | null;
      if (c && completas(tipo, c)) return c;
    } catch {}
  }
  return doAmbiente(tipo);
}

export const completas = (tipo: Tipo, c: Credenciais) => PLATAFORMAS[tipo].campos.every((f) => f.opcional || !!c[f.k]?.trim());

export const configurada = async (tipo: string) => eTipo(tipo) && !!(await credenciais(tipo));

export const urlDe = (tipo: Tipo, c: Credenciais) =>
  (c.url?.trim() || PLATAFORMAS[tipo].campos.find((f) => f.k === "url")?.padrao || "").replace(/\/+$/, "");

export async function salvarCredenciais(tipo: Tipo, c: Credenciais) {
  const cifrado = cifrar(JSON.stringify(c));
  await sql`
    INSERT INTO integracoes (tipo, credenciais_cifradas) VALUES (${tipo}, ${cifrado})
    ON CONFLICT (tipo) DO UPDATE SET credenciais_cifradas = excluded.credenciais_cifradas, testado_em = NULL, teste_ok = NULL, teste_msg = '', atualizado_em = now()`;
}

// Para o formulário: o que está salvo, sem nunca devolver os campos secretos.
export async function salvasParaTela(tipo: Tipo): Promise<{ salvo: boolean; doAmbiente: boolean; valores: Credenciais; secretosGuardados: string[] }> {
  const [r] = await sql<{ c: string }[]>`SELECT credenciais_cifradas AS c FROM integracoes WHERE tipo = ${tipo}`;
  let c: Credenciais = {};
  if (r) try { c = (JSON.parse(decifrar(r.c) || "{}") as Credenciais) ?? {}; } catch {}
  const valores: Credenciais = {}, secretosGuardados: string[] = [];
  for (const f of PLATAFORMAS[tipo].campos) {
    if (f.secreto) { if (c[f.k]) secretosGuardados.push(f.k); } else valores[f.k] = c[f.k] ?? "";
  }
  return { salvo: !!r, doAmbiente: !r && !!doAmbiente(tipo), valores, secretosGuardados };
}

// Lê o que já está salvo (com os secretos) para o formulário completar o que ficou em branco.
export async function credenciaisSalvas(tipo: Tipo): Promise<Credenciais> {
  const [r] = await sql<{ c: string }[]>`SELECT credenciais_cifradas AS c FROM integracoes WHERE tipo = ${tipo}`;
  if (!r) return {};
  try { return (JSON.parse(decifrar(r.c) || "{}") as Credenciais) ?? {}; } catch { return {}; }
}

export async function removerCredenciais(tipo: Tipo) {
  await sql`DELETE FROM integracoes WHERE tipo = ${tipo}`;
}

export async function anotarTeste(tipo: Tipo, ok: boolean, msg: string) {
  await sql`UPDATE integracoes SET testado_em = now(), teste_ok = ${ok}, teste_msg = ${msg.slice(0, 200)} WHERE tipo = ${tipo}`;
}

export async function situacoes(): Promise<Record<string, { testado_em: Date | null; teste_ok: boolean | null; teste_msg: string; atualizado_em: Date }>> {
  const rs = await sql<{ tipo: string; testado_em: Date | null; teste_ok: boolean | null; teste_msg: string; atualizado_em: Date }[]>`
    SELECT tipo, testado_em, teste_ok, teste_msg, atualizado_em FROM integracoes`;
  return Object.fromEntries(rs.map((r) => [r.tipo, r]));
}

// Energia em Wh a partir do número e da unidade.
export function paraWh(valor: unknown, unidade: unknown): number | null {
  const n = Number(valor);
  if (valor === null || valor === "" || !Number.isFinite(n) || n < 0) return null;
  const u = String(unidade ?? "kWh").trim().toLowerCase();
  const f = u === "wh" ? 1 : u === "mwh" ? 1_000_000 : u === "gwh" ? 1_000_000_000 : 1000;
  return Math.round(n * f);
}

// Último dia de um mês "AAAA-MM".
export const fimDoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
