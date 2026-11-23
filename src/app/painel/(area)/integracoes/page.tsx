import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Retorno } from "@/components/basicos";
import { Confirmar } from "@/components/Confirmar";
import { TZ } from "@/lib/format";
import { PLATAFORMAS, TIPOS_LISTA, salvasParaTela, situacoes, type Tipo } from "@/lib/monitoramento/credenciais";
import { usinasDaPlataforma } from "@/lib/monitoramento";
import { ligarUsina, removerIntegracao, salvarIntegracao } from "./acoes";

const ERROS: Record<string, string> = {
  campos: "Preencha todos os campos obrigatórios da plataforma.",
  url: "O endereço da API precisa começar com https://.",
  org: "O ID da empresa tem só números.",
  teste: "As credenciais foram salvas, mas a plataforma recusou a conexão. O motivo aparece no quadro da plataforma.",
};
const OK: Record<string, string> = {
  testada: "Conectado. As usinas da conta aparecem abaixo para ligar às usinas da HAV.",
  removida: "Integração removida. As usinas ligadas a ela param de atualizar até uma nova chave.",
  ligada: "Usina ligada. A geração de cada dia já foi buscada.",
  desligada: "Usina desligada da integração.",
};

const quando = (d: Date) => new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });

export default async function Integracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; t?: string }> }) {
  await requireUser(["admin"]);
  const sp = await searchParams;
  const sit = await situacoes();
  const usinasHav = await sql<{ id: number; nome: string; monitoramento_tipo: string; monitoramento_id: string; monitoramento_erro: string }[]>`
    SELECT id, nome, monitoramento_tipo, monitoramento_id, monitoramento_erro FROM usinas WHERE status <> 'captacao' ORDER BY nome`;
  const dados = await Promise.all(TIPOS_LISTA.map(async (t) => ({ t, tela: await salvasParaTela(t), conta: await usinasDaPlataforma(t) })));
  const integradas = usinasHav.filter((u) => u.monitoramento_tipo).length;
  const nomeTipo = (t: string) => PLATAFORMAS[t as Tipo]?.nome ?? t;

  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaOk={OK} mapaErro={ERROS} />
      <div className="card card-p" style={{ maxWidth: 820, marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 6px" }}>Plataformas de monitoramento</h4>
        <p className="muted sm" style={{ margin: 0 }}>
          Cada fabricante de inversor tem a própria plataforma. Com a chave de acesso de cada uma cadastrada aqui, a geração de cada dia entra sozinha:
          o investidor acompanha no app quanto vai receber e o lançamento do mês já vem preenchido. As chaves ficam guardadas criptografadas.
        </p>
        <p className="sm" style={{ margin: "10px 0 0" }}><b>{integradas}</b> de <b>{usinasHav.length}</b> usinas da HAV recebem a geração automaticamente.</p>
      </div>

      {dados.map(({ t, tela, conta }) => {
        const p = PLATAFORMAS[t];
        const s = sit[t];
        const ativa = tela.salvo || tela.doAmbiente;
        const falhou = ativa && (s?.teste_ok === false || !!conta.erro);
        const pill = !ativa ? ["pill-muted", "Sem chave"] : falhou ? ["pill-danger", "Falhou"] : ["pill-ok", "Conectada"];
        const ligadas = usinasHav.filter((u) => u.monitoramento_tipo === t);
        return (
          <div key={t} id={t} className="card card-p" style={{ maxWidth: 820, marginBottom: 16, scrollMarginTop: 80 }}>
            <div className="linha" style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <h4 style={{ margin: 0 }}>{p.nome}</h4>
              <span className={`pill ${pill[0]}`}>{pill[1]}</span>
            </div>
            <p className="muted sm" style={{ margin: "0 0 12px" }}>{p.marcas}</p>

            {ativa && (conta.erro || s?.teste_ok === false) && <div className="aviso erro">{conta.erro ?? s?.teste_msg}</div>}
            {ativa && !conta.erro && s?.testado_em && <p className="muted sm" style={{ margin: "0 0 12px" }}>Último teste em {quando(s.testado_em)}: {s.teste_msg}.</p>}
            {tela.doAmbiente && <p className="muted sm" style={{ margin: "0 0 12px" }}>A chave atual está nas variáveis do servidor. Salvar aqui passa a usar a do painel.</p>}

            {!ativa && (
              <>
                <div className="box-title">Como conseguir a chave</div>
                <ol className="sm" style={{ margin: "0 0 14px", paddingLeft: 20 }}>{p.comoPegar.map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ol>
              </>
            )}

            <details open={!ativa || falhou || (sp.t === t && !!sp.erro)}>
              <summary className="sm" style={{ cursor: "pointer", marginBottom: 10 }}><b>{ativa ? "Trocar a chave de acesso" : "Cadastrar a chave de acesso"}</b></summary>
              <form action={salvarIntegracao}>
                <input type="hidden" name="tipo" value={t} />
                <div className="form-grid">
                  {p.campos.map((f) => (
                    <div className="field" key={f.k}>
                      <label htmlFor={`${t}-${f.k}`}>{f.rotulo}{f.opcional ? " (opcional)" : ""}</label>
                      <input
                        id={`${t}-${f.k}`} name={f.k} maxLength={400} autoComplete="off"
                        type={f.secreto ? "password" : "text"}
                        defaultValue={f.secreto ? "" : tela.valores[f.k]}
                        placeholder={f.secreto && tela.secretosGuardados.includes(f.k) ? "Guardada. Em branco, mantém." : f.padrao ?? ""}
                        required={!f.opcional && !(f.secreto && tela.secretosGuardados.includes(f.k))}
                      />
                      {f.dica && <small>{f.dica}</small>}
                    </div>
                  ))}
                </div>
                <div className="linha" style={{ gap: 8 }}>
                  <button className="btn btn-primary">Salvar e testar conexão</button>
                </div>
              </form>
            </details>
            {tela.salvo && (
              <form action={removerIntegracao} style={{ marginTop: 10 }}>
                <input type="hidden" name="tipo" value={t} />
                <Confirmar className="btn btn-ghost btn-sm" titulo={`Remover a integração com a ${p.nome}?`} confirmar="Remover"
                  texto={<>A chave é apagada do sistema. {ligadas.length ? `${ligadas.length} usina(s) ligada(s) param de atualizar até uma nova chave; a geração já recebida continua.` : ""}</>}>
                  Remover integração
                </Confirmar>
              </form>
            )}

            {ativa && !conta.erro && (
              <>
                <div className="box-title" style={{ marginTop: 16 }}>Usinas da conta ({conta.usinas.length})</div>
                <p className="muted sm" style={{ margin: "0 0 10px" }}>Escolha a usina da HAV que corresponde a cada uma. Ligada, a geração de cada dia começa a entrar na hora.</p>
                {conta.usinas.length === 0 && <p className="muted sm">Nenhuma usina nesta conta.</p>}
                {conta.usinas.map((pu) => {
                  const atual = usinasHav.find((u) => u.monitoramento_tipo === t && u.monitoramento_id === pu.id);
                  return (
                    <div key={pu.id} style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                      <div style={{ minWidth: 180, flex: "1 1 200px" }}>
                        <b>{pu.nome}</b>
                        <div className="muted sm">ID {pu.id}{atual ? " · ligada" : ""}</div>
                        {atual?.monitoramento_erro && <div className="sm" style={{ color: "var(--danger, #c0392b)" }}>{atual.monitoramento_erro}</div>}
                      </div>
                      <form action={ligarUsina} style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 300px" }}>
                        <input type="hidden" name="tipo" value={t} />
                        <input type="hidden" name="id_plataforma" value={pu.id} />
                        <div className="field" style={{ margin: 0, flex: 1, minWidth: 0 }}>
                          <select name="usina" defaultValue={atual?.id ?? 0} aria-label={`Usina da HAV para ${pu.nome}`}>
                            <option value={0}>Não ligada</option>
                            {usinasHav.map((u) => (
                              <option key={u.id} value={u.id}>{u.nome}{u.monitoramento_tipo && u.id !== atual?.id ? ` (hoje: ${nomeTipo(u.monitoramento_tipo)})` : ""}</option>
                            ))}
                          </select>
                        </div>
                        <button className="btn btn-sm btn-ghost">Salvar</button>
                      </form>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
