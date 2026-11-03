import { redirect } from "next/navigation";
import { requireUser, endSession, getUser, PERFIL_NOME } from "@/lib/session";
import { audit } from "@/lib/audit";
import { avisosDe } from "@/lib/avisos";
import { iniciais } from "@/lib/format";
import { Shell } from "@/components/Shell";
import { Agente } from "@/components/Agente";
import { getSettings } from "@/lib/settings";

async function sair() {
  "use server";
  const u = await getUser();
  if (u) await audit(`usuario:${u.id}`, "logout");
  await endSession();
  redirect("/painel/entrar");
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const avisos = await avisosDe(u);
  return (
    <Shell usuario={{ nome: u.nome, iniciais: iniciais(u.nome), perfil: u.perfil, perfilNome: PERFIL_NOME[u.perfil] }} avisos={avisos} sair={sair}>
      {children}
      {(await getSettings()).agente && <Agente onde="painel" />}
    </Shell>
  );
}
