// Agente de IA do investidor (Plus). O id vem da sessão: o contexto só tem as
// cotas, rateios e repasses dele. Nada da conversa é guardado.
import { getInvestidor } from "@/lib/investidor";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { lerPedido, responderInvestidor } from "@/lib/agente";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const i = await getInvestidor();
  if (!i) return Response.json({ erro: "sessao" }, { status: 401 });
  if (!(await getSettings()).agente) return Response.json({ erro: "desligado" }, { status: 404 });
  if (!req.headers.get("content-type")?.includes("application/json")) return Response.json({ erro: "pedido" }, { status: 400 });
  const p = lerPedido(await req.json().catch(() => null));
  if (!p) return Response.json({ erro: "pedido" }, { status: 400 });
  await audit(`investidor:${i.id}`, "agente_pergunta");
  return Response.json(await responderInvestidor(i, p.q, p.anteriores));
}
