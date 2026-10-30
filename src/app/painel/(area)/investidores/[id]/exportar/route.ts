// Planilha de todos os rateios de um investidor.
import { getUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { csvDinheiro, csvKwh, csvPct, respostaCsv } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response("proibido", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("não encontrado", { status: 404 });
  const linhas = await sql<{ comp: string; usina: string; nome: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string }[]>`
    SELECT to_char(f.competencia, 'YYYY-MM') AS comp, us.nome AS usina, i.nome, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status
    FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id JOIN usinas us ON us.id = f.usina_id JOIN investidores i ON i.id = r.investidor_id
    WHERE r.investidor_id = ${id} ORDER BY f.competencia DESC, us.nome`;
  await audit(`usuario:${u.id}`, "rateios_exportados", "investidor", id);
  return respostaCsv(`rateios-investidor-${id}.csv`,
    ["Investidor", "Mês", "Usina", "Cota (%)", "Geração proporcional (kWh)", "Receita (R$)", "Repasse"],
    linhas.map((l) => [l.nome, l.comp, l.usina, csvPct(l.cota_ppm), csvKwh(l.geracao_wh), csvDinheiro(l.receita_centavos), l.repasse_status]));
}
