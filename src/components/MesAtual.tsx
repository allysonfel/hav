// Quadro "o que falta" do mês que deve ser lançado agora: para cada usina em
// operação, em que passo ela está (lançar, fechar, pagar) e o botão do próximo
// passo. É o trabalho mensal da equipe num lugar só.
import Link from "next/link";
import { sql } from "@/lib/db";
import { competenciaEsperada, dataBr, mesLongo } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { atrasado, previsaoRepasse } from "@/lib/acompanhamento";

type Linha = { usina_id: number; nome: string; fech_id: number | null; status: string | null; fechado_em: Date | null; pendentes: number };

export async function MesAtual({ admin }: { admin: boolean }) {
  const s = await getSettings();
  const comp = competenciaEsperada(s.diaFechamento);
  const linhas = await sql<Linha[]>`
    SELECT u.id AS usina_id, u.nome, f.id AS fech_id, f.status, f.fechado_em,
      coalesce((SELECT count(*)::int FROM rateios r WHERE r.fechamento_id = f.id AND r.repasse_status = 'pendente'), 0) AS pendentes
    FROM usinas u
    LEFT JOIN fechamentos f ON f.usina_id = u.id AND f.competencia = ${comp + "-01"}::date
    WHERE u.status = 'operando' ORDER BY u.nome`;
  if (!linhas.length) return null;
  const passo = (l: Linha) => (!l.fech_id ? 1 : l.status === "rascunho" ? 2 : l.pendentes ? 3 : 4);
  const prontas = linhas.filter((l) => passo(l) === 4).length;
  const nomeMes = mesLongo(comp).split(" ")[0];

  return (
    <div className="card card-p mes-atual">
      <div className="ttl" style={{ marginBottom: 10 }}>
        <div>
          <h3>{`Mês de ${nomeMes}: ${prontas === linhas.length ? "tudo certo" : "o que falta"}`}</h3>
          <small>Lançar a geração, fechar o rateio e pagar os repasses de cada usina</small>
        </div>
        <span className={`pill ${prontas === linhas.length ? "pill-ok" : "pill-muted"}`}>{prontas} de {linhas.length} {linhas.length === 1 ? "usina concluída" : "usinas concluídas"}</span>
      </div>
      <div className="mes-lista">
        {linhas.map((l) => {
          const p = passo(l);
          const prevista = previsaoRepasse(l.fechado_em, s.prazoRepasse);
          const atraso = p === 3 && atrasado(prevista, "pendente");
          return (
            <div key={l.usina_id} className="mes-item">
              <div className="mes-passos" aria-label={`Passo ${Math.min(p, 3)} de 3`}>
                {[1, 2, 3].map((n) => <i key={n} className={n < p ? "feito" : n === p ? "agora" : ""} />)}
              </div>
              <div className="mes-nome">
                <b>{l.nome}</b>
                <span>
                  {p === 1 && "Falta lançar a geração e a receita"}
                  {p === 2 && (admin ? "Lançado. Falta conferir e fechar o mês" : "Lançado. Aguardando o administrador fechar")}
                  {p === 3 && `${l.pendentes} ${l.pendentes === 1 ? "repasse pendente" : "repasses pendentes"}${prevista ? ` · previsto até ${dataBr(prevista)}` : ""}`}
                  {p === 4 && "Fechado e todos os repasses pagos"}
                </span>
              </div>
              {atraso && <span className="pill pill-sm pill-atraso">Atrasado</span>}
              {p === 1 && <Link className="btn btn-gold btn-sm" href={`/painel/usinas/${l.usina_id}/lancar?comp=${comp}`}>Lançar</Link>}
              {p === 2 && admin && <Link className="btn btn-primary btn-sm" href={`/painel/fechamentos/${l.fech_id}`}>Conferir e fechar</Link>}
              {p === 2 && !admin && <Link className="btn btn-ghost btn-sm" href={`/painel/fechamentos/${l.fech_id}`}>Ver</Link>}
              {p === 3 && admin && <Link className="btn btn-primary btn-sm" href={`/painel/fechamentos/${l.fech_id}`}>Pagar repasses</Link>}
              {p === 3 && !admin && <Link className="btn btn-ghost btn-sm" href={`/painel/fechamentos/${l.fech_id}`}>Ver</Link>}
              {p === 4 && <Link className="btn btn-ghost btn-sm" href={`/painel/fechamentos/${l.fech_id}`}>Ver</Link>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
