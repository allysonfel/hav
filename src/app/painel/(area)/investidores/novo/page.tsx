import { requireUser } from "@/lib/session";
import { Retorno } from "@/components/basicos";
import { ERROS_INVESTIDOR, FormInvestidor } from "../FormInvestidor";

export default async function NovoInvestidor({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireUser(["admin"]);
  const { erro } = await searchParams;
  return (
    <>
      <Retorno erro={erro} mapaErro={ERROS_INVESTIDOR} />
      <FormInvestidor />
    </>
  );
}
