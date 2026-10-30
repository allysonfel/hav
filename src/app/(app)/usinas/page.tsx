import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { minhasUsinas } from "@/lib/app";
import { getSettings } from "@/lib/settings";
import { brl0, kwp, mesAno, pct } from "@/lib/format";
import { local } from "@/lib/usinas";

export default async function MinhasUsinas() {
  const i = await requireInvestidor();
  const usinas = await minhasUsinas(i.id);
  const s = await getSettings();
  return (
    <>
      <div className="hello"><h2 style={{ fontSize: 17 }}>Minhas usinas</h2></div>
      {usinas.length === 0 && <div className="card card-p vazio">Nenhuma cota registrada ainda.</div>}
      {usinas.map((u) => (
        <div key={u.usina_id} className="card mini-card">
          <div className="row-top">
            <div>
              <h4>{u.nome}</h4>
              <div className="loc">{local(u)}{u.status === "captacao" ? " · Em captação" : u.desde ? ` · Operando desde ${mesAno(u.desde)}` : ""}</div>
            </div>
            <span className="quota-chip">{pct(u.cota_ppm)} cota</span>
          </div>
          <div className="mini-dados" style={{ marginBottom: s.oportunidades ? 10 : 0 }}>
            <span><b className="num">{brl0(u.valor_centavos)}</b> investido</span>
            <span><b className="num">{kwp(u.capacidade_wp)}</b> capacidade total</span>
          </div>
          {s.oportunidades && <Link className="btn btn-ghost btn-block" href="/oportunidades">Investir mais nesta usina</Link>}
        </div>
      ))}
    </>
  );
}
