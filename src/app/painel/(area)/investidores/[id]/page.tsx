import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, eAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { decifrar } from "@/lib/cifra";
import { celularFormatado, cnpjFormatado } from "@/lib/cpf";
import { brl, brl0, dataBr, haQuanto, kwh, mesAno, pct } from "@/lib/format";
import { Kpi, Retorno } from "@/components/basicos";
import { ativarInvestidor } from "../acoes";

const cpfFormatado = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

export default async function Investidor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const u = await requireUser();
  const admin = eAdmin(u);
  const id = Number((await params).id);
  const { ok } = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [i] = await sql<{ id: number; nome: string; email: string; celular: string; documento_cifrado: string | null; documento_final: string; pix_cifrado: string | null; ativo: boolean; ultimo_acesso: Date | null }[]>`
    SELECT id, nome, email, celular, documento_cifrado, documento_final, pix_cifrado, ativo, ultimo_acesso FROM investidores WHERE id = ${id}`;
  if (!i) notFound();

  const cotas = await sql<{ usina_id: number; usina: string; status: string; cota_ppm: number; valor_centavos: number }[]>`
    SELECT c.usina_id, us.nome AS usina, us.status, c.cota_ppm, c.valor_centavos
    FROM cotas c JOIN usinas us ON us.id = c.usina_id
    WHERE c.investidor_id = ${id} AND c.ativa AND (${admin} OR us.status <> 'captacao') ORDER BY us.nome`;
  const rateios = await sql<{ fechamento_id: number; comp: string; usina: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string; pago_em: Date | null }[]>`
    SELECT f.id AS fechamento_id, to_char(f.competencia, 'YYYY-MM') AS comp, us.nome AS usina, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status, r.pago_em
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id JOIN usinas us ON us.id = f.usina_id
    WHERE r.investidor_id = ${id} ORDER BY f.competencia DESC, us.nome LIMIT 60`;

  const investido = cotas.reduce((a, c) => a + c.valor_centavos, 0);
  const recebido = rateios.filter((r) => r.repasse_status === "pago").reduce((a, r) => a + r.receita_centavos, 0);
  const aReceber = rateios.filter((r) => r.repasse_status === "pendente").reduce((a, r) => a + r.receita_centavos, 0);

  // Documento completo e chave Pix só para o admin; o operador vê mascarado.
  const docAberto = admin ? decifrar(i.documento_cifrado) : "";
  const documento = docAberto
    ? (docAberto.length === 14 ? cnpjFormatado(docAberto) : cpfFormatado(docAberto))
    : i.documento_final ? `••••••${i.documento_final}` : "—";

  return (
    <>
      <Retorno ok={ok} mapaErro={{}} mapaOk={{ salvo: "Investidor salvo." }} />
      <Link className="btn btn-ghost" style={{ marginBottom: 14 }} href="/painel/investidores">← Voltar para investidores</Link>
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div className="linha"><h3 style={{ fontSize: 17 }}>{i.nome}</h3>{!i.ativo && <span className="pill pill-muted">Inativo</span>}</div>
          {admin && (
            <div className="linha">
              <Link className="btn btn-ghost" href={`/painel/investidores/${i.id}/editar`}>Editar</Link>
              <form action={ativarInvestidor}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="ativo" value={i.ativo ? "0" : "1"} />
                <button className={`btn ${i.ativo ? "btn-danger" : "btn-ghost"}`}>{i.ativo ? "Desativar" : "Reativar"}</button>
              </form>
            </div>
          )}
        </div>
        <div className="dados">
          <div><span>E-mail</span><b>{i.email}</b></div>
          <div><span>Celular</span><b>{i.celular ? celularFormatado(i.celular) : "—"}</b></div>
          <div><span>CPF/CNPJ</span><b className="num">{documento}</b></div>
          {admin && <div><span>Chave Pix</span><b>{decifrar(i.pix_cifrado) || "—"}</b></div>}
          <div><span>Último acesso ao app</span><b>{i.ultimo_acesso ? haQuanto(i.ultimo_acesso) : "nunca"}</b></div>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Kpi label="Total investido" valor={brl0(investido)} />
        <Kpi label="Recebido" valor={brl0(recebido)} />
        <Kpi label="Repasse pendente" valor={brl(aReceber)} />
      </div>

      <div className="card card-t">
        <div className="section-head dentro"><h3>Cotas</h3></div>
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Usina</th><th>Cota</th><th>Valor investido</th></tr></thead>
            <tbody>
              {cotas.length === 0 && <tr><td colSpan={3} className="vazio">Sem cotas. Adicione pela tela da usina.</td></tr>}
              {cotas.map((c) => (
                <tr key={c.usina_id}>
                  <td><Link className="row-name" href={`/painel/usinas/${c.usina_id}`}>{c.usina}</Link>{c.status === "captacao" && <span className="pill pill-warn" style={{ marginLeft: 8 }}>Em captação</span>}</td>
                  <td className="num">{pct(c.cota_ppm)}</td>
                  <td className="num">{brl0(c.valor_centavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-t">
        <div className="section-head dentro">
          <h3>Rateios</h3>
          {rateios.length > 0 && <a className="btn btn-ghost btn-sm" href={`/painel/investidores/${i.id}/exportar`}>Baixar planilha</a>}
        </div>
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Mês</th><th>Usina</th><th>Cota</th><th>Geração</th><th>Receita</th><th>Repasse</th></tr></thead>
            <tbody>
              {rateios.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum mês fechado ainda.</td></tr>}
              {rateios.map((r) => (
                <tr key={r.fechamento_id}>
                  <td><Link className="row-name" href={`/painel/fechamentos/${r.fechamento_id}`}>{mesAno(r.comp)}</Link></td>
                  <td>{r.usina}</td>
                  <td className="num">{pct(r.cota_ppm)}</td>
                  <td className="num">{kwh(r.geracao_wh)}</td>
                  <td className="num">{brl(r.receita_centavos)}</td>
                  <td>{r.repasse_status === "pago" ? <span className="pill pill-ok">Pago{r.pago_em ? ` em ${dataBr(r.pago_em)}` : ""}</span> : <span className="pill pill-warn">Pendente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
