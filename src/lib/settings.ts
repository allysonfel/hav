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
};

export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export async function getSettings(): Promise<Settings> {
  await ensureSchema();
  const [row] = await sql<{ dados: Partial<Settings> }[]>`SELECT dados FROM configuracoes WHERE id = 1`;
  const d = row?.dados ?? {};
  const dia = Number(d.diaFechamento);
  return {
    empresa: typeof d.empresa === "string" && d.empresa.trim() ? d.empresa.trim().slice(0, 40) : "HAV Energia",
    razaoSocial: typeof d.razaoSocial === "string" ? d.razaoSocial.trim().slice(0, 100) : "",
    cnpj: typeof d.cnpj === "string" && /^\d{14}$/.test(d.cnpj) ? d.cnpj : "",
    diaFechamento: Number.isInteger(dia) && dia >= 0 && dia <= 28 ? dia : 0,
    suporteWhatsapp: typeof d.suporteWhatsapp === "string" && /^\d{12,13}$/.test(d.suporteWhatsapp) ? d.suporteWhatsapp : "",
    suporteEmail: typeof d.suporteEmail === "string" && EMAIL.test(d.suporteEmail) ? d.suporteEmail : "",
    oportunidades: d.oportunidades === true,
  };
}

export async function saveSettings(parcial: Partial<Settings>) {
  await sql`UPDATE configuracoes SET dados = dados || ${sql.json(parcial)} WHERE id = 1`;
}
