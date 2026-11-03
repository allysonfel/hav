// PDF do relatório do mês do próprio investidor. O id do investidor vem da
// sessão: mês de outra pessoa ou sem rateio dele dá 404.
import { getInvestidor } from "@/lib/investidor";
import { audit } from "@/lib/audit";
import { relatorioInvestidor } from "@/lib/relatorios";
import { pdfInvestidor, respostaPdf } from "@/lib/pdf/RelatoriosPdf";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const i = await getInvestidor();
  if (!i) return new Response("proibido", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("não encontrado", { status: 404 });
  const r = await relatorioInvestidor(id, i.id);
  if (!r) return new Response("não encontrado", { status: 404 });
  await audit(`investidor:${i.id}`, "pdf_baixado", "fechamento", id);
  return respostaPdf(await pdfInvestidor(r), `relatorio-${r.fechamento.comp}.pdf`);
}
