"use client";

import { useState } from "react";
import { brl0, brlCurto, kwh, kwhCurto, mesAbrev, num } from "@/lib/format";

// Barras no padrão dos painéis da Logos (HTML, não SVG: o texto fica sempre do mesmo
// tamanho). Meses em tom suave e o mês escolhido em cor cheia, com o valor em cima.
// Começa no último mês fechado; tocar (ou clicar) em outro mês mostra o valor dele.
// Projeção em barra tracejada.
export type Ponto = { comp: string; valor: number; proj?: boolean };

export function GradeBarras({ itens, tipo, cabem, comUnidade, titulo, meta }: {
  itens: Ponto[];
  tipo: "kwh" | "brl";
  cabem: number;
  comUnidade?: boolean;
  titulo: string;
  // Geração esperada por mês: vira uma linha tracejada atravessando as barras.
  meta?: number | null;
}) {
  const rotulo = (v: number) => (tipo === "kwh" ? `${kwhCurto(v)}${comUnidade ? " kWh" : ""}` : brlCurto(v));
  const ultimoReal = itens.map((d) => !d.proj).lastIndexOf(true);
  const [sel, setSel] = useState(ultimoReal);
  const max = Math.max(...itens.map((d) => d.valor), meta ? meta * 1.08 : 0, 1);
  const cada = Math.max(1, Math.ceil(itens.length / cabem));
  const mes = (d: Ponto) => `${mesAbrev(d.comp)}/${d.comp.slice(0, 4)}`;
  // Valor do mês escolhido numa linha fixa acima das barras (não fica por cima de nenhuma barra).
  const atual = itens[sel] ?? itens[ultimoReal];
  const leitura = (v: number) => (tipo === "kwh" ? kwh(v) : brl0(v));
  return (
    <>
    <div className="barras-leitura" aria-live="polite">
      {atual && <>
        <span>{mes(atual)}{atual.proj ? " · projeção" : meta && tipo === "kwh" ? ` · ${num((atual.valor / meta) * 100)}% do esperado` : ""}</span>
        <b className="num">{leitura(atual.valor)}</b>
      </>}
    </div>
    <div className={`barras barras-${tipo}`} role="group" aria-label={`${titulo}: toque em um mês para ver o valor${meta ? `; esperado ${rotulo(meta)} por mês` : ""}`}>
      {meta ? <div className="barras-meta" style={{ bottom: `calc(22px + (100% - 30px) * ${meta / max})` }}><span>esperado</span></div> : null}
      {itens.map((d, i) => {
        const escolhido = i === sel;
        // Nome do mês embaixo só a cada N barras (não encavala).
        const mostraMes = (itens.length - 1 - i) % cada === 0;
        return (
          <button
            type="button"
            key={d.comp + (d.proj ? "p" : "")}
            className={`barras-col${escolhido ? " sel" : ""}`}
            onClick={() => setSel(i)}
            aria-pressed={escolhido}
            aria-label={`${mes(d)}: ${rotulo(d.valor)}${d.proj ? " (projeção)" : ""}`}
            title={`${mes(d)}: ${rotulo(d.valor)}${d.proj ? " (projeção)" : ""}`}
          >
            <span className={`barras-b${d.proj ? " proj" : ""}${escolhido ? " hi" : ""}`} style={{ height: `${Math.max(2, (d.valor / max) * 100)}%`, animationDelay: `${Math.min(i, 24) * 0.02}s` }} />
            <span className="barras-mes">{mostraMes ? `${mesAbrev(d.comp)}${d.comp.endsWith("-01") || i === 0 ? `/${d.comp.slice(2, 4)}` : ""}` : ""}</span>
          </button>
        );
      })}
    </div>
    </>
  );
}
