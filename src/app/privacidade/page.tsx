import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { cnpjFormatado } from "@/lib/cpf";

// TEXTO A REVISAR COM A HAV ENERGIA antes da entrega.
// Dinâmica: o texto usa nome, razão social e CNPJ de Configurações (não pode congelar no build).
export const dynamic = "force-dynamic";

export default async function Privacidade() {
  const s = await getSettings();
  const empresa = s.razaoSocial || s.empresa;
  return (
    <div className="app-texto">
      <h1>Aviso de privacidade</h1>
      <p>Este aviso explica como {empresa}{s.cnpj ? ` (CNPJ ${cnpjFormatado(s.cnpj)})` : ""} trata os dados pessoais de quem usa o app do investidor.</p>
      <h2>Quais dados usamos</h2>
      <p>Nome, e-mail, celular, CPF ou CNPJ, chave Pix, suas cotas, valores investidos, receitas e repasses, além de data e hora de acesso.</p>
      <h2>Para quê</h2>
      <p>Para calcular sua receita proporcional, registrar repasses, emitir relatórios, falar com você e proteger sua conta.</p>
      <h2>Com quem compartilhamos</h2>
      <p>Usamos fornecedores para operar o app: a hospedagem do sistema e do banco de dados, o envio de e-mails (o relatório mensal em PDF e os links de acesso) e, quando você usa o agente de IA, o provedor de IA, que recebe a sua pergunta e os números das suas cotas, sem CPF, CNPJ ou chave Pix, só para gerar a resposta. Esses fornecedores podem ficar fora do Brasil. Nada da conversa com o agente fica guardado no sistema.</p>
      <h2>Como protegemos</h2>
      <p>CPF, CNPJ e chave Pix ficam criptografados. Sua senha não é guardada de forma legível. Cada pessoa da equipe acessa só o necessário para a função dela.</p>
      <h2>Seus direitos</h2>
      <p>Você pode baixar uma cópia dos seus dados em Perfil, corrigir o que estiver errado e pedir informações ou exclusão pelo atendimento. Registros financeiros podem ser mantidos pelo tempo exigido em lei.</p>
      <p><Link className="link" href="/">Voltar</Link></p>
    </div>
  );
}
