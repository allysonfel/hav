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

// Barras no padrão dos painéis da Logos (HTML, não SVG: o texto fica sempre do mesmo
// tamanho). Meses em tom suave, o último mês fechado em cor cheia e com o valor em
// cima; projeção em barra tracejada. O valor de cada barra aparece ao passar o mouse.
type Ponto = { comp: string; valor: number; proj?: boolean };
function GradeBarras({ itens, tipo, cabem, rotulo, titulo }: { itens: Ponto[]; tipo: "kwh" | "brl"; cabem: number; rotulo: (v: number) => string; titulo: string }) {
  const max = Math.max(...itens.map((d) => d.valor), 1);
  const ultimoReal = itens.map((d) => !d.proj).lastIndexOf(true);
  const cada = Math.max(1, Math.ceil(itens.length / cabem));
  const descr = itens.map((d) => `${mesAbrev(d.comp)}/${d.comp.slice(2, 4)} ${rotulo(d.valor)}${d.proj ? " (projeção)" : ""}`).join(", ");
  return (
    <div className={`barras barras-${tipo}`} role="img" aria-label={`${titulo}: ${descr}`}>
      {itens.map((d, i) => (
        <div key={d.comp + (d.proj ? "p" : "")} className="barras-col" title={`${mesAbrev(d.comp)}/${d.comp.slice(0, 4)}: ${rotulo(d.valor)}${d.proj ? " (projeção)" : ""}`}>
          <div className={`barras-b${d.proj ? " proj" : i === ultimoReal ? " hi" : ""}`} style={{ height: `${Math.max(2, (d.valor / max) * 100)}%`, animationDelay: `${Math.min(i, 24) * 0.02}s` }}>
            {i === ultimoReal && <b className="num">{rotulo(d.valor)}</b>}
          </div>
          <span>{(itens.length - 1 - i) % cada === 0 ? `${mesAbrev(d.comp)}${d.comp.endsWith("-01") || i === 0 ? `/${d.comp.slice(2, 4)}` : ""}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function Barras({ titulo, sub, dados, tipo }: {
  titulo: string;
  sub: string;
  dados: { comp: string; valor: number }[];
  tipo: "kwh" | "brl";
}) {
  const rotulo = (v: number) => (tipo === "kwh" ? `${kwhCurto(v)}` : brlCurto(v));
  return (
    <div className="card bars-chart">
      <div className="ttl"><h3>{titulo}</h3><small>{sub}</small></div>
      {dados.length === 0 ? <div className="vazio">Sem meses fechados ainda.</div> : <GradeBarras itens={dados} tipo={tipo} cabem={12} rotulo={rotulo} titulo={titulo} />}
    </div>
  );
}

// Histórico estendido (12 ou 24 meses) com a projeção dos próximos meses.
export function Historico({ titulo, sub, dados, projecao, tipo, aviso, largura = 600 }: {
  titulo: string;
  sub: string;
  dados: { comp: string; valor: number }[];
  projecao: { comp: string; valor: number }[];
  tipo: "kwh" | "brl";
  aviso?: string;
  // Espaço para os nomes dos meses: 600 no painel; no app (celular), 340.
  largura?: number;
}) {
  const rotulo = (v: number) => (tipo === "kwh" ? `${kwhCurto(v)} kWh` : brlCurto(v));
  const todos: Ponto[] = [...dados, ...projecao.map((d) => ({ ...d, proj: true }))];
  return (
    <div className="card bars-chart">
      <div className="ttl">
        <div><h3>{titulo}</h3><small>{sub}</small></div>
        {projecao.length > 0 && (
          <div className={`legenda barras-${tipo}`}>
            <span><i className="leg-real" />Realizado</span>
            <span><i className="tracejado" />Projeção</span>
          </div>
        )}
      </div>
      {todos.length === 0 ? <div className="vazio">Sem meses fechados ainda.</div> : <GradeBarras itens={todos} tipo={tipo} cabem={Math.max(3, Math.floor(largura / 50))} rotulo={rotulo} titulo={titulo} />}
      {projecao.length > 0 && (
        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
          {aviso ?? "Projeção simples a partir do histórico (mesmo mês do ano anterior ajustado pela tendência, ou média dos 3 últimos meses). É uma estimativa, não uma garantia."}
        </p>
      )}
    </div>
  );
}
