"use client";

import { useState } from "react";
import { kwh, kwhCurto } from "@/lib/format";

// Geração de cada dia do período, no mesmo desenho das barras por mês: tocar
// num dia mostra o valor numa linha fixa acima. Dias ainda sem dado ficam vazios.
export function BarrasDias({ dias, titulo }: { dias: { dia: string; geracao_wh: number | null }[]; titulo: string }) {
  const ultimo = dias.map((d) => d.geracao_wh !== null).lastIndexOf(true);
  const [sel, setSel] = useState(ultimo);
  const max = Math.max(...dias.map((d) => d.geracao_wh ?? 0), 1);
  const atual = dias[sel];
  const rotulo = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <>
      <div className="barras-leitura" aria-live="polite">
        {atual && <><span>{rotulo(atual.dia)}</span><b className="num">{atual.geracao_wh !== null ? kwh(atual.geracao_wh) : "sem dado ainda"}</b></>}
      </div>
      <div className="barras barras-kwh barras-dias" role="group" aria-label={`${titulo}: toque em um dia para ver o valor`}>
        {dias.map((d, i) => (
          <button type="button" key={d.dia} className={`barras-col${i === sel ? " sel" : ""}`} onClick={() => setSel(i)} aria-pressed={i === sel}
            aria-label={`${rotulo(d.dia)}: ${d.geracao_wh !== null ? `${kwhCurto(d.geracao_wh)} kWh` : "sem dado"}`}>
            <span className={`barras-b${i === sel ? " hi" : ""}`} style={{ height: `${d.geracao_wh ? Math.max(2, (d.geracao_wh / max) * 100) : 0}%`, animationDelay: `${Math.min(i, 31) * 0.015}s` }} />
            <span className="barras-mes">{i % 5 === 0 || i === dias.length - 1 ? d.dia.slice(8, 10) : ""}</span>
          </button>
        ))}
      </div>
    </>
  );
}
