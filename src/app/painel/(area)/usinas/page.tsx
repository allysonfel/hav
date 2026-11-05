import Link from "next/link";
import { requireUser, eAdmin } from "@/lib/session";
import { listarUsinas, local } from "@/lib/usinas";
import { brlCurto, kwh, kwp, mesAno, pct } from "@/lib/format";
import { relacaoEsperado, situacaoEsperado } from "@/lib/acompanhamento";
import { PillUsina, Retorno } from "@/components/basicos";

export default async function Usinas({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const u = await requireUser();
  const { ok } = await searchParams;
  const admin = eAdmin(u);
  const usinas = await listarUsinas();
  return (
    <>
      <Retorno ok={ok} mapaOk={{ excluida: "Usina excluída." }} mapaErro={{}} />
      <div className="section-head">
        <h3>Usinas</h3>
        {admin && <Link className="btn btn-primary" href="/painel/usinas/nova">+ Nova usina</Link>}
      </div>
      {usinas.length === 0 && <div className="card vazio">Nenhuma usina cadastrada.</div>}
      <div className="plant-grid">
        {usinas.map((x) => {
          const captacao = x.status === "captacao";
          return (
            <Link key={x.id} className="card plant-card" href={`/painel/usinas/${x.id}`}>
              <div className="top">
                <div><h4>{x.nome}</h4><div className="loc">{local(x)}</div></div>
                <PillUsina s={x.status} />
              </div>
              <div className="plant-mini">
                <div><b className="num">{kwp(x.capacidade_wp)}</b><span>Capacidade</span></div>
                <div><b className="num">{x.cotistas}</b><span>Cotistas</span></div>
                {/* Operador não vê valores de captação. */}
                {(admin || !captacao) && (
                  <div>
                    <b className="num">{captacao ? pct(Math.round((x.captado_centavos / x.investimento_centavos) * 1_000_000)) : brlCurto(x.investimento_centavos)}</b>
                    <span>{captacao ? "Captado" : "Investimento"}</span>
                  </div>
                )}
              </div>
              {x.comp && x.geracao_wh !== null && (() => {
                const sit = situacaoEsperado(relacaoEsperado(x.geracao_wh, x.geracao_esperada_wh));
                return (
                  <div className="plant-ultimo">
                    <span>{mesAno(x.comp)}: <b className="num">{kwh(x.geracao_wh)}</b></span>
                    {sit && <span className={`pill pill-sm ${sit.classe}`}>{sit.texto}</span>}
                  </div>
                );
              })()}
            </Link>
          );
        })}
      </div>
    </>
  );
}
