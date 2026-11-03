// Projeção simples dos próximos meses, a partir do histórico fechado de UMA usina
// (ou de um investidor numa usina). Não é previsão do tempo nem promessa:
// - com 15 meses ou mais: o mesmo mês do ano anterior, corrigido pela tendência
//   (soma dos 3 últimos meses sobre os mesmos 3 meses um ano antes, limitada a ±20%);
// - com 3 a 14 meses: média dos 3 últimos meses;
// - com menos de 3 meses: não projeta.
// Sem import de módulo do Next: roda no teste com node --experimental-strip-types.

export type Ponto = { comp: string; valor: number };
export type Projetado = Ponto & { metodo: "sazonal" | "media" };

export function somarMeses(c: string, n: number): string {
  const total = Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function projetar(historico: Ponto[], meses = 3): Projetado[] {
  if (historico.length < 3) return [];
  const mapa = new Map(historico.map((p) => [p.comp, p.valor]));
  const ultimo = historico.reduce((a, p) => (p.comp > a ? p.comp : a), historico[0].comp);
  const ultimos3 = [0, -1, -2].map((k) => mapa.get(somarMeses(ultimo, k)));
  // Os 3 últimos meses precisam ser seguidos; com buraco, não há base confiável.
  if (ultimos3.some((v) => v === undefined)) return [];
  const soma3 = (ultimos3 as number[]).reduce((a, b) => a + b, 0);
  const media = Math.round(soma3 / 3);
  const anoAntes = [-12, -13, -14].map((k) => mapa.get(somarMeses(ultimo, k)));
  const somaAntes = anoAntes.every((v) => v !== undefined) ? (anoAntes as number[]).reduce((a, b) => a + b, 0) : 0;
  const fator = somaAntes > 0 ? Math.min(1.2, Math.max(0.8, soma3 / somaAntes)) : null;

  const saida: Projetado[] = [];
  for (let k = 1; k <= meses; k++) {
    const comp = somarMeses(ultimo, k);
    const base = mapa.get(somarMeses(comp, -12));
    if (fator !== null && base !== undefined) saida.push({ comp, valor: Math.round(base * fator), metodo: "sazonal" });
    else saida.push({ comp, valor: media, metodo: "media" });
  }
  return saida;
}

// Soma projeções de várias usinas mês a mês (cada usina projetada pela própria série).
export function somarProjecoes(listas: Projetado[][]): Projetado[] {
  const mapa = new Map<string, Projetado>();
  for (const l of listas) {
    for (const p of l) {
      const atual = mapa.get(p.comp);
      if (!atual) mapa.set(p.comp, { ...p });
      else mapa.set(p.comp, { comp: p.comp, valor: atual.valor + p.valor, metodo: atual.metodo === "sazonal" && p.metodo === "sazonal" ? "sazonal" : "media" });
    }
  }
  return [...mapa.values()].sort((a, b) => (a.comp < b.comp ? -1 : 1));
}
