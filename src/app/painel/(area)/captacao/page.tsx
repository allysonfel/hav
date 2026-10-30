import Link from "next/link";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { listarUsinas, local } from "@/lib/usinas";
import { brl0, campoDecimal, kwp, pct } from "@/lib/format";
import { PillUsina, Progresso, Retorno } from "@/components/basicos";
import { confirmarInteresse, mudarInteresse, novoInteressado } from "./acoes";

type Interesse = { id: number; usina_id: number; investidor_id: number | null; nome: string; telefone: string; valor_centavos: number; origem: string; status: string; cotista: string | null };

const ERROS: Record<string, string> = {
  nome: "Informe o nome do interessado.",
  telefone: "Confira o telefone, com DDD.",
  valor: "Informe o valor.",
  usina: "Usina não está em captação.",
  interesse: "Interessado não encontrado ou já confirmado.",
  investidor: "Escolha um investidor ativo. Se ele ainda não existe, cadastre em Investidores.",
  excede: "Esse valor passaria da meta da usina.",
};
const OK: Record<string, string> = { interessado: "Interessado adicionado.", status: "Status atualizado.", confirmado: "Confirmado. A cota foi criada na usina." };
const ORIGEM: Record<string, string> = { app: "App HAV", indicacao: "Indicação", equipe: "Equipe" };
const PILL: Record<string, [string, string]> = {
  aguardando: ["pill-warn", "Aguardando contato"],
  negociacao: ["pill-ok", "Em negociação"],
  confirmado: ["pill-ok", "Confirmado"],
  desistiu: ["pill-muted", "Desistiu"],
};

export default async function Captacao({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; confirmar?: string }> }) {
  await requireUser(["admin"]);
  const sp = await searchParams;
  const usinas = (await listarUsinas()).filter((u) => u.status === "captacao");
  const ids = usinas.map((u) => u.id);
  const interesses = ids.length
    ? await sql<Interesse[]>`
        SELECT i.id, i.usina_id, i.investidor_id, i.nome, i.telefone, i.valor_centavos, i.origem, i.status,
          (SELECT string_agg(us.nome, ', ') FROM cotas c JOIN usinas us ON us.id = c.usina_id WHERE c.investidor_id = i.investidor_id AND c.ativa AND us.status = 'operando') AS cotista
        FROM interesses i WHERE i.usina_id = ANY(${ids}) ORDER BY i.status = 'desistiu', i.status = 'confirmado', i.criado_em DESC`
    : [];
  // Pedidos de ampliação de cota em usinas que já operam.
  const ampliacoes = await sql<Interesse[]>`
    SELECT i.id, i.usina_id, i.investidor_id, i.nome, i.telefone, i.valor_centavos, i.origem, i.status, u.nome AS cotista
    FROM interesses i JOIN usinas u ON u.id = i.usina_id
    WHERE u.status <> 'captacao' AND i.status IN ('aguardando', 'negociacao') ORDER BY i.criado_em DESC`;
  const confirmando = interesses.find((i) => i.id === Number(sp.confirmar));
  const investidores = confirmando ? await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM investidores WHERE ativo ORDER BY nome` : [];

  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaOk={OK} mapaErro={ERROS} />
      <div className="section-head">
        <h3>Captação</h3>
        <Link className="btn btn-primary" href="/painel/usinas/nova?status=captacao">+ Nova captação</Link>
      </div>
      {usinas.length === 0 && <div className="card vazio">Nenhuma usina em captação.</div>}

      {confirmando && (
        <form action={confirmarInteresse} className="card card-p" style={{ marginBottom: 18 }} id="confirmar">
          <input type="hidden" name="id" value={confirmando.id} />
          <div className="section-head"><h3>Confirmar {confirmando.nome} como cotista</h3><Link className="link" href="/painel/captacao">Cancelar</Link></div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="investidor">Investidor</label>
              <select id="investidor" name="investidor" required defaultValue={confirmando.investidor_id ?? ""}>
                <option value="" disabled>Escolha</option>
                {investidores.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
              <small>Ainda não tem cadastro? <Link className="link" href="/painel/investidores/novo">Cadastre primeiro</Link>.</small>
            </div>
            <div className="field"><label htmlFor="valor">Valor confirmado (R$)</label><input id="valor" name="valor" required inputMode="decimal" defaultValue={campoDecimal(confirmando.valor_centavos / 100, 2)} /></div>
          </div>
          <button className="btn btn-gold">Confirmar e criar cota</button>
        </form>
      )}

      {usinas.map((u) => {
        const ppm = Math.round((u.captado_centavos / u.investimento_centavos) * 1_000_000);
        const lista = interesses.filter((i) => i.usina_id === u.id);
        const abertos = lista.filter((i) => i.status === "aguardando" || i.status === "negociacao").length;
        return (
          <div key={u.id}>
            <div className="card" style={{ padding: 22, marginBottom: 18 }}>
              <div className="section-head" style={{ marginBottom: 4 }}>
                <div><h3 style={{ fontSize: 16 }}><Link className="row-name" href={`/painel/usinas/${u.id}`}>{u.nome}</Link></h3><span className="hint">{local(u)} · {kwp(u.capacidade_wp)}</span></div>
                <PillUsina s={u.status} />
              </div>
              <div className="linha" style={{ alignItems: "baseline", margin: "14px 0 6px" }}>
                <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>{brl0(u.captado_centavos)}</span>
                <span className="muted" style={{ fontSize: 13 }}>de {brl0(u.investimento_centavos)} ({pct(ppm)})</span>
              </div>
              <Progresso ppm={ppm} />
              <div className="metricas">
                <div><b className="num">{u.cotistas}</b><span>cotistas confirmados</span></div>
                <div><b className="num">{abertos}</b><span>interessados</span></div>
                <div><b className="num">{brl0(Math.max(0, u.investimento_centavos - u.captado_centavos))}</b><span>restante para a meta</span></div>
              </div>
            </div>
            <div className="card card-t">
              <div className="section-head dentro"><h3>Interessados</h3><span className="hint">{u.nome}</span></div>
              <div className="tbl-wrap">
                <table className="dt">
                  <thead><tr><th>Nome</th><th>Valor de interesse</th><th>Origem</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {lista.length === 0 && <tr><td colSpan={5} className="vazio">Nenhum interessado ainda.</td></tr>}
                    {lista.map((i) => (
                      <tr key={i.id}>
                        <td className="row-name">{i.nome}</td>
                        <td className="num">{brl0(i.valor_centavos)}</td>
                        <td>{i.cotista ? `Já é cotista (${i.cotista.replace(/Usina /g, "")})` : ORIGEM[i.origem]}</td>
                        <td><span className={`pill ${PILL[i.status][0]}`}>{PILL[i.status][1]}</span></td>
                        <td className="acoes">
                          {i.status !== "confirmado" && (
                            <div className="linha">
                              {i.telefone && <a className="btn btn-ghost btn-sm" href={`tel:+55${i.telefone}`}>Ligar</a>}
                              {i.status === "aguardando" && <AcaoStatus id={i.id} status="negociacao" texto="Negociar" />}
                              {i.status === "desistiu"
                                ? <AcaoStatus id={i.id} status="aguardando" texto="Retomar" />
                                : <Link className="btn btn-gold btn-sm" href={`/painel/captacao?confirmar=${i.id}#confirmar`}>Confirmar</Link>}
                              {i.status !== "desistiu" && <AcaoStatus id={i.id} status="desistiu" texto="Desistiu" />}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form action={novoInteressado} style={{ padding: 18, borderTop: "1px solid var(--border)" }}>
                <input type="hidden" name="usina" value={u.id} />
                <div className="box-title" style={{ marginTop: 0 }}>Adicionar interessado</div>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
                  <div className="field"><label htmlFor={`n${u.id}`}>Nome</label><input id={`n${u.id}`} name="nome" required maxLength={120} /></div>
                  <div className="field"><label htmlFor={`t${u.id}`}>Telefone</label><input id={`t${u.id}`} name="telefone" inputMode="tel" maxLength={20} /></div>
                  <div className="field"><label htmlFor={`v${u.id}`}>Valor de interesse (R$)</label><input id={`v${u.id}`} name="valor" required inputMode="decimal" /></div>
                  <div className="field"><label htmlFor={`o${u.id}`}>Origem</label><select id={`o${u.id}`} name="origem"><option value="indicacao">Indicação</option><option value="equipe">Equipe</option></select></div>
                  <div className="field"><button className="btn btn-primary">Adicionar</button></div>
                </div>
              </form>
            </div>
          </div>
        );
      })}

      {ampliacoes.length > 0 && (
        <div className="card card-t">
          <div className="section-head dentro"><h3>Pedidos de ampliação de cota</h3><span className="hint">Sinalizado pelo app do investidor</span></div>
          <div className="tbl-wrap">
            <table className="dt">
              <thead><tr><th>Nome</th><th>Usina</th><th>Valor</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {ampliacoes.map((i) => (
                  <tr key={i.id}>
                    <td className="row-name">{i.nome}</td>
                    <td>{i.cotista}</td>
                    <td className="num">{brl0(i.valor_centavos)}</td>
                    <td><span className={`pill ${PILL[i.status][0]}`}>{PILL[i.status][1]}</span></td>
                    <td className="acoes">
                      <div className="linha">
                        {i.telefone && <a className="btn btn-ghost btn-sm" href={`tel:+55${i.telefone}`}>Ligar</a>}
                        {i.status === "aguardando" && <AcaoStatus id={i.id} status="negociacao" texto="Negociar" />}
                        <AcaoStatus id={i.id} status="desistiu" texto="Encerrar" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function AcaoStatus({ id, status, texto }: { id: number; status: string; texto: string }) {
  return (
    <form action={mudarInteresse}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="btn btn-ghost btn-sm">{texto}</button>
    </form>
  );
}
