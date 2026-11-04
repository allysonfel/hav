import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { minhaSerie, minhasUsinas } from "@/lib/app";
import { brl, kwh, mesLongo, pct } from "@/lib/format";
import { local } from "@/lib/usinas";
import { historicoInvestidor } from "@/lib/historico";
import { getSettings } from "@/lib/settings";
import { Historico } from "@/components/basicos";

export default async function Inicio() {
  const i = await requireInvestidor();
  const usinas = await minhasUsinas(i.id);
  const serie = await minhaSerie(i.id);
  const atual = serie[serie.length - 1];
  const cfg = await getSettings();
  const hist = await historicoInvestidor(i.id, 12, cfg.projecaoApp ? 3 : 0);
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

      {hist.real.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <Historico titulo="Sua receita mês a mês" sub="Soma das suas usinas · últimos 12 meses fechados" dados={hist.real.map((m) => ({ comp: m.comp, valor: m.receita_centavos }))} projecao={hist.projReceita} tipo="brl" largura={340}
            aviso="Estimativa simples pelo histórico das usinas. Não é promessa de rendimento: a geração depende do sol, da operação e da tarifa." />
        </div>
      )}

      <div className="section-head"><h3>Minhas usinas</h3></div>
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
