import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, eAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { local, serieMensal, type StatusUsina } from "@/lib/usinas";
import { brl, brl0, kwh, kwp, mesAno, pct, tarifaTxt } from "@/lib/format";
import { PPM_TOTAL, dividir, somaPpm } from "@/lib/rateio";
import { Historico, Kpi, PillUsina, Progresso, Retorno } from "@/components/basicos";
import { historicoUsinas, periodoDe } from "@/lib/historico";
import { removerCota, salvarCota } from "../acoes";
import { relacaoEsperado, situacaoEsperado } from "@/lib/acompanhamento";

const ERROS: Record<string, string> = {
  valor: "Informe o valor investido.",
  usina: "Usina não encontrada.",
  investidor: "Escolha um investidor ativo.",
  cota: "Confira o percentual da cota.",
  excede: "Com essa cota, a usina passaria de 100%. Ajuste as outras primeiro.",
};

export default async function Usina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string; p?: string }> }) {
  const user = await requireUser();
  const admin = eAdmin(user);
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [u] = await sql<{ id: number; nome: string; cidade: string; uf: string; capacidade_wp: number; investimento_centavos: number; status: StatusUsina; desde: string | null; inversor_marca: string; inversor_modelo: string; inversor_qtd: number; monitoramento: string; geracao_esperada_wh: number | null; tarifa_kwh: number | null }[]>`
    SELECT id, nome, cidade, uf, capacidade_wp, investimento_centavos, status, to_char(operando_desde, 'YYYY-MM') AS desde,
      inversor_marca, inversor_modelo, inversor_qtd, monitoramento, geracao_esperada_wh::float8 AS geracao_esperada_wh, tarifa_kwh
    FROM usinas WHERE id = ${id}`;
  if (!u) notFound();

  const verValores = admin || u.status !== "captacao";
  const cotas = verValores
    ? await sql<{ investidor_id: number; nome: string; cota_ppm: number; valor_centavos: number }[]>`
        SELECT c.investidor_id, i.nome, c.cota_ppm, c.valor_centavos
        FROM cotas c JOIN investidores i ON i.id = c.investidor_id
        WHERE c.usina_id = ${id} AND c.ativa ORDER BY c.cota_ppm DESC, i.nome`
    : [];
  const serie = await serieMensal(id);
  const periodo = periodoDe(sp.p);
  const hist = await historicoUsinas(id, periodo, u.status === "operando" ? 3 : 0);
  const fechamentos = await sql<{ id: number; comp: string; geracao_wh: number; receita_centavos: number; status: string; pendentes: number }[]>`
    SELECT f.id, to_char(f.competencia, 'YYYY-MM') AS comp, f.geracao_wh, f.receita_centavos, f.status,
      (SELECT count(*)::int FROM rateios r WHERE r.fechamento_id = f.id AND r.repasse_status = 'pendente') AS pendentes
    FROM fechamentos f WHERE f.usina_id = ${id} ORDER BY f.competencia DESC LIMIT 12`;
  const investidores = admin ? await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM investidores WHERE ativo ORDER BY nome` : [];

  const atual = serie[serie.length - 1];
  const esperada = u.geracao_esperada_wh;
  const sit = situacaoEsperado(relacaoEsperado(atual?.geracao_wh, esperada));
  const soma = somaPpm(cotas);
  const ppms = cotas.map((c) => c.cota_ppm);
  const prevGeracao = atual ? dividir(atual.geracao_wh, ppms) : [];
  const prevReceita = atual ? dividir(atual.receita_centavos, ppms) : [];

  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaErro={ERROS} mapaOk={{ usina: "Usina salva.", cota: "Cota salva.", cota_removida: "Cota removida. Meses já fechados não mudam." }} />
      <Link className="btn btn-ghost" style={{ marginBottom: 14 }} href="/painel/usinas">← Voltar para usinas</Link>

      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="linha"><h3 style={{ fontSize: 17 }}>{u.nome}</h3><PillUsina s={u.status} /></div>
            <span className="hint">{local(u)}{u.desde ? ` · Operando desde ${mesAno(u.desde)}` : ""}</span>
          </div>
          <div className="linha">
            {admin && <Link className="btn btn-ghost" href={`/painel/usinas/${u.id}/editar`}>Editar</Link>}
            {u.status !== "captacao" && <Link className="btn btn-gold" href={`/painel/usinas/${u.id}/lancar`}>Lançar geração do mês</Link>}
          </div>
        </div>
        <div className="kpi-row" style={{ marginBottom: 18 }}>
          <Kpi label="Capacidade" valor={kwp(u.capacidade_wp)} />
          {verValores && <Kpi label={u.status === "captacao" ? "Meta" : "Investimento total"} valor={brl0(u.investimento_centavos)} />}
          <Kpi label={atual ? `Geração (${mesAno(atual.comp)})` : "Geração"} valor={atual ? kwh(atual.geracao_wh) : "—"}
            delta={sit ? `${sit.abaixo ? "↓" : "✓"} ${sit.texto}` : esperada ? undefined : admin ? "Cadastre a geração esperada em Editar" : undefined} neutro={!sit || sit.abaixo} />
          <Kpi label="Receita distribuída" valor={atual ? brl0(atual.receita_centavos) : "—"}
            delta={u.tarifa_kwh ? `${tarifaTxt(u.tarifa_kwh)} gerado` : admin && u.status !== "captacao" ? "Cadastre o valor por kWh em Editar" : undefined} neutro />
        </div>
        <div className="section-head" style={{ marginBottom: 10 }}>
          <span className="hint">Histórico{hist.projGeracao.length ? " e projeção dos próximos 3 meses" : ""}</span>
          <div className="seg-tabs">
            {[12, 24].map((p) => <Link key={p} className={p === periodo ? "active" : ""} href={`/painel/usinas/${u.id}?p=${p}`} scroll={false}>{p} meses</Link>)}
          </div>
        </div>
        <div className="two-col igual" style={{ marginBottom: 0 }}>
          <Historico titulo="Geração mensal" sub={`kWh · últimos ${periodo} meses fechados`} dados={hist.real.map((s) => ({ comp: s.comp, valor: s.geracao_wh }))} projecao={hist.projGeracao} tipo="kwh" meta={esperada} />
          <Historico titulo="Receita distribuída" sub={`R$ · últimos ${periodo} meses fechados`} dados={hist.real.map((s) => ({ comp: s.comp, valor: s.receita_centavos }))} projecao={hist.projReceita} tipo="brl" />
        </div>
      </div>

      {verValores && (
        <div className="card card-t" id="cotistas">
          <div className="section-head dentro">
            <h3>Cotistas desta usina</h3>
            <span className="hint">{atual ? `Rateio por cota, ${mesAno(atual.comp)}` : "Cotas vigentes"} · {pct(soma)} distribuídos</span>
          </div>
          <div style={{ padding: "0 18px 10px" }}>
            <Progresso ppm={soma} />
            {u.status !== "captacao" && soma !== PPM_TOTAL && <div className="aviso info" style={{ margin: "10px 0 0" }}>As cotas somam {pct(soma)}. O mês só fecha com 100% exatos.</div>}
          </div>
          <div className="tbl-wrap">
            <table className="dt">
              <thead><tr><th>Investidor</th><th>Cota</th><th>Valor investido</th>{atual && <th>Geração proporcional</th>}{atual && <th>Receita (mês)</th>}{admin && <th></th>}</tr></thead>
              <tbody>
                {cotas.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum cotista ainda.</td></tr>}
                {cotas.map((c, i) => (
                  <tr key={c.investidor_id}>
                    <td><Link className="row-name" href={`/painel/investidores/${c.investidor_id}`}>{c.nome}</Link></td>
                    <td className="num">{pct(c.cota_ppm)}</td>
                    <td className="num">{brl0(c.valor_centavos)}</td>
                    {atual && <td className="num">{kwh(prevGeracao[i])}</td>}
                    {atual && <td className="num">{brl(prevReceita[i])}</td>}
                    {admin && (
                      <td className="acoes">
                        <form action={removerCota}>
                          <input type="hidden" name="usina" value={u.id} />
                          <input type="hidden" name="investidor" value={c.investidor_id} />
                          <button className="btn btn-danger btn-sm">Remover</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {admin && (
            <form action={salvarCota} style={{ padding: 18, borderTop: "1px solid var(--border)" }}>
              <input type="hidden" name="usina" value={u.id} />
              <div className="box-title" style={{ marginTop: 0 }}>Adicionar ou alterar cotista</div>
              <div className="form-grid" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", alignItems: "end" }}>
                <div className="field">
                  <label htmlFor="investidor">Investidor</label>
                  <select id="investidor" name="investidor" required defaultValue="">
                    <option value="" disabled>Escolha</option>
                    {investidores.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor="valor">Valor investido (R$)</label><input id="valor" name="valor" required inputMode="decimal" /></div>
                <div className="field"><label htmlFor="cota">Cota % (opcional)</label><input id="cota" name="cota" inputMode="decimal" placeholder="automática" /></div>
                <div className="field"><button className="btn btn-primary">Salvar</button></div>
              </div>
              <p className="muted sm" style={{ margin: 0 }}>Sem percentual, a cota é calculada pelo valor investido sobre o investimento total da usina.</p>
            </form>
          )}
        </div>
      )}

      <div className="card card-t">
        <div className="section-head dentro"><h3>Lançamentos</h3><span className="hint">Últimos 12 meses</span></div>
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Mês</th><th>Geração</th>{esperada && <th>Esperado</th>}<th>Receita</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {fechamentos.length === 0 && <tr><td colSpan={5} className="vazio">Nenhum mês lançado.</td></tr>}
              {fechamentos.map((f) => (
                <tr key={f.id}>
                  <td className="row-name">{mesAno(f.comp)}</td>
                  <td className="num">{kwh(f.geracao_wh)}</td>
                  {esperada && <td><PillEsperado r={relacaoEsperado(f.geracao_wh, esperada)} /></td>}
                  <td className="num">{brl0(f.receita_centavos)}</td>
                  <td>
                    {f.status === "rascunho" ? <span className="pill pill-muted">Rascunho</span>
                      : f.pendentes ? <span className="pill pill-warn">{f.pendentes} repasse(s) pendente(s)</span>
                      : <span className="pill pill-ok">Fechado e pago</span>}
                  </td>
                  <td className="acoes"><Link className="btn btn-ghost btn-sm" href={`/painel/fechamentos/${f.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(u.inversor_marca || u.monitoramento) && (
        <div className="card card-p">
          <div className="box-title" style={{ marginTop: 0 }}>Inversores e monitoramento</div>
          <div className="dados">
            <div><span>Marca</span><b>{u.inversor_marca || "—"}</b></div>
            <div><span>Modelo</span><b>{u.inversor_modelo || "—"}</b></div>
            <div><span>Quantidade</span><b>{u.inversor_qtd || "—"}</b></div>
            <div><span>Monitoramento</span><b>{u.monitoramento || "—"}</b></div>
          </div>
        </div>
      )}
    </>
  );
}

function PillEsperado({ r }: { r: number | null }) {
  const s = situacaoEsperado(r);
  return s ? <span className={`pill pill-sm ${s.classe}`}>{s.texto}</span> : <span className="muted">—</span>;
}
