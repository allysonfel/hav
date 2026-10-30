import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { EMAIL, getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { cnpjFormatado, cnpjValido } from "@/lib/cpf";
import { Retorno } from "@/components/basicos";

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
  await saveSettings({ empresa, razaoSocial, cnpj, diaFechamento, suporteWhatsapp, suporteEmail });
  await audit(`usuario:${u.id}`, "configuracoes_salvas");
  redirect("/painel/configuracoes?ok=1");
}

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser(["admin"]);
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaOk={{ "1": "Configurações salvas." }} mapaErro={{ "1": "Confira os dados (CNPJ, WhatsApp ou e-mail inválido)." }} />
      <form action={salvar} className="card card-p" style={{ maxWidth: 640 }}>
        <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>Sistema</h4>
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
        <div className="field"><label>Fuso horário</label><input value="América/Recife (UTC-3)" disabled readOnly /></div>
        <button className="btn btn-primary">Salvar alterações</button>
      </form>
    </>
  );
}
