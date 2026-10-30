import Link from "next/link";
import { requireUser, eAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { brl0, dataBr, kwh, mesAno } from "@/lib/format";
import { listarInvestidores } from "@/lib/investidores";

// Todo mês fechado vira relatório: não há o que gerar à parte.
export default async function Relatorios({ searchParams }: { searchParams: Promise<{ por?: string; usina?: string; repasse?: string }> }) {
  const u = await requireUser();
  const admin = eAdmin(u);
  const sp = await searchParams;
  const porInvestidor = sp.por === "investidor";
  const usinaId = Number(sp.usina) || 0;
  const soPendentes = sp.repasse === "pendente";

  const usinas = await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM usinas WHERE status <> 'captacao' ORDER BY nome`;
  const fechamentos = porInvestidor ? [] : await sql<{ id: number; comp: string; usina: string; geracao_wh: number; receita_centavos: number; fechado_em: Date; pendentes: number }[]>`
    SELECT f.id, to_char(f.competencia, 'YYYY-MM') AS comp, us.nome AS usina, f.geracao_wh, f.receita_centavos, f.fechado_em,
      (SELECT count(*)::int FROM rateios r WHERE r.fechamento_id = f.id AND r.repasse_status = 'pendente') AS pendentes
    FROM fechamentos f JOIN usinas us ON us.id = f.usina_id
    WHERE f.status = 'fechado' ${usinaId ? sql`AND f.usina_id = ${usinaId}` : sql``}
      ${soPendentes ? sql`AND EXISTS (SELECT 1 FROM rateios r WHERE r.fechamento_id = f.id AND r.repasse_status = 'pendente')` : sql``}
    ORDER BY f.competencia DESC, us.nome LIMIT 120`;
  const investidores = porInvestidor ? (await listarInvestidores(admin)).filter((i) => i.recebido_centavos > 0) : [];

  return (
    <>
      <div className="section-head">
        <h3>Relatórios</h3>
        <div className="seg-tabs">
          <Link className={porInvestidor ? "" : "active"} href="/painel/relatorios">Por usina</Link>
          <Link className={porInvestidor ? "active" : ""} href="/painel/relatorios?por=investidor">Por investidor</Link>
        </div>
      </div>

      {!porInvestidor && (
        <form method="get" className="linha" style={{ marginBottom: 14 }}>
          <select className="input" name="usina" defaultValue={usinaId || ""} style={{ width: 260 }}>
            <option value="">Todas as usinas</option>
            {usinas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
          <select className="input" name="repasse" defaultValue={soPendentes ? "pendente" : ""} style={{ width: 210 }}>
            <option value="">Todos os repasses</option>
            <option value="pendente">Só com repasse pendente</option>
          </select>
          <button className="btn btn-ghost">Filtrar</button>
        </form>
      )}

      <div className="card card-t">
        <div className="tbl-wrap">
          {porInvestidor ? (
            <table className="dt">
              <thead><tr><th>Investidor</th><th>Receita acumulada</th><th>Repasses pendentes</th><th></th></tr></thead>
              <tbody>
                {investidores.length === 0 && <tr><td colSpan={4} className="vazio">Nenhum rateio fechado ainda.</td></tr>}
                {investidores.map((i) => (
                  <tr key={i.id}>
                    <td><Link className="row-name" href={`/painel/investidores/${i.id}`}>{i.nome}</Link><div className="row-sub">{i.email}</div></td>
                    <td className="num">{brl0(i.recebido_centavos)}</td>
                    <td className="num">{i.pendentes}</td>
                    <td className="acoes"><a className="btn btn-ghost btn-sm" href={`/painel/investidores/${i.id}/exportar`}>Baixar</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="dt">
              <thead><tr><th>Relatório</th><th>Usina</th><th>Geração</th><th>Receita</th><th>Fechado em</th><th>Repasses</th><th></th></tr></thead>
              <tbody>
                {fechamentos.length === 0 && <tr><td colSpan={7} className="vazio">Nenhum mês fechado com esse filtro.</td></tr>}
                {fechamentos.map((f) => (
                  <tr key={f.id}>
                    <td><Link className="row-name" href={`/painel/fechamentos/${f.id}`}>Rateio mensal, {mesAno(f.comp)}</Link></td>
                    <td>{f.usina}</td>
                    <td className="num">{kwh(f.geracao_wh)}</td>
                    <td className="num">{brl0(f.receita_centavos)}</td>
                    <td className="num">{dataBr(f.fechado_em)}</td>
                    <td>{f.pendentes ? <span className="pill pill-warn">{f.pendentes} pendente(s)</span> : <span className="pill pill-ok">Pagos</span>}</td>
                    <td className="acoes"><a className="btn btn-ghost btn-sm" href={`/painel/fechamentos/${f.id}/exportar`}>Baixar</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
