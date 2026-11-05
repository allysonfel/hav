import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { EMAIL, getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { cnpjFormatado, cnpjValido } from "@/lib/cpf";
import { campoDecimal, periodoTexto, ppmDe } from "@/lib/format";
import { Retorno } from "@/components/basicos";
import { emailConfigurado } from "@/lib/email";
import { iaConfigurada } from "@/lib/ia";
import { solisConfigurada } from "@/lib/monitoramento/solis";
import { demoAtiva } from "@/lib/demo";
import { alternarDemo } from "./acoes";
import { Confirmar } from "@/components/Confirmar";

async function salvar(fd: FormData) {
  "use server";
  const u = await requireUser(["admin"]);
  const empresa = String(fd.get("empresa") ?? "").trim().slice(0, 40);
  const razaoSocial = String(fd.get("razao_social") ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const cnpjTexto = String(fd.get("cnpj") ?? "").trim();
  const cnpj = cnpjTexto ? cnpjValido(cnpjTexto) : "";
  const diaFechamento = Number(fd.get("dia"));
  const prazoRepasse = Number(fd.get("prazo"));
  let suporteWhatsapp = String(fd.get("whatsapp") ?? "").replace(/\D/g, "");
  if (suporteWhatsapp.length === 10 || suporteWhatsapp.length === 11) suporteWhatsapp = "55" + suporteWhatsapp;
  const suporteEmail = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if (empresa.length < 2 || cnpj === null) redirect("/painel/configuracoes?erro=1");
  if (!Number.isInteger(diaFechamento) || diaFechamento < 0 || diaFechamento > 28) redirect("/painel/configuracoes?erro=1");
  if (!Number.isInteger(prazoRepasse) || prazoRepasse < 1 || prazoRepasse > 60) redirect("/painel/configuracoes?erro=1");
  if (suporteWhatsapp && !/^\d{12,13}$/.test(suporteWhatsapp)) redirect("/painel/configuracoes?erro=1");
  if (suporteEmail && !EMAIL.test(suporteEmail)) redirect("/painel/configuracoes?erro=1");
  const oportunidades = fd.get("oportunidades") === "1";
  const emailRelatorio = fd.get("email_relatorio") === "1";
  const projecaoApp = fd.get("projecao_app") === "1";
  const agente = fd.get("agente") === "1";
  const inicioPeriodo = Number(fd.get("inicio_periodo"));
  if (!Number.isInteger(inicioPeriodo) || inicioPeriodo < 1 || inicioPeriodo > 28) redirect("/painel/configuracoes?erro=1");
  const taxaDe = (campo: string) => {
    const n = ppmDe(fd.get(campo));
    return n !== null && n <= 200_000 ? n : null;
  };
  const cdiPeriodo = taxaDe("cdi"), fiiPeriodo = taxaDe("fii"), poupancaPeriodo = taxaDe("poupanca");
  if (cdiPeriodo === null || fiiPeriodo === null || poupancaPeriodo === null) redirect("/painel/configuracoes?erro=1");
  const responsavel = String(fd.get("responsavel") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const responsavelCargo = String(fd.get("responsavel_cargo") ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const linha = (campo: string, max: number) => String(fd.get(campo) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const slogan = linha("slogan", 120), endereco = linha("endereco", 160), cidade = linha("cidade", 60);
  let instagram = linha("instagram", 40);
  if (instagram && !instagram.startsWith("@")) instagram = "@" + instagram;
  if (instagram && !/^@[\w.]{1,39}$/.test(instagram)) redirect("/painel/configuracoes?erro=1");
  await saveSettings({ slogan, endereco, instagram, cidade, responsavel, responsavelCargo, empresa, razaoSocial, cnpj, diaFechamento, prazoRepasse, suporteWhatsapp, suporteEmail, oportunidades, emailRelatorio, projecaoApp, agente, inicioPeriodo, cdiPeriodo, fiiPeriodo, poupancaPeriodo });
  const lig = (b: boolean) => (b ? "ligada" : "desligada");
  await audit(`usuario:${u.id}`, "configuracoes_salvas", null, null,
    `oportunidades ${lig(oportunidades)}; email ${lig(emailRelatorio)}; projecao no app ${lig(projecaoApp)}; agente ${lig(agente)}`);
  redirect("/painel/configuracoes?ok=1");
}

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; demo?: string; demo_erro?: string }> }) {
  await requireUser(["admin"]);
  const sp = await searchParams;
  const s = await getSettings();
  const demo = await demoAtiva();
  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaOk={{ "1": "Configurações salvas." }} mapaErro={{ "1": "Confira os dados (CNPJ, WhatsApp, e-mail, prazo ou taxas do comparativo inválidos)." }} />
      <form action={salvar} className="card card-p" style={{ maxWidth: 640 }}>
        <h4 style={{ margin: "0 0 14px" }}>Sistema</h4>
        <div className="field"><label htmlFor="empresa">Nome da empresa</label><input id="empresa" name="empresa" defaultValue={s.empresa} required maxLength={40} /></div>
        <div className="field"><label htmlFor="razao_social">Razão social</label><input id="razao_social" name="razao_social" defaultValue={s.razaoSocial} maxLength={100} /></div>
        <div className="field"><label htmlFor="cnpj">CNPJ</label><input id="cnpj" name="cnpj" defaultValue={s.cnpj ? cnpjFormatado(s.cnpj) : ""} maxLength={18} inputMode="numeric" placeholder="00.000.000/0000-00" /></div>
        <div className="field">
          <label htmlFor="dia">Dia de fechamento do rateio</label>
          <select id="dia" name="dia" defaultValue={s.diaFechamento}>
            <option value={0}>Último dia útil do mês</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d} do mês seguinte</option>)}
          </select>
          <small>Define quando o sino começa a cobrar o lançamento do mês.</small>
        </div>
        <div className="field">
          <label htmlFor="inicio_periodo">Período de apuração da geração</label>
          <select id="inicio_periodo" name="inicio_periodo" defaultValue={s.inicioPeriodo}>
            <option value={1}>Do dia 1 ao último dia do mês</option>
            {Array.from({ length: 27 }, (_, i) => i + 2).map((d) => <option key={d} value={d}>Do dia {d} ao dia {d - 1} do mês seguinte</option>)}
          </select>
          <small>Exemplo com a configuração atual: o mês de setembro de 2026 vai de {periodoTexto("2026-09", s.inicioPeriodo)}. Aparece no lançamento, nos relatórios e no app.</small>
        </div>
        <div className="field">
          <label htmlFor="prazo">Prazo para pagar os repasses</label>
          <select id="prazo" name="prazo" defaultValue={s.prazoRepasse}>
            {[3, 5, 7, 10, 15, 20, 30, 45, 60].concat([s.prazoRepasse]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((d) => <option key={d} value={d}>Até {d} dias depois de fechar o mês</option>)}
          </select>
          <small>O investidor vê no app a data prevista do repasse. Passou do prazo, o repasse aparece como atrasado para a equipe.</small>
        </div>
        <div className="field"><label htmlFor="whatsapp">WhatsApp de atendimento ao investidor</label><input id="whatsapp" name="whatsapp" defaultValue={s.suporteWhatsapp} maxLength={18} inputMode="tel" /></div>
        <div className="field"><label htmlFor="email">E-mail de atendimento ao investidor</label><input id="email" name="email" type="email" defaultValue={s.suporteEmail} maxLength={160} /></div>
        <div className="box-title">App do investidor</div>
        <label className="linha sm" style={{ marginBottom: 6, flexWrap: "nowrap" }}>
          <input type="checkbox" id="oportunidades" name="oportunidades" value="1" defaultChecked={s.oportunidades} />
          <b>Mostrar Oportunidades no app</b>
        </label>
        <p className="muted sm" style={{ margin: "0 0 14px" }}>Desligado, os investidores não veem usinas em captação nem o botão Quero investir. Ligue só depois da orientação do advogado sobre oferta de cotas.</p>
        <label className="linha sm" style={{ marginBottom: 6, flexWrap: "nowrap" }}>
          <input type="checkbox" name="projecao_app" value="1" defaultChecked={s.projecaoApp} />
          <b>Mostrar a projeção dos próximos meses no app</b>
        </label>
        <p className="muted sm" style={{ margin: "0 0 14px" }}>No painel a projeção aparece sempre. No app, o investidor veria uma estimativa da própria receita: vale passar pelo advogado junto com Oportunidades, para não parecer promessa de rendimento.</p>

        <div className="box-title">Plus</div>
        <label className="linha sm" style={{ marginBottom: 6, flexWrap: "nowrap" }}>
          <input type="checkbox" name="email_relatorio" value="1" defaultChecked={s.emailRelatorio} />
          <b>Enviar o relatório mensal por e-mail ao fechar o mês</b>
        </label>
        <p className="muted sm" style={{ margin: "0 0 14px" }}>Cada cotista recebe o próprio relatório em PDF. O investidor pode desligar no app, em Perfil, Notificações.{emailConfigurado() ? "" : " Atenção: o envio de e-mail ainda não está configurado no servidor."}</p>
        <label className="linha sm" style={{ marginBottom: 6, flexWrap: "nowrap" }}>
          <input type="checkbox" name="agente" value="1" defaultChecked={s.agente} />
          <b>Agente de IA no painel e no app</b>
        </label>
        <p className="muted sm" style={{ margin: "0 0 14px" }}>Responde dúvidas com os dados do sistema, respeitando o que cada perfil pode ver.{iaConfigurada() ? "" : " Atenção: a chave de IA ainda não está configurada no servidor."}</p>
        <div className="box-title">Comparativo do relatório do investidor</div>
        <p className="muted sm" style={{ margin: "0 0 10px" }}>Quanto cada aplicação rende num período de apuração, em %. O relatório mostra quanto o mesmo valor investido teria rendido em cada uma. Atualize quando as taxas mudarem.</p>
        <div className="form-grid">
          <div className="field"><label htmlFor="cdi">CDI / CDB 100% CDI (% no período)</label><input id="cdi" name="cdi" defaultValue={campoDecimal(s.cdiPeriodo / 10_000, 4)} required inputMode="decimal" /></div>
          <div className="field"><label htmlFor="fii">Fundos imobiliários, média (% no período)</label><input id="fii" name="fii" defaultValue={campoDecimal(s.fiiPeriodo / 10_000, 4)} required inputMode="decimal" /></div>
          <div className="field"><label htmlFor="poupanca">Poupança (% no período)</label><input id="poupanca" name="poupanca" defaultValue={campoDecimal(s.poupancaPeriodo / 10_000, 4)} required inputMode="decimal" /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="responsavel">Responsável pelo relatório (nome)</label><input id="responsavel" name="responsavel" defaultValue={s.responsavel} maxLength={80} /></div>
          <div className="field"><label htmlFor="responsavel_cargo">Cargo</label><input id="responsavel_cargo" name="responsavel_cargo" defaultValue={s.responsavelCargo} maxLength={60} placeholder="Diretor" /><small>Sai no fim do relatório do investidor, com local e data de emissão.</small></div>
        </div>
        <div className="box-title">Rodapé dos relatórios em PDF</div>
        <p className="muted sm" style={{ margin: "0 0 10px" }}>Sai no pé de todas as páginas, como no relatório que a HAV fazia: nome da empresa, slogan, sede, CNPJ, WhatsApp e e-mail de atendimento (acima) e Instagram.</p>
        <div className="field"><label htmlFor="slogan">Slogan</label><input id="slogan" name="slogan" defaultValue={s.slogan} maxLength={120} /></div>
        <div className="field"><label htmlFor="endereco">Sede</label><input id="endereco" name="endereco" defaultValue={s.endereco} maxLength={160} /></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="instagram">Instagram</label><input id="instagram" name="instagram" defaultValue={s.instagram} maxLength={40} placeholder="@havenergia" /></div>
          <div className="field"><label htmlFor="cidade">Cidade da emissão</label><input id="cidade" name="cidade" defaultValue={s.cidade} maxLength={60} /><small>No fecho: &quot;{s.cidade || "Cidade"}, 28 de setembro de 2026.&quot;</small></div>
        </div>
        <div className="box-title">Integração com o monitoramento</div>
        <p className="muted sm" style={{ margin: "0 0 14px" }}>
          Solis (SolisCloud): {solisConfigurada() ? <b>chave configurada no servidor.</b> : <b>chave ainda não configurada no servidor.</b>} Cada usina é ligada em Usinas, Editar, Integração com o monitoramento. A geração de cada dia é atualizada a cada 30 minutos de uso.
        </p>
        <div className="field"><label>Fuso horário</label><input value="América/Recife (UTC-3)" disabled readOnly /></div>
        <button className="btn btn-primary">Salvar alterações</button>
      </form>

      <div className="card card-p" style={{ maxWidth: 640, marginTop: 16 }} id="demonstracao">
        <div className="linha" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>Dados de demonstração</h4>
          {demo ? <span className="pill pill-warn">Ativos</span> : <span className="pill pill-muted">Desligados</span>}
        </div>
        {sp.demo && <div className="aviso ok">{sp.demo === "ligada" ? "Dados de demonstração carregados." : "Dados de demonstração removidos."}</div>}
        {sp.demo_erro && <div className="aviso erro">{sp.demo_erro}</div>}
        <p className="muted sm" style={{ margin: "0 0 14px" }}>
          Preenche o sistema com 3 usinas, 10 investidores, 24 meses fechados com rateio e a captação da Serra Clara, para apresentar o painel em uso.
          Os investidores fictícios não têm acesso ao app e nunca recebem e-mail. Ao desligar, sai só o que a demonstração criou; os cadastros reais ficam.
        </p>
        <form action={alternarDemo}>
          <input type="hidden" name="acao" value={demo ? "desligar" : "ligar"} />
          <Confirmar className={demo ? "btn btn-ghost" : "btn btn-gold"} ativo={demo} titulo="Remover os dados de demonstração?" texto="Sai tudo o que a demonstração criou (usinas, investidores e meses fictícios). Os cadastros reais ficam." confirmar="Remover dados" perigo={false}>{demo ? "Remover dados de demonstração" : "Carregar dados de demonstração"}</Confirmar>
        </form>
      </div>
    </>
  );
}
