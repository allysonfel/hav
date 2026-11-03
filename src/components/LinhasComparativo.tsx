"use client";

// Gráfico de linhas do comparativo entre usinas. Uma linha por usina, cor fixa
// da usina, legenda sempre visível e rótulo no fim de cada linha (até 4 usinas).
// Passar o mouse (ou tocar) mostra a linha do mês com o valor de cada usina.
import { useEffect, useRef, useState } from "react";
import { fmtMetrica as fmt, mesAbrev, type Formato } from "@/lib/format";

type Serie = { id: number; nome: string; cor: string; valores: (number | null)[] };

export function LinhasComparativo({ comps, series, formato, titulo, sub }: { comps: string[]; series: Serie[]; formato: Formato; titulo: string; sub: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  // Desenha na largura real do cartão: texto sempre no mesmo tamanho, no celular e no computador.
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ob = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  const H = 220, esq = 14, dir = series.length <= 4 && W > 420 ? 130 : 16, topo = 12, base = 186;
  const valores = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const max = Math.max(...valores, 0) * 1.08 || 1;
  const largura = W - esq - dir;
  const x = (i: number) => esq + (comps.length === 1 ? largura / 2 : (largura * i) / (comps.length - 1));
  const y = (v: number) => base - ((base - topo) * v) / max;
  const cabem = Math.max(2, Math.floor((W - esq - dir) / 46));
  const cada = Math.max(1, Math.ceil(comps.length / cabem));
  const nomeCurto = (n: string) => n.replace(/^Usina\s+/i, "");

  const caminho = (s: Serie) => {
    let d = "";
    let caneta = false;
    s.valores.forEach((v, i) => {
      if (v === null) { caneta = false; return; }
      d += `${caneta ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      caneta = true;
    });
    return d;
  };

  return (
    <div className="card bars-chart">
      <h4>{titulo}</h4>
      <div className="h-sub">{sub}</div>
      <div className="legenda" style={{ marginBottom: 8 }}>
        {series.map((s) => <span key={s.id}><i className="linha-s" style={{ background: s.cor }} />{nomeCurto(s.nome)}</span>)}
      </div>
      {comps.length === 0 ? (
        <div className="vazio">Sem meses fechados no período.</div>
      ) : (
        <div style={{ position: "relative" }} ref={caixa}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: "100%" }} role="img" aria-label={`${titulo}. ${series.map((s) => `${nomeCurto(s.nome)}: ${s.valores.map((v, i) => `${mesAbrev(comps[i])} ${v === null ? "sem dado" : fmt(formato, v, true)}`).join(", ")}`).join(". ")}`}
            onMouseLeave={() => setFoco(null)}>
            {[0, 0.5, 1].map((k) => <line key={k} x1={esq} x2={W - dir} y1={base - (base - topo) * k} y2={base - (base - topo) * k} stroke={k === 0 ? "#e3e7ec" : "#eef1f4"} />)}
            {comps.map((c, i) => (comps.length - 1 - i) % cada === 0 && (
              <text key={c} x={x(i)} y={base + 18} fontSize="10.5" fill="#8894a1" textAnchor="middle">{mesAbrev(c)}{c.endsWith("-01") || i === 0 ? `/${c.slice(2, 4)}` : ""}</text>
            ))}
            {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={topo} y2={base} stroke="#8894a1" strokeDasharray="3 3" />}
            {series.map((s) => (
              <g key={s.id}>
                <path d={caminho(s)} fill="none" stroke={s.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {s.valores.map((v, i) => v !== null && (foco === i || comps.length === 1) && (
                  <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill={s.cor} stroke="#fff" strokeWidth="2" />
                ))}
              </g>
            ))}
            {dir > 16 && rotulosFim(series, y).map((l) => (
              <text key={l.id} x={x(l.i) + 8} y={l.y + 4} fontSize="11" fill="#142033" fontWeight="600">{nomeCurto(l.nome).slice(0, 16)}</text>
            ))}
            {/* Faixas de toque maiores que a marca: uma por mês. */}
            {comps.map((c, i) => (
              <rect key={c} x={x(i) - largura / Math.max(comps.length - 1, 1) / 2} y={0} width={largura / Math.max(comps.length - 1, 1)} height={base} fill="transparent"
                onMouseEnter={() => setFoco(i)} onClick={() => setFoco(foco === i ? null : i)} />
            ))}
          </svg>
          {foco !== null && (
            <div className="dica-grafico" style={{ left: `${Math.min(70, Math.max(2, (x(foco) / W) * 100 - 12))}%` }}>
              <b>{mesAbrev(comps[foco])}/{comps[foco].slice(0, 4)}</b>
              {series.map((s) => (
                <div key={s.id}><i style={{ background: s.cor }} />{nomeCurto(s.nome)}<span className="num">{s.valores[foco] === null ? "sem dado" : fmt(formato, s.valores[foco]!)}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Rótulo no fim de cada linha, afastando os que ficariam um em cima do outro.
function rotulosFim(series: Serie[], y: (v: number) => number) {
  const l = series.map((s) => {
    const i = s.valores.findLastIndex((v) => v !== null);
    return i < 0 ? null : { id: s.id, nome: s.nome, i, y: y(s.valores[i]!) };
  }).filter((v): v is { id: number; nome: string; i: number; y: number } => !!v).sort((a, b) => a.y - b.y);
  for (let k = 1; k < l.length; k++) if (l[k].y - l[k - 1].y < 14) l[k].y = l[k - 1].y + 14;
  return l;
}
