// Comprovante do Pix de um repasse, no painel. Só o administrador (tem dados bancários).
import { getUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { comprovanteDoRateio, respostaComprovante } from "@/lib/comprovantes";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ rateio: string }> }) {
  const u = await getUser();
  if (!u || u.perfil !== "admin") return new Response("proibido", { status: 403 });
  const id = Number((await params).rateio);
  if (!Number.isInteger(id) || id < 1) return new Response("não encontrado", { status: 404 });
  const c = await comprovanteDoRateio(id);
  if (!c) return new Response("não encontrado", { status: 404 });
  await audit(`usuario:${u.id}`, "comprovante_aberto", "rateio", id);
  return respostaComprovante(c, `comprovante-repasse-${id}`);
}
