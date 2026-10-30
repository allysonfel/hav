import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { Retorno } from "@/components/basicos";
import { ERROS_USINA, FormUsina, type UsinaForm } from "../../FormUsina";
import { excluirUsina } from "../../acoes";

export default async function EditarUsina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  await requireUser(["admin"]);
  const id = Number((await params).id);
  const { erro } = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [usina] = await sql<UsinaForm[]>`
    SELECT id, nome, cidade, uf, capacidade_wp, investimento_centavos, status, to_char(operando_desde, 'YYYY-MM') AS desde,
      inversor_marca, inversor_modelo, inversor_qtd, monitoramento
    FROM usinas WHERE id = ${id}`;
  if (!usina) notFound();
  return (
    <>
      <Retorno erro={erro} mapaErro={ERROS_USINA} />
      <FormUsina usina={usina} />
      <form action={excluirUsina} style={{ marginTop: 14 }}>
        <input type="hidden" name="id" value={usina.id} />
        <button className="btn btn-danger btn-sm">Excluir usina</button>
        <span className="muted sm" style={{ marginLeft: 10 }}>Só para usina sem cotistas nem lançamentos.</span>
      </form>
    </>
  );
}
