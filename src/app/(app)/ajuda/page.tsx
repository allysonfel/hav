import { requireInvestidor } from "@/lib/investidor";
import { getSettings } from "@/lib/settings";

const FAQ: [string, string][] = [
  ["Como minha receita é calculada?", "A equipe lança a geração e a receita de cada usina no mês. Ao fechar o mês, você recebe a parte proporcional à sua cota."],
  ["Quando vejo o mês novo?", "Depois que a equipe fechar o mês. Antes disso os números ainda podem mudar e não aparecem aqui."],
  ["O que quer dizer repasse pendente?", "O valor já foi calculado, mas o pagamento ainda não foi registrado pela equipe. No Início e em Relatórios aparece a data prevista do repasse."],
  ["Onde vejo o comprovante do Pix?", "Em Relatórios. Quando a equipe anexa o comprovante, aparece \"ver comprovante\" ao lado de \"Repasse pago\"."],
  ["O que é \"% do valor investido\"?", "É quanto a receita do mês representa sobre o que você investiu. Em \"Seu retorno até agora\" você vê quanto já recebeu no total e quanto do valor investido já voltou. São números dos meses já fechados, não uma promessa de rendimento."],
  ["O que é \"% do esperado\"?", "Cada usina tem uma geração esperada por mês, do projeto. O número mostra quanto ela gerou em relação a isso. Abaixo de 85% aparece em amarelo: pode ser chuva, nuvens ou manutenção, e a equipe acompanha."],
  ["Onde informo minha chave Pix ou conta bancária?", "Em Perfil, Dados bancários para repasse. A troca pede a sua senha. Os dados aparecem no seu relatório mensal, em Dados para o pagamento."],
  ["Qual período cada relatório cobre?", "O período de apuração da HAV: do dia 21 de um mês ao dia 20 do seguinte. O relatório de setembro, por exemplo, vai de 21/08 a 20/09. A data aparece em Relatórios e no PDF."],
  ["Consigo ver a geração em tempo real?", "Sim, nas usinas ligadas ao app de monitoramento: no Início aparece o período em andamento, com a geração de cada dia, quanto você já gerou e já rendeu e uma estimativa para o fim do período. Os dados são atualizados a cada 30 minutos. O valor oficial é o do relatório, quando a HAV fecha o período."],
  ["Como é calculada a minha receita?", "Geração da usina no período x o valor pago por kWh daquela usina. Você recebe a parte da sua cota. No PDF aparecem a tarifa, a sua energia e o retorno sobre o seu aporte."],
  ["Como baixo o relatório em PDF?", "Em Relatórios, toque em PDF no mês que quiser. A planilha continua disponível ao lado."],
  ["Recebo o relatório por e-mail?", "Sim, quando a equipe fecha o mês, o PDF chega no seu e-mail cadastrado. Para ligar ou desligar, vá em Perfil, Notificações."],
  ["O que é o agente?", "É o botão dourado no canto da tela. Ele responde dúvidas sobre suas usinas, sua receita, seus repasses e o uso do app, com os seus dados. As respostas são geradas por IA: confira os valores nas telas."],
];

export default async function Ajuda() {
  await requireInvestidor();
  const s = await getSettings();
  return (
    <>
      <div className="hello"><h2>Central de ajuda</h2></div>
      <div className="card" style={{ padding: "4px 16px", marginBottom: 14 }}>
        {FAQ.map(([p, r]) => <details key={p} className="faq"><summary>{p}</summary><p>{r}</p></details>)}
      </div>
      <div className="card card-p" id="falar">
        <h4 style={{ margin: "0 0 10px" }}>Falar com a {s.empresa}</h4>
        {s.suporteWhatsapp && <a className="btn btn-gold btn-block" style={{ marginBottom: 8 }} href={`https://wa.me/${s.suporteWhatsapp}`}>Chamar no WhatsApp</a>}
        {s.suporteEmail && <a className="btn btn-ghost btn-block" href={`mailto:${s.suporteEmail}`}>{s.suporteEmail}</a>}
        {!s.suporteWhatsapp && !s.suporteEmail && <p className="muted sm" style={{ margin: 0 }}>Fale com seu contato na equipe.</p>}
      </div>
    </>
  );
}
