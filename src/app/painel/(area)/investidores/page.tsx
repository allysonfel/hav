import Link from "next/link";
import { requireUser, eAdmin } from "@/lib/session";
import { listarInvestidores, nomeCurtoUsina } from "@/lib/investidores";
import { brl0 } from "@/lib/format";
import { Retorno } from "@/components/basicos";

export default async function Investidores({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string }> }) {
  const u = await requireUser();
  const { q = "", ok } = await searchParams;
  const admin = eAdmin(u);
  const lista = await listarInvestidores(admin, q);
  return (
    <>
      <Retorno ok={ok} mapaOk={{ excluido: "Investidor excluído." }} mapaErro={{}} />
      <div className="section-head">
        <h3>Investidores</h3>
        <div className="linha">
          <form method="get" className="linha" style={{ flexWrap: "nowrap" }}>
            <input className="input" name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" maxLength={80} style={{ width: 230 }} />
            <button className="btn btn-ghost">Buscar</button>
          </form>
          {admin && <Link className="btn btn-primary" href="/painel/investidores/novo">+ Novo investidor</Link>}
        </div>
      </div>
      <div className="card card-t">
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Investidor</th><th>Usinas</th><th>Total investido</th><th>Receita acumulada</th><th>Status</th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={5} className="vazio">{q ? "Ninguém encontrado." : "Nenhum investidor cadastrado."}</td></tr>}
              {lista.map((i) => (
                <tr key={i.id}>
                  <td><Link className="row-name" href={`/painel/investidores/${i.id}`}>{i.nome}</Link><div className="row-sub">{i.email}</div></td>
                  <td>{i.usinas.map(nomeCurtoUsina).join(", ") || "—"}</td>
                  <td className="num">{brl0(i.investido_centavos)}</td>
                  <td className="num">{brl0(i.recebido_centavos)}</td>
                  <td>
                    {!i.ativo ? <span className="pill pill-muted">Inativo</span>
                      : i.pendentes ? <span className="pill pill-warn">Repasse pendente</span>
                      : <span className="pill pill-ok">Em dia</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
