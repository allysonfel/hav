import Link from "next/link";
import { requireUser, eAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { listarUsinas, local, serieMensal } from "@/lib/usinas";
import { brl0, kwh, kwp, mesAno, mesAbrev, num, pct } from "@/lib/format";
import { Historico, Kpi, PillUsina, Progresso } from "@/components/basicos";
import { historicoUsinas } from "@/lib/historico";
import { demoAtiva } from "@/lib/demo";
import { alternarDemo } from "./configuracoes/acoes";
import { MesAtual } from "@/components/MesAtual";
import { relacaoEsperado, situacaoEsperado } from "@/lib/acompanhamento";
import { Confirmar } from "@/components/Confirmar";

export default async function VisaoGeral({ searchParams }: { searchParams: Promise<{ erro?: string; demo?: string; demo_erro?: string }> }) {
  const u = await requireUser();
  const { erro, demo: demoMsg, demo_erro } = await searchParams;
  const admin = eAdmin(u);
  const demo = admin && (await demoAtiva());
  const usinas = await listarUsinas();
  const serie = await serieMensal(null);
  const hist = await historicoUsinas(null, 12);
  const [{ investidores }] = await sql<{ investidores: number }[]>`
    SELECT count(DISTINCT c.investidor_id)::int AS investidores
    FROM cotas c JOIN usinas u ON u.id = c.usina_id JOIN investidores i ON i.id = c.investidor_id
    WHERE c.ativa AND i.ativo AND u.status = 'operando'`;

  const operando = usinas.filter((x) => x.status === "operando");
  const captacao = usinas.filter((x) => x.status === "captacao");
  const capacidade = operando.reduce((a, x) => a + x.capacidade_wp, 0);
  const capCaptacao = captacao.reduce((a, x) => a + x.capacidade_wp, 0);
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  // Com só parte das usinas fechadas, comparar com o mês anterior enganaria.
  const parcial = !!atual && atual.usinas < operando.length;
  const variacao = atual && anterior?.geracao_wh && !parcial ? ((atual.geracao_wh - anterior.geracao_wh) / anterior.geracao_wh) * 100 : null;
  const dest = captacao[0];
  const [interessados] = admin && dest
    ? await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM interesses WHERE usina_id = ${dest.id} AND status IN ('aguardando', 'negociacao')`
    : [{ n: 0 }];
  const ppmDest = dest ? Math.round((dest.captado_centavos / dest.investimento_centavos) * 1_000_000) : 0;

  return (
    <>
      {erro === "permissao" && <div className="aviso erro">Seu perfil não tem acesso a essa área.</div>}
      {admin && (
        <div className="demo-barra">
          <form action={alternarDemo}>
            <input type="hidden" name="acao" value={demo ? "desligar" : "ligar"} />
            <input type="hidden" name="de" value="/painel" />
            <Confirmar className={`toggle${demo ? " on" : ""}`} role="switch" aria-checked={demo} title={demo ? "Remover os dados de demonstração" : "Preencher o sistema com dados fictícios para apresentar"} ativo={demo} titulo="Remover os dados de demonstração?" texto="Sai tudo o que a demonstração criou (usinas, investidores e meses fictícios). Os cadastros reais ficam." confirmar="Remover dados" perigo={false}>
              <i /> Dados de demonstração
            </Confirmar>
          </form>
        </div>
      )}
      {demoMsg && <div className="aviso ok">{demoMsg === "ligada" ? "Dados de demonstração carregados." : "Dados de demonstração removidos."}</div>}
      {demo_erro && <div className="aviso erro">{demo_erro}</div>}
      <MesAtual admin={admin} />
      <div className="kpi-row">
        <Kpi label="Usinas ativas" valor={num(operando.length)} delta={captacao.length ? `${captacao.length} em captação` : undefined} neutro />
        <Kpi label="Capacidade instalada" valor={kwp(capacidade)} delta={capCaptacao ? `+${kwp(capCaptacao)} em captação` : undefined} neutro />
        <Kpi label={atual ? `Geração de ${mesAbrev(atual.comp).toLowerCase()}` : "Geração do mês"} valor={atual ? kwh(atual.geracao_wh) : "—"}
          delta={parcial ? `${atual.usinas} de ${operando.length} usinas fechadas` : variacao === null ? undefined : `${variacao >= 0 ? "↑" : "↓"} ${num(Math.abs(variacao), 1)}% vs. mês anterior`}
          neutro={parcial || (variacao !== null && variacao < 0)} />
        <Kpi label="Receita distribuída" valor={atual ? brl0(atual.receita_centavos) : "—"} delta={`${investidores} investidores ativos`} neutro />
      </div>

      <div className="two-col" style={admin && dest ? undefined : { gridTemplateColumns: "1fr" }}>
        <Historico titulo="Geração mensal consolidada" sub="Todas as usinas · 12 meses fechados e projeção · kWh" dados={hist.real.map((s) => ({ comp: s.comp, valor: s.geracao_wh }))} projecao={hist.projGeracao} tipo="kwh" />
        {admin && dest && (
          <div className="card card-p">
            <h4 style={{ margin: "0 0 2px" }}>Captação em andamento</h4>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>{dest.nome}</div>
            <div className="big num">{brl0(dest.captado_centavos)}</div>
            <div className="muted" style={{ fontSize: 12, margin: "2px 0 10px" }}>de {brl0(dest.investimento_centavos)} · {pct(ppmDest)}</div>
            <Progresso ppm={ppmDest} />
            <div className="muted" style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12 }}>
              <span>{dest.cotistas} cotistas confirmados</span><span>{interessados.n} interessados</span>
            </div>
            <Link className="btn btn-ghost btn-block" style={{ marginTop: 14 }} href="/painel/captacao">Ver captação</Link>
          </div>
        )}
      </div>

      <div className="card card-t">
        <div className="section-head dentro"><h3>Usinas</h3><span className="hint">Último mês fechado de cada uma</span></div>
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Usina</th><th>Capacidade</th><th>Geração</th><th>Esperado</th><th>Receita</th><th>Mês</th><th>Status</th></tr></thead>
            <tbody>
              {usinas.length === 0 && <tr><td colSpan={7} className="vazio">Nenhuma usina cadastrada. <Link className="link" href="/painel/usinas/nova">Cadastrar a primeira</Link></td></tr>}
              {usinas.map((x) => (
                <tr key={x.id}>
                  <td><Link className="row-name" href={`/painel/usinas/${x.id}`}>{x.nome}</Link><div className="row-sub">{local(x)}</div></td>
                  <td className="num">{kwp(x.capacidade_wp)}</td>
                  <td className="num">{x.geracao_wh === null ? "—" : kwh(x.geracao_wh)}</td>
                  <td>{(() => { const sit = situacaoEsperado(relacaoEsperado(x.geracao_wh, x.geracao_esperada_wh)); return sit ? <span className={`pill pill-sm ${sit.classe}`}>{sit.texto}</span> : <span className="muted">—</span>; })()}</td>
                  <td className="num">{x.receita_centavos === null ? "—" : brl0(x.receita_centavos)}</td>
                  <td className="muted">{x.comp ? mesAno(x.comp) : "—"}</td>
                  <td><PillUsina s={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
