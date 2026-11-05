import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { meusRelatorios, minhaSerie, minhasUsinas } from "@/lib/app";
import { brl, brl0, dataBr, kwh, mesLongo, pct } from "@/lib/format";
import { local } from "@/lib/usinas";
import { historicoInvestidor } from "@/lib/historico";
import { getSettings } from "@/lib/settings";
import { Historico } from "@/components/basicos";
import { after } from "next/server";
import { sincronizarVencidas } from "@/lib/monitoramento";
import { QuadroPeriodo } from "@/components/QuadroPeriodo";
import { atrasado, pctTexto, previsaoRepasse, relacaoEsperado, rendimentoInvestidor, situacaoEsperado } from "@/lib/acompanhamento";

export default async function Inicio() {
  const i = await requireInvestidor();
  const usinas = await minhasUsinas(i.id);
  const serie = await minhaSerie(i.id);
  const atual = serie[serie.length - 1];
  const cfg = await getSettings();
  const hist = await historicoInvestidor(i.id, 12, cfg.projecaoApp ? 3 : 0);
  const rend = await rendimentoInvestidor(i.id);
  const ativas = usinas.filter((u) => u.status !== "captacao").length;
  const primeiro = i.nome.split(" ")[0];
  const integradas = usinas.filter((u) => u.monitoramento_tipo && u.status !== "captacao");
  if (integradas.length) after(() => sincronizarVencidas(cfg.inicioPeriodo, integradas.map((u) => u.usina_id)));

  // Repasse do último mês fechado (somando as usinas): pago, previsto ou atrasado.
  const doMes = atual ? (await meusRelatorios(i.id)).filter((r) => r.comp === atual.comp) : [];
  const pendentesMes = doMes.filter((r) => r.repasse_status === "pendente");
  const prevista = pendentesMes.length ? previsaoRepasse(pendentesMes[0].fechado_em, cfg.prazoRepasse) : null;
  const pagoEm = doMes.length && !pendentesMes.length ? doMes.map((r) => r.pago_em).filter(Boolean).sort().pop() ?? null : null;
  const retorno = rend.investido > 0 ? (rend.recebido + rend.aReceber) / rend.investido : 0;

  return (
    <>
      <div className="hello">
        <div className="hi">Olá, {primeiro} 👋</div>
        <h2>{atual ? `Seu resumo de ${mesLongo(atual.comp).split(" ")[0]}` : "Bem-vindo à HAV Energia"}</h2>
      </div>

      {atual ? (
        <div className="hero-card">
          <div className="lbl">SUA RECEITA DO MÊS</div>
          <div className="amt num">{brl(atual.receita_centavos)}</div>
          <div className="period">
            Referente a {mesLongo(atual.comp)}
            {rend.investido > 0 && <> · <b>{pctTexto(atual.receita_centavos, rend.investido)} do valor investido</b></>}
          </div>
          <div className="hero-split">
            <div className="box"><b className="num">{kwh(atual.geracao_wh)}</b><span>Sua parte da geração</span></div>
            <Link className="box" href="/relatorios">
              {pendentesMes.length
                ? (atrasado(prevista, "pendente")
                  ? <><b>Aguardando</b><span>{`Repasse previsto era ${dataBr(prevista!)}`}</span></>
                  : <><b>Previsto</b><span>{prevista ? `Repasse até ${dataBr(prevista)}` : "Repasse em andamento"}</span></>)
                : <><b>Pago ✓</b><span>{pagoEm ? `Repasse em ${dataBr(pagoEm)}` : "Repasse feito"}</span></>}
            </Link>
          </div>
        </div>
      ) : (
        <div className="card card-p vazio" style={{ marginBottom: 16 }}>Sua receita aparece aqui quando o primeiro mês for fechado.</div>
      )}

      {rend.investido > 0 && rend.recebido + rend.aReceber > 0 && (
        <div className="card card-p retorno">
          <div className="ttl" style={{ marginBottom: 10 }}>
            <div><h3>Seu retorno até agora</h3><small>Soma de todos os meses fechados nas suas usinas</small></div>
          </div>
          <div className="retorno-num">
            <div><span>Investido</span><b className="num">{brl0(rend.investido)}</b></div>
            <div><span>Já recebido</span><b className="num">{brl0(rend.recebido)}</b></div>
            {rend.aReceber > 0 && <div><span>A receber</span><b className="num">{brl0(rend.aReceber)}</b></div>}
          </div>
          <div className="progress" style={{ marginTop: 14 }}><i style={{ width: `${Math.min(100, retorno * 100)}%` }} /></div>
          <p className="retorno-frase"><b>{pctTexto(rend.recebido + rend.aReceber, rend.investido)}</b> do valor que você investiu já voltou em receita.</p>
        </div>
      )}

      {hist.real.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <Historico titulo="Sua receita mês a mês" sub="Soma das suas usinas · toque num mês para ver o valor" dados={hist.real.map((m) => ({ comp: m.comp, valor: m.receita_centavos }))} projecao={hist.projReceita} tipo="brl" largura={340}
            aviso="Estimativa simples pelo histórico das usinas. Não é promessa de rendimento: a geração depende do sol, da operação e da tarifa." />
        </div>
      )}

      {integradas.map((u) => (
        <QuadroPeriodo key={u.usina_id} usinaId={u.usina_id} inicio={cfg.inicioPeriodo} tarifa={u.tarifa_kwh} cotaPpm={u.cota_ppm} titulo={`${u.nome}: agora`} />
      ))}

      <div className="section-head"><h3>Minhas usinas</h3>{ativas > 0 && <span className="hint">{ativas} {ativas === 1 ? "cota ativa" : "cotas ativas"}</span>}</div>
      {usinas.length === 0 && <div className="card card-p vazio">Nenhuma cota registrada ainda.</div>}
      {usinas.map((u) => {
        const sit = situacaoEsperado(relacaoEsperado(u.geracao_wh, u.geracao_esperada_wh ? (u.geracao_esperada_wh * u.cota_ppm) / 1_000_000 : null));
        return (
          <Link key={u.usina_id} className="card mini-card" href={`/usinas#usina-${u.usina_id}`}>
            <div className="row-top">
              <div><h4>{u.nome}</h4><div className="loc">{local(u)}</div></div>
              <span className="quota-chip">{pct(u.cota_ppm)} cota</span>
            </div>
            {u.geracao_wh !== null && (
              <div className="mini-dados">
                <span><b className="num">{kwh(u.geracao_wh)}</b> no último mês</span>
                <span><b className="num">{brl(u.receita_centavos ?? 0)}</b></span>
                {sit && <span className={`pill pill-sm ${sit.classe}`}>{sit.texto}</span>}
              </div>
            )}
          </Link>
        );
      })}
    </>
  );
}
