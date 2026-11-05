import { requireUser } from "@/lib/session";
import { Retorno } from "@/components/basicos";
import { ERROS_USINA, FormUsina } from "../FormUsina";
import { dadosSolis } from "@/lib/monitoramento";

export default async function NovaUsina({ searchParams }: { searchParams: Promise<{ erro?: string; status?: string }> }) {
  await requireUser(["admin"]);
  const { erro, status } = await searchParams;
  return (
    <>
      <Retorno erro={erro} mapaErro={ERROS_USINA} />
      <FormUsina status={status === "captacao" ? "captacao" : undefined} solis={await dadosSolis()} />
    </>
  );
}
