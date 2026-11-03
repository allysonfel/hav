// PDF do rateio de um mês fechado (painel, admin e operador). Com ?investidor=,
// sai o relatório daquele investidor, igual ao que ele recebe por e-mail.
import { getUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { relatorioFechamento, relatorioInvestidor } from "@/lib/relatorios";
import { pdfFechamento, pdfInvestidor, respostaPdf } from "@/lib/pdf/RelatoriosPdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response("proibido", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("não encontrado", { status: 404 });
  const inv = Number(new URL(req.url).searchParams.get("investidor") ?? 0);
  if (inv) {
    if (!Number.isInteger(inv) || inv < 1) return new Response("não encontrado", { status: 404 });
    const r = await relatorioInvestidor(id, inv);
    if (!r) return new Response("não encontrado", { status: 404 });
    await audit(`usuario:${u.id}`, "pdf_investidor_baixado", "fechamento", id, `investidor ${inv}`);
    return respostaPdf(await pdfInvestidor(r), `relatorio-${r.fechamento.comp}-investidor-${inv}.pdf`);
  }
  const r = await relatorioFechamento(id);
  if (!r) return new Response("não encontrado", { status: 404 });
  await audit(`usuario:${u.id}`, "pdf_fechamento_baixado", "fechamento", id);
  return respostaPdf(await pdfFechamento(r), `rateio-${r.fechamento.comp}-usina-${id}.pdf`);
}
