import { kwhCurto, brlCurto, mesAbrev } from "@/lib/format";
import { STATUS_USINA, type StatusUsina } from "@/lib/usinas";

export function PillUsina({ s }: { s: StatusUsina }) {
  const c = s === "operando" ? "pill-ok" : s === "captacao" ? "pill-warn" : "pill-muted";
  return <span className={`pill ${c}`}>{STATUS_USINA[s]}</span>;
}

export function Kpi({ label, valor, delta, neutro }: { label: string; valor: string; delta?: string; neutro?: boolean }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value num">{valor}</div>
      {delta && <div className={`delta${neutro ? " neutro" : ""}`}>{delta}</div>}
    </div>
  );
}

export function Progresso({ ppm }: { ppm: number }) {
  return <div className="progress"><i style={{ width: `${Math.min(100, ppm / 10_000)}%` }} /></div>;
}

// Avisos de resultado das ações (?ok= e ?erro= na URL).
export function Retorno({ ok, erro, mapaOk, mapaErro }: { ok?: string; erro?: string; mapaOk?: Record<string, string>; mapaErro: Record<string, string> }) {
  return (
    <>
      {ok && <div className="aviso ok">{mapaOk?.[ok] ?? "Salvo."}</div>}
      {erro && <div className="aviso erro">{mapaErro[erro] ?? "Não foi possível salvar. Confira os dados."}</div>}
    </>
  );
}

// Gráfico de barras do protótipo. O último mês fica rotulado com o valor.
export function Barras({ titulo, sub, dados, tipo }: {
  titulo: string;
  sub: string;
  dados: { comp: string; valor: number }[];
  tipo: "kwh" | "brl";
}) {
  const cor = tipo === "kwh" ? "var(--chart-kwh)" : "var(--chart-money)";
  const rotulo = (v: number) => (tipo === "kwh" ? `${kwhCurto(v)}` : brlCurto(v));
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const largura = 400;
  const passo = largura / Math.max(dados.length, 6);
  const ultimo = dados[dados.length - 1];
  return (
    <div className="card bars-chart">
      <h4>{titulo}</h4>
      <div className="h-sub">{sub}</div>
      {dados.length === 0 ? (
        <div className="vazio">Sem meses fechados ainda.</div>
      ) : (
        <svg viewBox="0 -14 400 164" width="100%" height="164" role="img" aria-label={`${titulo}: ${dados.map((d) => `${mesAbrev(d.comp)} ${rotulo(d.valor)}`).join(", ")}`}>
          <line x1="0" y1="130" x2="400" y2="130" style={{ stroke: "var(--chart-base)" }} strokeWidth="1" />
          <line x1="0" y1="90" x2="400" y2="90" style={{ stroke: "var(--chart-grid)" }} strokeWidth="1" />
          <line x1="0" y1="50" x2="400" y2="50" style={{ stroke: "var(--chart-grid)" }} strokeWidth="1" />
          {dados.map((d, i) => {
            const h = Math.max(2, (d.valor / max) * 120);
            const x = passo * i + (passo - 34) / 2;
            return (
              <g key={d.comp}>
                <rect x={x} y={130 - h} width="34" height={h} rx="4" style={{ fill: cor }}><title>{`${mesAbrev(d.comp)}: ${rotulo(d.valor)}`}</title></rect>
                <text x={x + 17} y="144" fontSize="10.5" style={{ fill: "var(--chart-txt)" }} textAnchor="middle">{mesAbrev(d.comp)}</text>
                {d === ultimo && <text x={x + 17} y={130 - h - 5} fontSize="11" style={{ fill: "var(--chart-ink)" }} fontWeight="700" textAnchor="middle">{rotulo(d.valor)}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// Histórico estendido (12 ou 24 meses) com a projeção dos próximos meses em
// barras tracejadas. Rótulo de mês só a cada N barras para não encavalar; o
// valor de cada barra fica no <title> (aparece ao passar o mouse ou tocar).
export function Historico({ titulo, sub, dados, projecao, tipo, aviso, largura = 600 }: {
  titulo: string;
  sub: string;
  dados: { comp: string; valor: number }[];
  projecao: { comp: string; valor: number }[];
  tipo: "kwh" | "brl";
  aviso?: string;
  // Largura do desenho: 600 no painel; no app (tela de celular), 340, para o texto não encolher.
  largura?: number;
}) {
  const cor = tipo === "kwh" ? "var(--chart-kwh)" : "var(--chart-money)";
  const rotulo = (v: number) => (tipo === "kwh" ? `${kwhCurto(v)} kWh` : brlCurto(v));
  const todos = [...dados.map((d) => ({ ...d, proj: false })), ...projecao.map((d) => ({ ...d, proj: true }))];
  const max = Math.max(...todos.map((d) => d.valor), 1);
  const W = largura, base = 140, alto = 118, margem = 14;
  const passo = (W - 2 * margem) / Math.max(todos.length, 6);
  const barra = Math.min(34, Math.max(8, passo * 0.62));
  const cabem = Math.max(3, Math.floor((W - 2 * margem) / 44));
  const cada = Math.max(1, Math.ceil(todos.length / cabem));
  const descr = todos.map((d) => `${mesAbrev(d.comp)}/${d.comp.slice(2, 4)} ${rotulo(d.valor)}${d.proj ? " (projeção)" : ""}`).join(", ");
  return (
    <div className="card bars-chart">
      <div className="linha" style={{ justifyContent: "space-between" }}>
        <div><h4>{titulo}</h4><div className="h-sub" style={{ marginBottom: 0 }}>{sub}</div></div>
        {projecao.length > 0 && (
          <div className="legenda">
            <span><i style={{ background: cor }} />Realizado</span>
            <span><i className="tracejado" style={{ borderColor: cor }} />Projeção</span>
          </div>
        )}
      </div>
      {todos.length === 0 ? (
        <div className="vazio">Sem meses fechados ainda.</div>
      ) : (
        <svg viewBox={`0 -16 ${W} 174`} width="100%" role="img" aria-label={`${titulo}: ${descr}`} style={{ marginTop: 10 }}>
          <line x1="0" y1={base} x2={W} y2={base} style={{ stroke: "var(--chart-base)" }} strokeWidth="1" />
          <line x1="0" y1={base - alto / 2} x2={W} y2={base - alto / 2} style={{ stroke: "var(--chart-grid)" }} strokeWidth="1" />
          <line x1="0" y1={base - alto} x2={W} y2={base - alto} style={{ stroke: "var(--chart-grid)" }} strokeWidth="1" />
          {todos.map((d, i) => {
            const h = Math.max(2, (d.valor / max) * alto);
            const x = margem + passo * i + (passo - barra) / 2;
            const mostrarMes = (todos.length - 1 - i) % cada === 0;
            return (
              <g key={d.comp + (d.proj ? "p" : "")}>
                <rect x={x} y={base - h} width={barra} height={h} rx="4"
                  style={{ fill: d.proj ? "var(--surface)" : cor, stroke: d.proj ? cor : "none" }} strokeWidth={d.proj ? 1.5 : 0} strokeDasharray={d.proj ? "4 3" : undefined}>
                  <title>{`${mesAbrev(d.comp)}/${d.comp.slice(0, 4)}: ${rotulo(d.valor)}${d.proj ? " (projeção)" : ""}`}</title>
                </rect>
                {mostrarMes && (
                  <text x={x + barra / 2} y={base + 14} fontSize="10.5" style={{ fill: "var(--chart-txt)" }} textAnchor="middle">
                    {mesAbrev(d.comp)}{d.comp.endsWith("-01") || i === 0 ? `/${d.comp.slice(2, 4)}` : ""}
                  </text>
                )}
              </g>
            );
          })}
          {/* Valor do último mês fechado por cima de tudo (a projeção não cobre). */}
          {dados.length > 0 && (() => {
            const i = dados.length - 1;
            const h = Math.max(2, (dados[i].valor / max) * alto);
            const cx = Math.min(W - 40, Math.max(40, margem + passo * i + passo / 2));
            return <text x={cx} y={base - h - 5} fontSize="11" fontWeight="700" textAnchor="middle" strokeWidth="3" paintOrder="stroke" style={{ fill: "var(--chart-ink)", stroke: "var(--surface)" }}>{rotulo(dados[i].valor)}</text>;
          })()}
        </svg>
      )}
      {projecao.length > 0 && (
        <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
          {aviso ?? "Projeção simples a partir do histórico (mesmo mês do ano anterior ajustado pela tendência, ou média dos 3 últimos meses). É uma estimativa, não uma garantia."}
        </p>
      )}
    </div>
  );
}
