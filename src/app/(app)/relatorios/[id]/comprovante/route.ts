// Comprovante do Pix do repasse do próprio investidor, no mês [id] (fechamento).
// O investidor vem da sessão: mês de outra pessoa ou sem comprovante dá 404.
import { getInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { comprovanteDoRateio, respostaComprovante } from "@/lib/comprovantes";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const i = await getInvestidor();
  if (!i) return new Response("proibido", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("não encontrado", { status: 404 });
  const [r] = await sql<{ id: number; comp: string }[]>`
    SELECT r.id, to_char(f.competencia, 'YYYY-MM') AS comp FROM rateios r JOIN fechamentos f ON f.id = r.fechamento_id
    WHERE r.fechamento_id = ${id} AND r.investidor_id = ${i.id} AND r.repasse_status = 'pago'`;
  if (!r) return new Response("não encontrado", { status: 404 });
  const c = await comprovanteDoRateio(r.id);
  if (!c) return new Response("não encontrado", { status: 404 });
  await audit(`investidor:${i.id}`, "comprovante_baixado", "rateio", r.id);
  return respostaComprovante(c, `comprovante-repasse-${r.comp}`);
}
