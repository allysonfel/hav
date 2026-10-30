import { requireInvestidor } from "@/lib/investidor";
import { getSettings } from "@/lib/settings";

const FAQ: [string, string][] = [
  ["Como minha receita é calculada?", "A equipe lança a geração e a receita de cada usina no mês. Ao fechar o mês, você recebe a parte proporcional à sua cota."],
  ["Quando vejo o mês novo?", "Depois que a equipe fechar o mês. Antes disso os números ainda podem mudar e não aparecem aqui."],
  ["O que quer dizer repasse pendente?", "O valor já foi calculado, mas o pagamento ainda não foi registrado pela equipe."],
  ["Onde informo minha chave Pix?", "Em Perfil, Dados bancários para repasse. A troca pede a sua senha."],
];

export default async function Ajuda() {
  await requireInvestidor();
  const s = await getSettings();
  return (
    <>
      <div className="hello"><h2 style={{ fontSize: 17 }}>Central de ajuda</h2></div>
      <div className="card" style={{ padding: "4px 16px", marginBottom: 14 }}>
        {FAQ.map(([p, r]) => <details key={p} className="faq"><summary>{p}</summary><p>{r}</p></details>)}
      </div>
      <div className="card card-p" id="falar">
        <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Falar com a {s.empresa}</h4>
        {s.suporteWhatsapp && <a className="btn btn-gold btn-block" style={{ marginBottom: 8 }} href={`https://wa.me/${s.suporteWhatsapp}`}>Chamar no WhatsApp</a>}
        {s.suporteEmail && <a className="btn btn-ghost btn-block" href={`mailto:${s.suporteEmail}`}>{s.suporteEmail}</a>}
        {!s.suporteWhatsapp && !s.suporteEmail && <p className="muted sm" style={{ margin: 0 }}>Fale com seu contato na equipe.</p>}
      </div>
    </>
  );
}
