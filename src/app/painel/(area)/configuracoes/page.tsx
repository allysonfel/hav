import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { EMAIL, getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { cnpjFormatado, cnpjValido } from "@/lib/cpf";
import { Retorno } from "@/components/basicos";
import { emailConfigurado } from "@/lib/email";
import { iaConfigurada } from "@/lib/ia";
import { demoAtiva } from "@/lib/demo";
import { alternarDemo } from "./acoes";

async function salvar(fd: FormData) {
  "use server";
  const u = await requireUser(["admin"]);
  const empresa = String(fd.get("empresa") ?? "").trim().slice(0, 40);
  const razaoSocial = String(fd.get("razao_social") ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const cnpjTexto = String(fd.get("cnpj") ?? "").trim();
  const cnpj = cnpjTexto ? cnpjValido(cnpjTexto) : "";
  const diaFechamento = Number(fd.get("dia"));
  let suporteWhatsapp = String(fd.get("whatsapp") ?? "").replace(/\D/g, "");
  if (suporteWhatsapp.length === 10 || suporteWhatsapp.length === 11) suporteWhatsapp = "55" + suporteWhatsapp;
  const suporteEmail = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if (empresa.length < 2 || cnpj === null) redirect("/painel/configuracoes?erro=1");
  if (!Number.isInteger(diaFechamento) || diaFechamento < 0 || diaFechamento > 28) redirect("/painel/configuracoes?erro=1");
  if (suporteWhatsapp && !/^\d{12,13}$/.test(suporteWhatsapp)) redirect("/painel/configuracoes?erro=1");
  if (suporteEmail && !EMAIL.test(suporteEmail)) redirect("/painel/configuracoes?erro=1");
  const oportunidades = fd.get("oportunidades") === "1";
  const emailRelatorio = fd.get("email_relatorio") === "1";
  const projecaoApp = fd.get("projecao_app") === "1";
  const agente = fd.get("agente") === "1";
  await saveSettings({ empresa, razaoSocial, cnpj, diaFechamento, suporteWhatsapp, suporteEmail, oportunidades, emailRelatorio, projecaoApp, agente });
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
      <Retorno ok={sp.ok} erro={sp.erro} mapaOk={{ "1": "Configurações salvas." }} mapaErro={{ "1": "Confira os dados (CNPJ, WhatsApp ou e-mail inválido)." }} />
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
          <button className={demo ? "btn btn-ghost" : "btn btn-gold"}>{demo ? "Remover dados de demonstração" : "Carregar dados de demonstração"}</button>
        </form>
      </div>
    </>
  );
}
