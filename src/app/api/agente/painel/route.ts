// Agente de IA da equipe (Plus). Sessão do painel conferida aqui; o contexto é
// montado no servidor pelo perfil de quem pergunta. Nada da conversa é guardado.
import { getUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { lerPedido, responderEquipe } from "@/lib/agente";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await getUser();
  if (!u) return Response.json({ erro: "sessao" }, { status: 401 });
  if (!(await getSettings()).agente) return Response.json({ erro: "desligado" }, { status: 404 });
  if (!req.headers.get("content-type")?.includes("application/json")) return Response.json({ erro: "pedido" }, { status: 400 });
  const p = lerPedido(await req.json().catch(() => null));
  if (!p) return Response.json({ erro: "pedido" }, { status: 400 });
  await audit(`usuario:${u.id}`, "agente_pergunta");
  return Response.json(await responderEquipe(u, p.q, p.anteriores));
}
