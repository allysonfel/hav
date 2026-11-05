import { GradeBarras, type Ponto } from "./GradeBarras";
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

export function Barras({ titulo, sub, dados, tipo }: {
  titulo: string;
  sub: string;
  dados: { comp: string; valor: number }[];
  tipo: "kwh" | "brl";
}) {
  return (
    <div className="card bars-chart">
      <div className="ttl"><h3>{titulo}</h3><small>{sub}</small></div>
      {dados.length === 0 ? <div className="vazio">Sem meses fechados ainda.</div> : <GradeBarras itens={dados} tipo={tipo} cabem={12} titulo={titulo} />}
    </div>
  );
}

// Histórico estendido (12 ou 24 meses) com a projeção dos próximos meses.
export function Historico({ titulo, sub, dados, projecao, tipo, aviso, largura = 600, meta }: {
  titulo: string;
  sub: string;
  dados: { comp: string; valor: number }[];
  projecao: { comp: string; valor: number }[];
  tipo: "kwh" | "brl";
  aviso?: string;
  // Espaço para os nomes dos meses: 600 no painel; no app (celular), 340.
  largura?: number;
  // Geração esperada por mês (Wh), desenhada como linha.
  meta?: number | null;
}) {
  const todos: Ponto[] = [...dados, ...projecao.map((d) => ({ ...d, proj: true }))];
  return (
    <div className="card bars-chart">
      <div className="ttl">
        <div><h3>{titulo}</h3><small>{sub}</small></div>
        {(projecao.length > 0 || !!meta) && (
          <div className={`legenda barras-${tipo}`}>
            <span><i className="leg-real" />Realizado</span>
            {projecao.length > 0 && <span><i className="tracejado" />Projeção</span>}
            {!!meta && <span><i className="leg-meta" />Esperado</span>}
          </div>
        )}
      </div>
      {todos.length === 0 ? <div className="vazio">Sem meses fechados ainda.</div> : <GradeBarras itens={todos} tipo={tipo} cabem={Math.max(3, Math.floor(largura / 50))} comUnidade titulo={titulo} meta={meta} />}
      {projecao.length > 0 && (
        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
          {aviso ?? "Projeção simples a partir do histórico (mesmo mês do ano anterior ajustado pela tendência, ou média dos 3 últimos meses). É uma estimativa, não uma garantia."}
        </p>
      )}
    </div>
  );
}
