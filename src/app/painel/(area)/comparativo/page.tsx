import Link from "next/link";
import { requireUser } from "@/lib/session";
import { comparativo, METRICAS, metricaDe, valorDe, type Metrica } from "@/lib/comparativo";
import { periodoDe } from "@/lib/historico";
import { fmtMetrica as fmt, kwp, mesAno, num, type Formato } from "@/lib/format";
import { LinhasComparativo } from "@/components/LinhasComparativo";

const FORMATO: Record<Metrica, Formato> = { geracao: "kwh", receita: "brl", produtividade: "prod", receita_kwp: "brlkwp" };

// Comparativo entre usinas (Plus). Todos os perfis: geração e receita já
// aparecem para o operador nas telas de usina.
export default async function Comparativo({ searchParams }: { searchParams: Promise<{ m?: string; p?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const m = metricaDe(sp.m);
  const meses = sp.p === "6" ? 6 : periodoDe(sp.p);
  const { series, comps } = await comparativo(meses);
  const f = FORMATO[m];
  const noGrafico = series.filter((s) => s.cor);
  const url = (mm: Metrica, pp: number) => `/painel/comparativo?m=${mm}&p=${pp}`;

  const linhas = series.map((s) => {
    const vals = s.pontos.map((p) => valorDe(m, p, s.capacidade_wp));
    const total = vals.reduce((a, b) => a + b, 0);
    const melhor = s.pontos[vals.indexOf(Math.max(...vals))];
    return {
      s,
      meses: s.pontos.length,
      total,
      media: total / Math.max(s.pontos.length, 1),
      prodMedia: s.pontos.reduce((a, p) => a + valorDe("produtividade", p, s.capacidade_wp), 0) / Math.max(s.pontos.length, 1),
      melhor,
    };
  }).sort((a, b) => b.media - a.media);
  // Somar produtividade de meses não faz sentido: nessas métricas o "total" é a média.
  const soMedia = m === "produtividade" || m === "receita_kwp";

  return (
    <>
      <div className="section-head">
        <div className="seg-tabs seg-rola">
          {(Object.keys(METRICAS) as Metrica[]).map((k) => <Link key={k} className={k === m ? "active" : ""} href={url(k, meses)}>{METRICAS[k].nome}</Link>)}
        </div>
        <div className="seg-tabs">
          {[6, 12, 24].map((p) => <Link key={p} className={p === meses ? "active" : ""} href={url(m, p)}>{p} meses</Link>)}
        </div>
      </div>

      {series.length < 2 && <div className="aviso info">O comparativo fica útil com duas ou mais usinas com meses fechados no período.</div>}

      <LinhasComparativo
        titulo={`${METRICAS[m].nome} por usina`}
        sub={`${METRICAS[m].unidade} · últimos ${meses} meses fechados${m === "produtividade" ? " · compara usinas de tamanhos diferentes" : ""}`}
        comps={comps}
        formato={f}
        series={noGrafico.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor!, valores: comps.map((c) => { const p = s.pontos.find((x) => x.comp === c); return p ? valorDe(m, p, s.capacidade_wp) : null; }) }))}
      />

      <div className="card card-t" style={{ marginTop: 16 }}>
        <div className="section-head dentro"><h3>Ranking do período</h3><span className="hint">Ordenado pela média mensal de {METRICAS[m].nome.toLowerCase()}</span></div>
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>#</th><th>Usina</th><th>Capacidade</th><th>Meses fechados</th>{!soMedia && <th>Total no período</th>}<th>Média mensal</th><th>kWh/kWp por mês</th><th>Melhor mês</th></tr></thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={8} className="vazio">Nenhum mês fechado no período.</td></tr>}
              {linhas.map((l, i) => (
                <tr key={l.s.id}>
                  <td className="num muted">{i + 1}</td>
                  <td><span className="linha" style={{ gap: 8, flexWrap: "nowrap" }}>{l.s.cor && <i style={{ width: 10, height: 10, borderRadius: 99, background: l.s.cor, flexShrink: 0 }} />}<Link className="row-name" href={`/painel/usinas/${l.s.id}`}>{l.s.nome}</Link></span></td>
                  <td className="num">{kwp(l.s.capacidade_wp)}</td>
                  <td className="num">{l.meses}</td>
                  {!soMedia && <td className="num">{fmt(f, l.total)}</td>}
                  <td className="num">{fmt(f, l.media)}</td>
                  <td className="num">{num(l.prodMedia, 1)}</td>
                  <td className="muted">{l.melhor ? mesAno(l.melhor.comp) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {series.length > noGrafico.length && <p className="muted sm">Com mais de 8 usinas, o gráfico mostra as 8 primeiras cadastradas; o ranking mostra todas.</p>}
    </>
  );
}
