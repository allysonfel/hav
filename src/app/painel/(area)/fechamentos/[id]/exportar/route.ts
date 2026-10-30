// Planilha do rateio de um mês fechado, para admin e operador.
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
  const [f] = await sql<{ usina: string; comp: string }[]>`
    SELECT u.nome AS usina, to_char(f.competencia, 'YYYY-MM') AS comp
    FROM fechamentos f JOIN usinas u ON u.id = f.usina_id WHERE f.id = ${id} AND f.status = 'fechado'`;
  if (!f) return new Response("não encontrado", { status: 404 });
  const linhas = await sql<{ nome: string; cota_ppm: number; geracao_wh: number; receita_centavos: number; repasse_status: string }[]>`
    SELECT i.nome, r.cota_ppm, r.geracao_wh, r.receita_centavos, r.repasse_status
    FROM rateios r JOIN investidores i ON i.id = r.investidor_id WHERE r.fechamento_id = ${id} ORDER BY r.cota_ppm DESC, i.nome`;
  await audit(`usuario:${u.id}`, "rateio_exportado", "fechamento", id);
  return respostaCsv(`rateio-${f.comp}-usina-${id}.csv`,
    ["Usina", "Mês", "Investidor", "Cota (%)", "Geração proporcional (kWh)", "Receita (R$)", "Repasse"],
    linhas.map((l) => [f.usina, f.comp, l.nome, csvPct(l.cota_ppm), csvKwh(l.geracao_wh), csvDinheiro(l.receita_centavos), l.repasse_status]));
}
