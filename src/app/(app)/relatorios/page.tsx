import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { meusRelatorios } from "@/lib/app";
import { brl, dataBr, kwh, mesLongo } from "@/lib/format";
import { nomeCurtoUsina } from "@/lib/investidores";
import { Ic } from "@/components/Ic";

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ usina?: string }> }) {
  const i = await requireInvestidor();
  const { usina } = await searchParams;
  const todos = await meusRelatorios(i.id);
  const usinas = [...new Map(todos.map((r) => [r.usina_id, r.usina])).entries()];
  const atual = usinas.find(([id]) => id === Number(usina))?.[0] ?? usinas[0]?.[0];
  const lista = todos.filter((r) => r.usina_id === atual);
  return (
    <>
      <div className="hello"><h2 style={{ fontSize: 17 }}>Relatórios</h2></div>
      {usinas.length > 1 && (
        <div className="seg-tabs seg-rola" style={{ marginBottom: 14 }}>
          {usinas.map(([id, nome]) => <Link key={id} className={id === atual ? "active" : ""} href={`/relatorios?usina=${id}`}>{nomeCurtoUsina(nome)}</Link>)}
        </div>
      )}
      {lista.length === 0 && <div className="card card-p vazio">Seu primeiro relatório aparece quando o mês for fechado.</div>}
      {lista.length > 0 && (
        <div className="card" style={{ padding: "4px 0" }}>
          {lista.map((r) => (
            <div key={r.fechamento_id} className="list-item">
              <div className="ic"><Ic n="relatorios" /></div>
              <div className="meta">
                <b>Relatório de {mesLongo(r.comp)}</b>
                <span>{kwh(r.geracao_wh)} · {brl(r.receita_centavos)} · emitido em {dataBr(r.fechado_em).slice(0, 5)}</span>
                <span className={r.repasse_status === "pago" ? "ok-txt" : "warn-txt"}>{r.repasse_status === "pago" ? "Repasse pago" : "Repasse pendente"}</span>
              </div>
              <a className="btn btn-ghost btn-sm" href={`/relatorios/${r.fechamento_id}/exportar`}>Baixar</a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
