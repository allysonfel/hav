import { requireInvestidor } from "@/lib/investidor";
import { avisosNaoLidos } from "@/lib/app";
import { getSettings } from "@/lib/settings";
import { AppShell } from "@/components/AppShell";
import { Agente } from "@/components/Agente";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const i = await requireInvestidor();
  const s = await getSettings();
  return (
    <AppShell naoLidos={await avisosNaoLidos(i.id)} oportunidades={s.oportunidades}>
      {children}
      {s.agente && <Agente onde="app" />}
    </AppShell>
  );
}
