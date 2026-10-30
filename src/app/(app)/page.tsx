import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { minhaSerie, minhasUsinas } from "@/lib/app";
import { brl, kwh, mesAbrev, mesLongo, pct } from "@/lib/format";
import { local } from "@/lib/usinas";

export default async function Inicio() {
  const i = await requireInvestidor();
  const usinas = await minhasUsinas(i.id);
  const serie = await minhaSerie(i.id);
  const atual = serie[serie.length - 1];
  const max = Math.max(...serie.map((s) => s.receita_centavos), 1);
  const ativas = usinas.filter((u) => u.status !== "captacao").length;
  const primeiro = i.nome.split(" ")[0];

  return (
    <>
      <div className="hello">
        <div className="hi">Olá, {primeiro} 👋</div>
        <h2>{atual ? `Seu resumo de ${mesLongo(atual.comp).split(" ")[0]}` : "Bem-vindo à HAV Energia"}</h2>
      </div>

      {atual ? (
        <div className="hero-card">
          <div className="lbl">RECEITA PROPORCIONAL DO MÊS</div>
          <div className="amt num">{brl(atual.receita_centavos)}</div>
          <div className="period">Referente a {mesLongo(atual.comp)}</div>
          <div className="hero-split">
            <div className="box"><b className="num">{kwh(atual.geracao_wh)}</b><span>Geração proporcional</span></div>
            <div className="box"><b className="num">{ativas} {ativas === 1 ? "usina" : "usinas"}</b><span>Cotas ativas</span></div>
          </div>
        </div>
      ) : (
        <div className="card card-p vazio" style={{ marginBottom: 16 }}>Sua receita aparece aqui quando o primeiro mês for fechado.</div>
      )}

      {serie.length > 1 && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 2px", fontSize: 13.5 }}>Sua receita nos últimos meses</h4>
          <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>Soma das suas usinas</div>
          <div className="inv-sparkline" role="img" aria-label={serie.map((s) => `${mesAbrev(s.comp)}: ${brl(s.receita_centavos)}`).join(", ")}>
            {serie.map((s, n) => (
              <div key={s.comp} className={`bar${n === serie.length - 1 ? " now" : ""}`} style={{ height: Math.max(4, (s.receita_centavos / max) * 90) }} title={brl(s.receita_centavos)} />
            ))}
          </div>
          <div className="inv-meses">{serie.map((s) => <span key={s.comp}>{mesAbrev(s.comp)}</span>)}</div>
        </div>
      )}

      <div className="section-head"><h3 style={{ fontSize: 14 }}>Minhas usinas</h3></div>
      {usinas.length === 0 && <div className="card card-p vazio">Nenhuma cota registrada ainda.</div>}
      {usinas.map((u) => (
        <Link key={u.usina_id} className="card mini-card" href="/usinas">
          <div className="row-top">
            <div><h4>{u.nome}</h4><div className="loc">{local(u)}</div></div>
            <span className="quota-chip">{pct(u.cota_ppm)} cota</span>
          </div>
          {u.geracao_wh !== null && (
            <div className="mini-dados">
              <span><b className="num">{kwh(u.geracao_wh)}</b> no último mês</span>
              <span><b className="num">{brl(u.receita_centavos ?? 0)}</b></span>
            </div>
          )}
        </Link>
      ))}
    </>
  );
}
