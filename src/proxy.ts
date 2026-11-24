// Três funções:
// 0. Freio de volume por IP (janela de 1 min): o geral pega tudo; login e
//    exportações têm limite próprio, mais baixo. Passou, responde 429.
// 1. Content-Security-Policy com nonce novo a cada requisição: só roda script
//    do próprio sistema (o Next aplica o nonce nos scripts dele sozinho).
// 2. Atalho de redirecionamento: sem o cookie certo, painel e app mandam para
//    a própria tela de entrar. NÃO é a checagem de segurança: assinatura,
//    validade, conta ativa e perfil são conferidos em cada página, action e rota.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { dentroDoLimite, ipDe } from "@/lib/limiteRequisicoes";

// O Next pré-carrega os links visíveis (uma tela aberta do zero gera 30 a 40
// requisições) e apaga do proxy o cabeçalho que diferencia o pré-carregamento.
// Por isso o geral é folgado e o das telas de entrada vale só para o ENVIO do
// formulário (POST, onde está a tentativa de senha): abrir ou pré-carregar a
// tela de entrar não gasta esse limite.
const LIMITE_GERAL = 600;
const LIMITES: [regra: RegExp, max: number, metodo?: string][] = [
  [/^\/(painel\/entrar|entrar|criar-conta|recuperar|acesso)$/, 20, "POST"],
  [/\/(exportar|pdf)$/, 10],
  [/^\/api\/agente\//, 20],
];

const PUBLICAS_APP = ["/entrar", "/criar-conta", "/recuperar", "/acesso", "/privacidade", "/manifest.webmanifest"];

function muitas(esperarSeg: number, api: boolean) {
  const headers = { "Retry-After": String(esperarSeg) };
  return api
    ? Response.json({ erro: "Muitas requisições. Aguarde um pouco e tente de novo." }, { status: 429, headers })
    : new NextResponse("Muitas requisições. Aguarde um pouco e tente de novo.", { status: 429, headers });
}

// style-src aceita 'unsafe-inline' porque as telas usam atributos style.
function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = ipDe(request.headers);
  const api = pathname.startsWith("/api/");
  const geral = dentroDoLimite(`g:${ip}`, LIMITE_GERAL);
  if (!geral.ok) return muitas(geral.esperarSeg, api);
  const regra = LIMITES.find(([r, , metodo]) => r.test(pathname) && (!metodo || metodo === request.method));
  if (regra) {
    const r = dentroDoLimite(`${regra[0].source}:${ip}`, regra[1]);
    if (!r.ok) return muitas(r.esperarSeg, api);
  }
  const doPainel = pathname === "/painel" || pathname.startsWith("/painel/");
  if (doPainel && pathname !== "/painel/entrar" && !request.cookies.has("hav_equipe")) {
    return NextResponse.redirect(new URL("/painel/entrar", process.env.APP_URL || request.url));
  }
  if (!doPainel && !api && !PUBLICAS_APP.includes(pathname) && !request.cookies.has("hav_investidor")) {
    return NextResponse.redirect(new URL("/entrar", process.env.APP_URL || request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const politica = csp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", politica);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", politica);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icone|logo-hav|robots.txt).*)"],
};
