// Período em andamento de uma usina com integração: geração de cada dia, o
// total até agora e, com o valor por kWh, quanto já rendeu e a estimativa para
// o fim do período. No app tudo sai proporcional à cota do investidor.
import { BarrasDias } from "./BarrasDias";
import { brl, haQuanto, kwh, num, periodoTexto, receitaPorTarifa } from "@/lib/format";
import { competenciaAtual, diasDoPeriodo, grade, hojeIso, situacaoIntegracao } from "@/lib/monitoramento";
import { sincronizarAgora } from "@/app/painel/(area)/usinas/acoes";

export async function QuadroPeriodo({ usinaId, inicio, tarifa, cotaPpm, painel, titulo }: {
  usinaId: number;
  inicio: number;
  tarifa: number | null;
  // Cota do investidor (app); sem ela, a usina inteira (painel).
  cotaPpm?: number;
  painel?: boolean;
  titulo?: string;
}) {
  const sit = await situacaoIntegracao(usinaId);
  if (!sit || !sit.monitoramento_tipo) return null;
  const comp = competenciaAtual(inicio);
  const { dias, total, p } = await diasDoPeriodo(usinaId, comp, inicio);
  if (!painel && !dias.length) return null;
  const parte = (wh: number) => (cotaPpm ? Math.floor((wh * cotaPpm) / 1_000_000) : wh);
  const meu = parte(total);
  const hoje = hojeIso();
  const decorridos = Math.max(1, Math.min(p.dias, Math.round((new Date(hoje + "T12:00:00Z").getTime() - new Date(p.ini + "T12:00:00Z").getTime()) / 86_400_000) + 1));
  // Estimativa só com uma semana de dados: antes disso o número oscila demais.
  const estimativa = dias.length >= 7 && decorridos < p.dias ? Math.round((meu / decorridos) * p.dias) : null;
  const ultimoDia = dias[dias.length - 1];

  return (
    <div className="card card-p" id="dias" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 6 }}>
        <div>
          <h3 style={{ fontSize: 15 }}>{titulo ?? "Período em andamento"}</h3>
          <span className="hint">{periodoTexto(comp, inicio)} · dia {decorridos} de {p.dias}{sit.nome ? ` · dados do ${sit.nome}` : ""}</span>
        </div>
        {painel && sit.configurada && sit.monitoramento_id && (
          <form action={sincronizarAgora}><input type="hidden" name="usina" value={usinaId} /><button className="btn btn-ghost btn-sm">Atualizar agora</button></form>
        )}
      </div>
      {painel && !sit.configurada && sit.monitoramento_id && <div className="aviso info">Usina vinculada à Solis, mas a chave de acesso ainda não foi configurada no servidor. Os dados começam a entrar quando ela for ligada.</div>}
      {painel && sit.monitoramento_erro && <div className="aviso erro">Última atualização falhou: {sit.monitoramento_erro}</div>}
      {dias.length > 0 ? (
        <>
          <div className="kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 8 }}>
            <div className="card kpi"><div className="label">{cotaPpm ? "Sua geração até agora" : "Geração até agora"}</div><div className="value num">{kwh(meu)}</div>
              {ultimoDia && <div className="delta neutro">hoje: {ultimoDia.dia === hoje ? kwh(parte(ultimoDia.geracao_wh)) : "sem dado ainda"}</div>}</div>
            {tarifa && <div className="card kpi"><div className="label">{cotaPpm ? "Sua receita até agora" : "Receita até agora"}</div><div className="value num">{brl(receitaPorTarifa(meu, tarifa))}</div><div className="delta neutro">pela tarifa da usina</div></div>}
            {tarifa && estimativa !== null && <div className="card kpi"><div className="label">Estimativa no fim do período</div><div className="value num">{brl(receitaPorTarifa(estimativa, tarifa))}</div><div className="delta neutro">se o ritmo continuar</div></div>}
            {!tarifa && estimativa !== null && <div className="card kpi"><div className="label">Estimativa no fim do período</div><div className="value num">{kwh(estimativa)}</div><div className="delta neutro">se o ritmo continuar</div></div>}
          </div>
          <BarrasDias titulo="Geração por dia" dias={grade(p, dias).map((d) => ({ dia: d.dia, geracao_wh: d.geracao_wh === null ? null : parte(d.geracao_wh) }))} />
          <p className="muted sm" style={{ margin: "8px 0 0" }}>
            Média de {kwh(Math.round(meu / Math.max(1, dias.length)))} por dia{sit.monitoramento_sinc ? ` · atualizado ${haQuanto(sit.monitoramento_sinc)}` : ""}.
            {estimativa !== null ? " A estimativa usa a média dos dias até agora: depende do sol e da operação, não é garantia." : ""}
            {cotaPpm ? ` Valores da sua cota (${num(cotaPpm / 10_000, 2)}%). O valor oficial sai no relatório, quando a HAV fecha o período.` : ""}
          </p>
        </>
      ) : (
        painel && sit.configurada && !!sit.monitoramento_id && <p className="muted sm" style={{ margin: 0 }}>Ainda sem dados deste período. Use Atualizar agora.</p>
      )}
    </div>
  );
}
