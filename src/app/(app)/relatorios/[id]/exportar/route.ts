// Relatório do mês do próprio investidor. A consulta filtra pela sessão: id de
// outro investidor ou mês sem rateio dele dá 404.
import { getInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { csvDinheiro, csvKwh, csvPct, respostaCsv } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const i = await getInvestidor();
  if (!i) return new Response("proibido", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("não encontrado", { status: 404 });
  const [r] = await sql<{ usina: string; comp: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string }[]>`
    SELECT u.nome AS usina, to_char(f.competencia, 'YYYY-MM') AS comp, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id JOIN usinas u ON u.id = f.usina_id
    WHERE r.fechamento_id = ${id} AND r.investidor_id = ${i.id}`;
  if (!r) return new Response("não encontrado", { status: 404 });
  await audit(`investidor:${i.id}`, "relatorio_baixado", "fechamento", id);
  return respostaCsv(`relatorio-${r.comp}.csv`,
    ["Investidor", "Usina", "Mês", "Cota (%)", "Geração proporcional (kWh)", "Receita (R$)", "Repasse"],
    [[i.nome, r.usina, r.comp, csvPct(r.cota_ppm), csvKwh(r.geracao_wh), csvDinheiro(r.receita_centavos), r.repasse_status]]);
}
