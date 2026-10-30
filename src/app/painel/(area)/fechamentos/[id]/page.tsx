import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, eAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { brl, kwh, dataBr, mesLongo, pct } from "@/lib/format";
import { PPM_TOTAL, dividir, somaPpm } from "@/lib/rateio";
import { Kpi, Retorno } from "@/components/basicos";
import { fecharMes, marcarRepasse, reabrirMes } from "../../usinas/acoes";

const ERROS: Record<string, string> = {
  cotas: "As cotas desta usina não somam 100%. Ajuste os cotistas antes de fechar.",
  ja_fechado: "Este mês já estava fechado.",
  tem_pago: "Há repasses marcados como pagos. Desfaça-os antes de reabrir.",
  nao_achou: "Lançamento não encontrado.",
};
const OK: Record<string, string> = {
  lancado: "Lançamento salvo como rascunho.",
  fechado: "Mês fechado. O rateio foi gravado.",
  reaberto: "Mês reaberto para correção.",
  repasse: "Repasse atualizado.",
};

export default async function Fechamento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const u = await requireUser();
  const admin = eAdmin(u);
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [f] = await sql<{ id: number; usina_id: number; usina: string; comp: string; geracao_wh: number; receita_centavos: number; status: string; fechado_em: Date | null; quem: string | null }[]>`
    SELECT f.id, f.usina_id, u.nome AS usina, to_char(f.competencia, 'YYYY-MM') AS comp, f.geracao_wh, f.receita_centavos, f.status, f.fechado_em, q.nome AS quem
    FROM fechamentos f JOIN usinas u ON u.id = f.usina_id LEFT JOIN usuarios q ON q.id = f.fechado_por
    WHERE f.id = ${id}`;
  if (!f) notFound();
  const fechado = f.status === "fechado";

  type Linha = { id: number; investidor_id: number; nome: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string; pago_em: Date | null };
  let linhas: Linha[];
  if (fechado) {
    linhas = [...await sql<Linha[]>`
      SELECT r.id, r.investidor_id, i.nome, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status, r.pago_em
      FROM rateios r JOIN investidores i ON i.id = r.investidor_id
      WHERE r.fechamento_id = ${id} ORDER BY r.cota_ppm DESC, i.nome`];
  } else {
    // Prévia com as cotas de hoje: nada gravado até fechar.
    const cotas = await sql<{ investidor_id: number; nome: string; cota_ppm: number }[]>`
      SELECT c.investidor_id, i.nome, c.cota_ppm FROM cotas c JOIN investidores i ON i.id = c.investidor_id
      WHERE c.usina_id = ${f.usina_id} AND c.ativa ORDER BY c.investidor_id`;
    const ppms = cotas.map((c) => c.cota_ppm);
    const soma100 = somaPpm(cotas) === PPM_TOTAL;
    const g = soma100 ? dividir(f.geracao_wh, ppms) : ppms.map(() => 0);
    const r = soma100 ? dividir(f.receita_centavos, ppms) : ppms.map(() => 0);
    linhas = cotas.map((c, i) => ({ id: 0, investidor_id: c.investidor_id, nome: c.nome, cota_ppm: c.cota_ppm, geracao_wh: g[i], receita_centavos: r[i], repasse_status: "", pago_em: null }))
      .sort((a, b) => b.cota_ppm - a.cota_ppm);
  }
  const pendentes = linhas.filter((l) => l.repasse_status === "pendente").length;
  const soma = somaPpm(linhas);

  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaOk={OK} mapaErro={ERROS} />
      <Link className="btn btn-ghost" style={{ marginBottom: 14 }} href={`/painel/usinas/${f.usina_id}`}>← {f.usina}</Link>
      <div className="section-head">
        <div>
          <div className="linha">
            <h3 style={{ fontSize: 17 }}>{mesLongo(f.comp)}</h3>
            {fechado ? <span className="pill pill-ok">Fechado</span> : <span className="pill pill-muted">Rascunho</span>}
          </div>
          <span className="hint">{f.usina}{f.fechado_em ? ` · fechado em ${dataBr(f.fechado_em)}${f.quem ? ` por ${f.quem}` : ""}` : ""}</span>
        </div>
        <div className="linha">
          {!fechado && <Link className="btn btn-ghost" href={`/painel/usinas/${f.usina_id}/lancar?comp=${f.comp}`}>Corrigir lançamento</Link>}
          {fechado && <a className="btn btn-ghost" href={`/painel/fechamentos/${id}/exportar`}>Baixar planilha</a>}
          {fechado && admin && <form action={reabrirMes}><input type="hidden" name="id" value={id} /><button className="btn btn-ghost">Reabrir mês</button></form>}
          {!fechado && admin && <form action={fecharMes}><input type="hidden" name="id" value={id} /><button className="btn btn-gold">Fechar mês</button></form>}
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Kpi label="Geração" valor={kwh(f.geracao_wh)} />
        <Kpi label="Receita a distribuir" valor={brl(f.receita_centavos)} />
        <Kpi label="Cotistas" valor={String(linhas.length)} delta={`${pct(soma)} distribuídos`} neutro />
      </div>

      {!fechado && <div className="aviso info">Prévia com as cotas de hoje. {admin ? "Ao fechar, os valores ficam gravados e entram nos relatórios." : "Quem fecha o mês é o administrador."}</div>}
      {!fechado && soma !== PPM_TOTAL && <div className="aviso erro">As cotas somam {pct(soma)}. Sem 100% exatos, não dá para calcular o rateio nem fechar.</div>}

      <div className="card card-t">
        <div className="section-head dentro">
          <h3>Rateio por cota</h3>
          {fechado && admin && pendentes > 0 && (
            <form action={marcarRepasse}>
              <input type="hidden" name="fechamento" value={id} />
              <input type="hidden" name="pago" value="1" />
              <button className="btn btn-primary btn-sm">Marcar todos como pagos ({pendentes})</button>
            </form>
          )}
        </div>
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Investidor</th><th>Cota</th><th>Geração proporcional</th><th>Receita</th>{fechado && <th>Repasse</th>}{fechado && admin && <th></th>}</tr></thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={6} className="vazio">Esta usina ainda não tem cotistas.</td></tr>}
              {linhas.map((l) => (
                <tr key={l.investidor_id}>
                  <td><Link className="row-name" href={`/painel/investidores/${l.investidor_id}`}>{l.nome}</Link></td>
                  <td className="num">{pct(l.cota_ppm)}</td>
                  <td className="num">{kwh(l.geracao_wh)}</td>
                  <td className="num">{brl(l.receita_centavos)}</td>
                  {fechado && <td>{l.repasse_status === "pago" ? <span className="pill pill-ok">Pago{l.pago_em ? ` em ${dataBr(l.pago_em)}` : ""}</span> : <span className="pill pill-warn">Pendente</span>}</td>}
                  {fechado && admin && (
                    <td className="acoes">
                      <form action={marcarRepasse}>
                        <input type="hidden" name="fechamento" value={id} />
                        <input type="hidden" name="rateio" value={l.id} />
                        <input type="hidden" name="pago" value={l.repasse_status === "pago" ? "0" : "1"} />
                        <button className="btn btn-ghost btn-sm">{l.repasse_status === "pago" ? "Desfazer" : "Marcar pago"}</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
