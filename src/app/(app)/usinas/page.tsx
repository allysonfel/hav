import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { minhasUsinas } from "@/lib/app";
import { getSettings } from "@/lib/settings";
import { brl0, kwh, kwp, mesAno, pct } from "@/lib/format";
import { pctTexto, relacaoEsperado, rendimentoInvestidor, situacaoEsperado } from "@/lib/acompanhamento";
import { local } from "@/lib/usinas";
import { comparativo, valorDe } from "@/lib/comparativo";
import { LinhasComparativo } from "@/components/LinhasComparativo";

export default async function MinhasUsinas() {
  const i = await requireInvestidor();
  const usinas = await minhasUsinas(i.id);
  const s = await getSettings();
  const rend = await rendimentoInvestidor(i.id);
  // Comparativo só entre as usinas dele, por kWh/kWp (compara tamanhos diferentes).
  const ids = usinas.filter((u) => u.status !== "captacao").map((u) => u.usina_id);
  const comp = ids.length > 1 ? await comparativo(12, ids) : null;
  return (
    <>
      <div className="hello"><h2>Minhas usinas</h2></div>
      {usinas.length === 0 && <div className="card card-p vazio">Nenhuma cota registrada ainda.</div>}
      {usinas.map((u) => {
        const r = rend.usinas.find((x) => x.usina_id === u.usina_id);
        const sit = situacaoEsperado(relacaoEsperado(u.geracao_wh, u.geracao_esperada_wh ? (u.geracao_esperada_wh * u.cota_ppm) / 1_000_000 : null));
        return (
        <div key={u.usina_id} id={`usina-${u.usina_id}`} className="card mini-card">
          <div className="row-top">
            <div>
              <h4>{u.nome}</h4>
              <div className="loc">{local(u)}{u.status === "captacao" ? " · Em captação" : u.desde ? ` · Operando desde ${mesAno(u.desde)}` : ""}</div>
            </div>
            <span className="quota-chip">{pct(u.cota_ppm)} cota</span>
          </div>
          <div className="mini-dados" style={{ marginBottom: s.oportunidades ? 10 : 0 }}>
            <span><b className="num">{brl0(u.valor_centavos)}</b> investido</span>
            <span><b className="num">{kwp(u.capacidade_wp)}</b> capacidade total</span>
          </div>
          {r && r.meses > 0 && (
            <div className="usina-retorno">
              <div><span>Receita até agora</span><b className="num">{brl0(r.total)}</b><small>{pctTexto(r.total, r.investido)} do investido</small></div>
              <div><span>Média por mês</span><b className="num">{pctTexto(r.total / r.meses, r.investido)}</b><small>em {r.meses} {r.meses === 1 ? "mês" : "meses"}</small></div>
              {u.comp && u.geracao_wh !== null && <div><span>{mesAno(u.comp)}</span><b className="num">{kwh(u.geracao_wh)}</b>{sit ? <small className={sit.abaixo ? "abaixo" : "ok"}>{sit.texto}</small> : <small>sua parte da geração</small>}</div>}
            </div>
          )}
          {s.oportunidades && <Link className="btn btn-ghost btn-block" href="/oportunidades">Investir mais nesta usina</Link>}
        </div>
        );
      })}
      {comp && comp.series.length > 1 && (
        <div style={{ marginTop: 6 }}>
          <LinhasComparativo
            titulo="Comparativo das suas usinas"
            sub="Produtividade: kWh gerado por kWp instalado, mês a mês"
            comps={comp.comps}
            formato="prod"
            series={comp.series.filter((x) => x.cor).map((x) => ({ id: x.id, nome: x.nome, cor: x.cor!, valores: comp.comps.map((c) => { const p = x.pontos.find((y) => y.comp === c); return p ? valorDe("produtividade", p, x.capacidade_wp) : null; }) }))}
          />
        </div>
      )}
    </>
  );
}
