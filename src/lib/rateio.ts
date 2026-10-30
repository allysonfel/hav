// Divide a geração e a receita do mês entre os cotistas. Cada um recebe a
// parte inteira da própria cota e o que sobra vai, de 1 em 1, para as maiores
// frações: a soma dos rateios fecha exatamente com o total. Usa BigInt porque
// total x ppm passa do limite seguro de number.
export const PPM_TOTAL = 1_000_000;

export function dividir(total: number, cotasPpm: number[]): number[] {
  const t = BigInt(total);
  const milhao = BigInt(PPM_TOTAL);
  const partes = cotasPpm.map((c) => (t * BigInt(c)) / milhao);
  const fracoes = cotasPpm.map((c, i) => ({ i, f: (t * BigInt(c)) % milhao }));
  let sobra = t - partes.reduce((a, b) => a + b, 0n);
  fracoes.sort((a, b) => (a.f === b.f ? a.i - b.i : a.f > b.f ? -1 : 1));
  for (const { i } of fracoes) {
    if (sobra <= 0n) break;
    partes[i] += 1n;
    sobra -= 1n;
  }
  return partes.map(Number);
}

export const somaPpm = (cotas: { cota_ppm: number }[]) => cotas.reduce((a, c) => a + c.cota_ppm, 0);
