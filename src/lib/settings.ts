// Configurações gerais, guardadas em configuracoes.dados (JSONB). Valores
// fora da faixa voltam para o padrão.
import { sql, ensureSchema } from "./db";

export type Settings = {
  empresa: string;
  razaoSocial: string;
  cnpj: string;
  // 0 = último dia útil do mês; 1 a 28 = esse dia do mês seguinte.
  diaFechamento: number;
  suporteWhatsapp: string;
  suporteEmail: string;
  // Tela de oportunidades no app. Só ligar depois do parecer do advogado sobre a CVM.
  oportunidades: boolean;
  // Plus: relatório mensal por e-mail ao fechar o mês (padrão ligado).
  emailRelatorio: boolean;
  // Plus: projeção dos próximos meses no app do investidor (padrão desligado,
  // pelo mesmo cuidado da CVM: estimativa não pode parecer promessa de rendimento).
  projecaoApp: boolean;
  // Prazo do repasse: até quantos dias depois de fechar o mês o Pix é feito (1 a 60).
  // O investidor vê a data prevista; passou do prazo, a equipe vê como atrasado.
  prazoRepasse: number;
  // Plus: agente de IA (painel e app). Padrão ligado; sem GROQ_API_KEY ele avisa que não está configurado.
  agente: boolean;
  // Dia em que começa o período de apuração (1 = mês do calendário; 21 = de 21
  // do mês anterior a 20 do mês da competência, como a HAV faz).
  inicioPeriodo: number;
  // Comparativo do relatório: rendimento de cada aplicação no período, em ppm
  // (1,225% = 12250). A equipe atualiza em Configurações.
  cdiPeriodo: number;
  fiiPeriodo: number;
  poupancaPeriodo: number;
  // Quem assina o relatório do investidor (nome e cargo), no fim do PDF.
  responsavel: string;
  responsavelCargo: string;
};

const taxa = (v: unknown, padrao: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 200_000 ? n : padrao;
};

export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export async function getSettings(): Promise<Settings> {
  await ensureSchema();
  const [row] = await sql<{ dados: Partial<Settings> }[]>`SELECT dados FROM configuracoes WHERE id = 1`;
  const d = row?.dados ?? {};
  const dia = Number(d.diaFechamento);
  const prazo = Number(d.prazoRepasse);
  const inicio = Number(d.inicioPeriodo);
  return {
    empresa: typeof d.empresa === "string" && d.empresa.trim() ? d.empresa.trim().slice(0, 40) : "HAV Energia",
    razaoSocial: typeof d.razaoSocial === "string" ? d.razaoSocial.trim().slice(0, 100) : "",
    cnpj: typeof d.cnpj === "string" && /^\d{14}$/.test(d.cnpj) ? d.cnpj : "",
    diaFechamento: Number.isInteger(dia) && dia >= 0 && dia <= 28 ? dia : 0,
    suporteWhatsapp: typeof d.suporteWhatsapp === "string" && /^\d{12,13}$/.test(d.suporteWhatsapp) ? d.suporteWhatsapp : "",
    suporteEmail: typeof d.suporteEmail === "string" && EMAIL.test(d.suporteEmail) ? d.suporteEmail : "",
    oportunidades: d.oportunidades === true,
    emailRelatorio: d.emailRelatorio !== false,
    projecaoApp: d.projecaoApp === true,
    agente: d.agente !== false,
    prazoRepasse: Number.isInteger(prazo) && prazo >= 1 && prazo <= 60 ? prazo : 10,
    inicioPeriodo: Number.isInteger(inicio) && inicio >= 1 && inicio <= 28 ? inicio : 21,
    cdiPeriodo: taxa(d.cdiPeriodo, 12_250),
    fiiPeriodo: taxa(d.fiiPeriodo, 9_000),
    poupancaPeriodo: taxa(d.poupancaPeriodo, 6_750),
    responsavel: typeof d.responsavel === "string" ? d.responsavel.trim().slice(0, 80) : "",
    responsavelCargo: typeof d.responsavelCargo === "string" ? d.responsavelCargo.trim().slice(0, 60) : "",
  };
}

export async function saveSettings(parcial: Partial<Settings>) {
  await sql`UPDATE configuracoes SET dados = dados || ${sql.json(parcial)} WHERE id = 1`;
}
