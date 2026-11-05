"use client";

import { useState } from "react";
import { brl, kwh, kwhCurto, receitaPorTarifa } from "@/lib/format";

// Geração de cada dia do período. O dia escolhido (começa no último com dado)
// mostra o valor num balão logo acima da própria barra, numa faixa reservada
// em cima do gráfico (nunca por cima das barras). Com o valor por kWh, o balão
// traz também a receita do dia. Dias ainda sem dado ficam vazios.
export function BarrasDias({ dias, titulo, tarifa, hoje }: { dias: { dia: string; geracao_wh: number | null }[]; titulo: string; tarifa?: number | null; hoje?: string }) {
  const ultimo = dias.map((d) => d.geracao_wh !== null).lastIndexOf(true);
  const [sel, setSel] = useState(ultimo);
  const max = Math.max(...dias.map((d) => d.geracao_wh ?? 0), 1);
  const atual = dias[sel];
  const n = Math.max(dias.length, 1);
  const rotulo = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  // Posição do balão: centro da barra escolhida; perto das bordas ele encosta no lado.
  const pos = ((sel + 0.5) / n) * 100;
  const lado = sel < n * 0.18 ? "esq" : sel > n * 0.82 ? "dir" : "meio";
  return (
    <div className="dias-grafico">
      <div className="dias-faixa" aria-live="polite">
        {atual && (
          <div className={`dias-balao dias-balao-${lado}`} style={{ left: `${pos}%` }}>
            <span className="dias-balao-dia">{rotulo(atual.dia)}{atual.dia === hoje ? " · hoje" : ""}</span>
            <b className="num">{atual.geracao_wh !== null ? kwh(atual.geracao_wh) : "sem dado ainda"}</b>
            {tarifa && atual.geracao_wh !== null ? <span className="dias-balao-rs num">{brl(receitaPorTarifa(atual.geracao_wh, tarifa))}</span> : null}
          </div>
        )}
      </div>
      <div className="barras barras-kwh barras-dias" role="group" aria-label={`${titulo}: toque em um dia para ver o valor`}>
        {dias.map((d, i) => (
          <button type="button" key={d.dia} className={`barras-col${i === sel ? " sel" : ""}`} onClick={() => setSel(i)} aria-pressed={i === sel}
            aria-label={`${rotulo(d.dia)}: ${d.geracao_wh !== null ? `${kwhCurto(d.geracao_wh)} kWh` : "sem dado"}`}>
            <span className={`barras-b${i === sel ? " hi" : ""}`} style={{ height: `${d.geracao_wh ? Math.max(2, (d.geracao_wh / max) * 100) : 0}%`, animationDelay: `${Math.min(i, 31) * 0.015}s` }} />
            <span className="barras-mes">{i === sel || ((i % 5 === 0 || i === dias.length - 1) && Math.abs(i - sel) > 1) ? d.dia.slice(8, 10) : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
