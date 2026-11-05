import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, eAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { brl, kwh, dataBr, mesLongo, pct, periodoTexto, tarifaTxt } from "@/lib/format";
import { PPM_TOTAL, dividir, somaPpm } from "@/lib/rateio";
import { Kpi, Retorno } from "@/components/basicos";
import { enviarComprovante, fecharMes, marcarRepasse, reabrirMes, reenviarEmail } from "../../usinas/acoes";
import { atrasado, previsaoRepasse, relacaoEsperado, situacaoEsperado } from "@/lib/acompanhamento";
import { AnexarComprovante } from "@/components/AnexarComprovante";
import { STATUS_ENVIO, enviosDoFechamento } from "@/lib/envios";
import { getSettings } from "@/lib/settings";
import { Confirmar } from "@/components/Confirmar";

const ERROS: Record<string, string> = {
  cotas: "As cotas desta usina não somam 100%. Ajuste os cotistas antes de fechar.",
  ja_fechado: "Este mês já estava fechado.",
  tem_pago: "Há repasses marcados como pagos. Desfaça-os antes de reabrir.",
  nao_achou: "Lançamento não encontrado.",
  comprovante: "Escolha o arquivo do comprovante.",
  comprovante_grande: "O comprovante passa de 3 MB. Mande um print ou o PDF do banco.",
  comprovante_tipo: "O comprovante precisa ser imagem (JPG, PNG ou WebP) ou PDF.",
};
const OK: Record<string, string> = {
  lancado: "Lançamento salvo como rascunho.",
  fechado: "Mês fechado. O rateio foi gravado.",
  reaberto: "Mês reaberto para correção.",
  repasse: "Repasse atualizado.",
  reenvio: "E-mail colocado na fila de novo.",
  comprovante: "Comprovante anexado. O investidor já pode baixar no app.",
};

export default async function Fechamento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const u = await requireUser();
  const admin = eAdmin(u);
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [f] = await sql<{ id: number; usina_id: number; usina: string; comp: string; geracao_wh: number; receita_centavos: number; status: string; fechado_em: Date | null; quem: string | null; esperada: number | null; tarifa_kwh: number | null; disponibilidade_ppm: number | null }[]>`
    SELECT f.id, f.usina_id, f.tarifa_kwh, f.disponibilidade_ppm, u.nome AS usina, u.geracao_esperada_wh AS esperada, to_char(f.competencia, 'YYYY-MM') AS comp, f.geracao_wh, f.receita_centavos, f.status, f.fechado_em, q.nome AS quem
    FROM fechamentos f JOIN usinas u ON u.id = f.usina_id LEFT JOIN usuarios q ON q.id = f.fechado_por
    WHERE f.id = ${id}`;
  if (!f) notFound();
  const fechado = f.status === "fechado";

  type Linha = { id: number; investidor_id: number; nome: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string; pago_em: Date | null; comprovante: boolean };
  let linhas: Linha[];
  if (fechado) {
    linhas = [...await sql<Linha[]>`
      SELECT r.id, r.investidor_id, i.nome, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status, r.pago_em,
        EXISTS (SELECT 1 FROM comprovantes c WHERE c.rateio_id = r.id) AS comprovante
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
    linhas = cotas.map((c, i) => ({ id: 0, investidor_id: c.investidor_id, nome: c.nome, cota_ppm: c.cota_ppm, geracao_wh: g[i], receita_centavos: r[i], repasse_status: "", pago_em: null, comprovante: false }))
      .sort((a, b) => b.cota_ppm - a.cota_ppm);
  }
  const pendentes = linhas.filter((l) => l.repasse_status === "pendente").length;
  const envios = fechado ? new Map((await enviosDoFechamento(id)).map((e) => [e.investidor_id, e])) : new Map();
  const s = await getSettings();
  const comEmail = fechado && envios.size > 0;
  const falhas = [...envios.values()].filter((e) => e.status === "falhou" || e.status === "simulado").length;
  const soma = somaPpm(linhas);
  const prevista = previsaoRepasse(f.fechado_em, s.prazoRepasse);
  const emAtraso = atrasado(prevista, pendentes ? "pendente" : "pago");
  const sit = situacaoEsperado(relacaoEsperado(f.geracao_wh, f.esperada));

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
          <span className="hint">{f.usina} · {periodoTexto(f.comp, s.inicioPeriodo)}{f.fechado_em ? ` · fechado em ${dataBr(f.fechado_em)}${f.quem ? ` por ${f.quem}` : ""}` : ""}</span>
        </div>
        <div className="linha">
          {!fechado && <Link className="btn btn-ghost" href={`/painel/usinas/${f.usina_id}/lancar?comp=${f.comp}`}>Corrigir lançamento</Link>}
          {fechado && <a className="btn btn-ghost" href={`/painel/fechamentos/${id}/pdf`}>Baixar PDF</a>}
          {fechado && <a className="btn btn-ghost" href={`/painel/fechamentos/${id}/exportar`}>Baixar planilha</a>}
          {fechado && admin && <form action={reabrirMes}><input type="hidden" name="id" value={id} /><Confirmar className="btn btn-ghost" titulo={`Reabrir ${f.usina}, ${f.comp.slice(5)}/${f.comp.slice(0, 4)}?`} texto={<><p>O mês volta para rascunho: o rateio é refeito ao fechar de novo e os e-mails do relatório que ainda não saíram são cancelados.</p><p>Os investidores deixam de ver este mês no app até ele ser fechado de novo.</p></>} confirmar="Reabrir mês" perigo={false}>Reabrir mês</Confirmar></form>}
          {!fechado && admin && <form action={fecharMes}><input type="hidden" name="id" value={id} /><button className="btn btn-gold">Fechar mês</button></form>}
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Kpi label="Geração" valor={kwh(f.geracao_wh)} delta={sit ? `${sit.abaixo ? "↓" : "✓"} ${sit.texto}` : undefined} neutro={!sit || sit.abaixo} />
        <Kpi label="Receita a distribuir" valor={brl(f.receita_centavos)} delta={f.tarifa_kwh ? `geração x ${tarifaTxt(f.tarifa_kwh)}` : undefined} neutro />
        {f.disponibilidade_ppm != null && <Kpi label="Disponibilidade" valor={pct(f.disponibilidade_ppm)} />}
        <Kpi label="Cotistas" valor={String(linhas.length)} delta={`${pct(soma)} distribuídos`} neutro />
      </div>

      {/* Próximo passo, em uma frase: o que fazer agora neste mês. */}
      {!fechado && <div className="aviso info"><b>Próximo passo:</b>&nbsp;{admin ? "confira o rateio abaixo (prévia com as cotas de hoje) e clique em Fechar mês. Depois de fechado, o investidor vê o mês no app e recebe o relatório." : "o administrador confere e fecha o mês. Se algum valor estiver errado, use Corrigir lançamento."}</div>}
      {fechado && pendentes > 0 && admin && <div className={`aviso ${emAtraso ? "erro" : "info"}`}><b>Próximo passo:</b>&nbsp;faça o Pix de cada cotista e anexe o comprovante (ou use Marcar pago). {prevista ? (emAtraso ? `O prazo era ${dataBr(prevista)}.` : `Previsto até ${dataBr(prevista)}.`) : ""}</div>}
      {fechado && pendentes === 0 && linhas.length > 0 && <div className="aviso ok">Mês concluído: rateio fechado e todos os repasses pagos.</div>}
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
            <thead><tr><th>Investidor</th><th>Cota</th><th>Geração proporcional</th><th>Receita</th>{fechado && <th>Repasse</th>}{comEmail && <th>Relatório por e-mail</th>}{fechado && <th></th>}</tr></thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={6} className="vazio">Esta usina ainda não tem cotistas.</td></tr>}
              {linhas.map((l) => (
                <tr key={l.investidor_id}>
                  <td><Link className="row-name" href={`/painel/investidores/${l.investidor_id}`}>{l.nome}</Link></td>
                  <td className="num">{pct(l.cota_ppm)}</td>
                  <td className="num">{kwh(l.geracao_wh)}</td>
                  <td className="num">{brl(l.receita_centavos)}</td>
                  {fechado && <td>{l.repasse_status === "pago"
                    ? <><span className="pill pill-ok">Pago{l.pago_em ? ` em ${dataBr(l.pago_em)}` : ""}</span>{l.comprovante && admin && <a className="link sm" style={{ marginLeft: 8 }} href={`/painel/comprovantes/${l.id}`} target="_blank" rel="noopener">Comprovante</a>}</>
                    : emAtraso ? <span className="pill pill-atraso">Atrasado</span> : <span className="pill pill-warn">Pendente{prevista ? ` · até ${dataBr(prevista).slice(0, 5)}` : ""}</span>}</td>}
                  {comEmail && <td><EnvioPill e={envios.get(l.investidor_id)} /></td>}
                  {fechado && (
                    <td className="acoes"><div className="linha">
                      <a className="btn btn-ghost btn-sm" href={`/painel/fechamentos/${id}/pdf?investidor=${l.investidor_id}`} title="Relatório do investidor em PDF">PDF</a>
                      {admin && comEmail && envios.get(l.investidor_id) && (
                        <form action={reenviarEmail}>
                          <input type="hidden" name="fechamento" value={id} />
                          <input type="hidden" name="investidor" value={l.investidor_id} />
                          <button className="btn btn-ghost btn-sm">Reenviar</button>
                        </form>
                      )}
                      {admin && <AnexarComprovante acao={enviarComprovante} fechamento={id} rateio={l.id} rotulo={l.repasse_status === "pago" ? (l.comprovante ? "Trocar comprovante" : "Anexar comprovante") : "Pagar com comprovante"} />}
                      {admin && <form action={marcarRepasse}>
                        <input type="hidden" name="fechamento" value={id} />
                        <input type="hidden" name="rateio" value={l.id} />
                        <input type="hidden" name="pago" value={l.repasse_status === "pago" ? "0" : "1"} />
                        <Confirmar className="btn btn-ghost btn-sm" ativo={l.repasse_status === "pago"} titulo={`Desfazer o pagamento de ${l.nome}?`} texto={l.comprovante ? "O repasse volta para pendente e o comprovante anexado é apagado." : "O repasse volta para pendente."} confirmar="Desfazer pagamento">{l.repasse_status === "pago" ? "Desfazer" : "Marcar pago"}</Confirmar>
                      </form>}
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {fechado && (
        <div className="card card-p">
          <div className="section-head" style={{ marginBottom: 6 }}>
            <h3>Relatório por e-mail</h3>
            {admin && falhas > 0 && (
              <form action={reenviarEmail}><input type="hidden" name="fechamento" value={id} /><button className="btn btn-primary btn-sm">Reenviar os que não saíram ({falhas})</button></form>
            )}
          </div>
          <p className="muted sm" style={{ margin: 0 }}>
            {!comEmail
              ? s.emailRelatorio ? "Este mês foi fechado antes do envio automático existir. Reabra e feche de novo para enviar." : "O envio automático está desligado em Configurações."
              : `Ao fechar o mês, cada cotista recebe o próprio relatório em PDF no e-mail cadastrado. Quem desligou o e-mail no app não recebe. ${[...envios.values()].filter((e) => e.status === "enviado").length} de ${envios.size} enviados.`}
          </p>
        </div>
      )}
    </>
  );
}

function EnvioPill({ e }: { e?: { status: keyof typeof STATUS_ENVIO; erro: string; enviado_em: Date | null } }) {
  if (!e) return <span className="muted">—</span>;
  const c = e.status === "enviado" ? "pill-ok" : e.status === "falhou" ? "pill-danger" : e.status === "simulado" || e.status === "cancelado" ? "pill-muted" : "pill-warn";
  return <span className={`pill ${c}`} title={e.erro || undefined}>{STATUS_ENVIO[e.status]}{e.status === "enviado" && e.enviado_em ? ` em ${dataBr(e.enviado_em)}` : ""}</span>;
}
