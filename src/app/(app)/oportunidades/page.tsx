import { redirect } from "next/navigation";
import { requireInvestidor } from "@/lib/investidor";
import { minhasUsinas, oportunidades } from "@/lib/app";
import { getSettings } from "@/lib/settings";
import { brl0, kwp, pct } from "@/lib/format";
import { local } from "@/lib/usinas";
import { Progresso } from "@/components/basicos";
import { quererInvestir } from "../acoes";

export default async function Oportunidades({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const i = await requireInvestidor();
  if (!(await getSettings()).oportunidades) redirect("/");
  const { erro } = await searchParams;
  const lista = await oportunidades();
  const minhas = (await minhasUsinas(i.id)).filter((u) => u.status === "operando");
  return (
    <>
      <div className="hello">
        <h2>Oportunidades</h2>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Novas usinas e ampliação de cota</div>
      </div>
      {erro && <div className="aviso erro">{erro === "limite" ? "Muitos envios. Aguarde um minuto." : "Informe o valor de interesse."}</div>}
      {lista.length === 0 && <div className="card card-p vazio" style={{ marginBottom: 14 }}>Nenhuma usina em captação agora.</div>}
      {lista.map((u) => {
        const ppm = Math.round((u.captado_centavos / u.meta_centavos) * 1_000_000);
        return (
          <form key={u.id} action={quererInvestir} className="card opp-card">
            <input type="hidden" name="usina" value={u.id} />
            <div className="badge-row"><h4>{u.nome}</h4><span className="pill pill-warn">Em captação</span></div>
            <div className="loc">{local(u)} · {kwp(u.capacidade_wp)}</div>
            <Progresso ppm={ppm} />
            <div className="opp-num"><span>{brl0(u.captado_centavos)} captados</span><span>{pct(ppm)} da meta</span></div>
            <div className="field"><label htmlFor={`v${u.id}`}>Valor de interesse (R$)</label><input id={`v${u.id}`} name="valor" required inputMode="decimal" /></div>
            <button className="btn btn-gold btn-block">Quero investir</button>
          </form>
        );
      })}
      {minhas.length > 0 && (
        <form action={quererInvestir} className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 4px" }}>Quer aumentar sua cota em uma usina atual?</h4>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 12.5 }}>Fale com a equipe HAV sobre ampliar sua participação.</p>
          <div className="field">
            <label htmlFor="usina">Usina</label>
            <select id="usina" name="usina">{minhas.map((u) => <option key={u.usina_id} value={u.usina_id}>{u.nome}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="valor">Valor de interesse (R$)</label><input id="valor" name="valor" required inputMode="decimal" /></div>
          <button className="btn btn-ghost btn-block">Sinalizar interesse</button>
        </form>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>Enviar interesse não reserva cota nem gera compromisso. A equipe entra em contato para explicar as condições.</p>
    </>
  );
}
