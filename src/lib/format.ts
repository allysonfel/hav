// Formatação e leitura de dinheiro, energia, cota e datas (horário de Recife).
export const TZ = "America/Recife";

export const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Sem centavos, para cartões e listas ("R$ 71.150").
export const brl0 = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Compacto ("R$ 3,8M", "R$ 71,2k").
export function brlCurto(centavos: number): string {
  const v = centavos / 100;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return brl0(centavos);
}

export const num = (n: number, casas = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const kwh = (wh: number) => `${num(wh / 1000)} kWh`;
export const kwhCurto = (wh: number) => (wh >= 1_000_000 ? `${num(wh / 1_000_000, 1)}k` : num(wh / 1000));
export const kwp = (wp: number) => `${num(wp / 1000, 2)} kWp`;
export const pct = (ppm: number) => `${num(ppm / 10_000, 2)}%`;

// Número digitado no jeito brasileiro: "1.100", "142300,5", "1100.5". null se inválido.
export function numeroBr(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  let limpo: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+(,\d+)?$/.test(s)) limpo = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(s)) limpo = s;
  else return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const naFaixa = (v: unknown, fator: number, max: number) => {
  const n = numeroBr(v);
  if (n === null) return null;
  const r = Math.round(n * fator);
  return Number.isSafeInteger(r) && r <= max ? r : null;
};

export const centavosDe = (v: unknown) => naFaixa(v, 100, 10_000_000_000_000); // até R$ 100 bilhões
export const whDe = (v: unknown) => naFaixa(v, 1000, 1_000_000_000_000_000); // até 1 TWh
export const wpDe = (v: unknown) => naFaixa(v, 1000, 100_000_000_000); // até 100 GWp
export const ppmDe = (v: unknown) => naFaixa(v, 10_000, 1_000_000);

// Texto para preencher campo de formulário.
export const campoDecimal = (n: number, casas: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas, useGrouping: false });

export const dataBr = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ });

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Competência é sempre o texto "AAAA-MM".
export const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
export const mesLongo = (c: string) => `${MESES[Number(c.slice(5, 7)) - 1]} de ${c.slice(0, 4)}`;
export const mesAbrev = (c: string) => {
  const m = MESES[Number(c.slice(5, 7)) - 1].slice(0, 3);
  return m[0].toUpperCase() + m.slice(1);
};
export const mesAno = (c: string) => `${mesAbrev(c)}/${c.slice(0, 4)}`;

// Mês atual em Recife ("2026-10").
export function mesAtual(agora = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 7);
}

export function somarMeses(c: string, n: number): string {
  const total = Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// Último mês cujo rateio já deveria ter sido lançado. dia = 0: fecha no último
// dia útil do próprio mês. dia 1 a 28: fecha nesse dia do mês seguinte.
export function competenciaEsperada(dia: number, agora = new Date()): string {
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: TZ });
  const atual = hoje.slice(0, 7);
  const d = Number(hoje.slice(8, 10));
  if (dia > 0) return somarMeses(atual, d >= dia ? -1 : -2);
  const ano = Number(atual.slice(0, 4));
  const mes = Number(atual.slice(5, 7));
  let ultimo = new Date(Date.UTC(ano, mes, 0));
  while ([0, 6].includes(ultimo.getUTCDay())) ultimo = new Date(ultimo.getTime() - 86_400_000);
  return d >= ultimo.getUTCDate() ? atual : somarMeses(atual, -1);
}

export function haQuanto(d: Date | string | null): string {
  if (!d) return "nunca";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "agora";
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return dataBr(d);
}

export const iniciais = (n: string) =>
  n.split(" ").filter((x) => /^[A-Za-zÀ-ú]/.test(x) && x.length > 2).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";

// Célula de CSV (separador ;). Começando com = + - @ ganha ' na frente: evita
// fórmula maliciosa quando a planilha abre no Excel.
export const celulaCsv = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s) && s !== "-") s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export function respostaCsv(nome: string, cabecalho: string[], linhas: unknown[][]): Response {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
  return new Response("﻿" + corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const csvDinheiro = (c: number) => (c / 100).toFixed(2).replace(".", ",");
export const csvKwh = (wh: number) => (wh / 1000).toFixed(3).replace(".", ",");
export const csvPct = (ppm: number) => (ppm / 10_000).toFixed(4).replace(".", ",");

// Valores do comparativo entre usinas (servidor e navegador).
export type Formato = "kwh" | "brl" | "prod" | "brlkwp";
export function fmtMetrica(f: Formato, v: number, curto = false): string {
  if (f === "kwh") return `${num(v / 1000)} kWh`;
  if (f === "brl") return curto ? brlCurto(v) : brl0(v);
  if (f === "prod") return `${num(v, 1)} kWh/kWp`;
  return `R$ ${num(v / 100, 2)}/kWp`;
}

// Valor pago por kWh, guardado em décimos de milésimo de real (R$ 0,56 = 5600).
export const tarifaDe = (v: unknown) => {
  const t = naFaixa(v, 10_000, 1_000_000); // até R$ 100/kWh
  return t && t > 0 ? t : null;
};
export const tarifaTxt = (t: number) =>
  `R$ ${(t / 10_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/kWh`;
// Receita = geração x tarifa, em centavos, arredondada para baixo (como a HAV
// faz à mão: 13.458,32 kWh x 0,56 = R$ 7.536,65).
export const receitaPorTarifa = (wh: number, tarifa: number) => Number((BigInt(wh) * BigInt(tarifa)) / 100_000n);

// Período de apuração de uma competência. inicio = 1: o mês do calendário.
// inicio 2 a 28: do dia inicio do mês anterior ao dia inicio - 1 do mês da
// competência (inicio 21, setembro = 21/08 a 20/09).
export function periodo(comp: string, inicio: number): { ini: string; fim: string; dias: number } {
  const ano = Number(comp.slice(0, 4)), mes = Number(comp.slice(5, 7));
  const ini = inicio > 1 ? new Date(Date.UTC(ano, mes - 2, inicio)) : new Date(Date.UTC(ano, mes - 1, 1));
  const fim = inicio > 1 ? new Date(Date.UTC(ano, mes - 1, inicio - 1)) : new Date(Date.UTC(ano, mes, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { ini: iso(ini), fim: iso(fim), dias: Math.round((fim.getTime() - ini.getTime()) / 86_400_000) + 1 };
}
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const periodoTexto = (comp: string, inicio: number) => {
  const p = periodo(comp, inicio);
  return `${dmy(p.ini)} a ${dmy(p.fim)}`;
};
export const periodoCurto = (comp: string, inicio: number) => {
  const p = periodo(comp, inicio);
  return `${dmy(p.ini).slice(0, 5)} a ${dmy(p.fim).slice(0, 5)}`;
};
