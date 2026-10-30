// Freio de volume em memória (uma instância no Railway): conta requisições por chave
// numa janela deslizante. Usado no proxy (por IP).
const contagens = new Map<string, number[]>();
let ultimaLimpeza = 0;

export function dentroDoLimite(chave: string, max: number, janelaMs = 60_000): { ok: boolean; esperarSeg: number } {
  const agora = Date.now();
  // Limpeza oportunista: tira chaves sem uso há mais de 10 min.
  if (agora - ultimaLimpeza > 60_000) {
    ultimaLimpeza = agora;
    for (const [k, l] of contagens) if (!l.length || agora - l[l.length - 1] > 10 * 60_000) contagens.delete(k);
  }
  const l = (contagens.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (l.length >= max) {
    contagens.set(chave, l);
    return { ok: false, esperarSeg: Math.max(1, Math.ceil((l[0] + janelaMs - agora) / 1000)) };
  }
  l.push(agora);
  contagens.set(chave, l);
  return { ok: true, esperarSeg: 0 };
}

// IP do cliente. O acesso chega pelo roteador de *.sistemainterno.app, e o Railway
// reescreve o x-forwarded-for com o IP do roteador: sem isso, todo mundo seria a
// mesma pessoa. O roteador manda o IP real em x-cliente-ip; só vale com a ROTEADOR_CHAVE
// certa (senão qualquer um forjaria o cabeçalho). Fora do roteador, primeiro IP do
// x-forwarded-for. É dica para limite e auditoria, nunca identidade.
export function ipDe(headers: Headers): string {
  const chave = process.env.ROTEADOR_CHAVE;
  const doRoteador = chave && headers.get("x-roteador-chave") === chave ? headers.get("x-cliente-ip")?.trim() : "";
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (doRoteador || fwd || headers.get("x-real-ip") || "desconhecido").slice(0, 64);
}
