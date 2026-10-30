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
  const cor = tipo === "kwh" ? "#d4870f" : "#16314f";
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
          <line x1="0" y1="130" x2="400" y2="130" stroke="#e3e7ec" strokeWidth="1" />
          <line x1="0" y1="90" x2="400" y2="90" stroke="#eef1f4" strokeWidth="1" />
          <line x1="0" y1="50" x2="400" y2="50" stroke="#eef1f4" strokeWidth="1" />
          {dados.map((d, i) => {
            const h = Math.max(2, (d.valor / max) * 120);
            const x = passo * i + (passo - 34) / 2;
            return (
              <g key={d.comp}>
                <rect x={x} y={130 - h} width="34" height={h} rx="4" fill={cor}><title>{`${mesAbrev(d.comp)}: ${rotulo(d.valor)}`}</title></rect>
                <text x={x + 17} y="144" fontSize="10.5" fill="#8894a1" textAnchor="middle">{mesAbrev(d.comp)}</text>
                {d === ultimo && <text x={x + 17} y={130 - h - 5} fontSize="11" fill="#142033" fontWeight="700" textAnchor="middle">{rotulo(d.valor)}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
