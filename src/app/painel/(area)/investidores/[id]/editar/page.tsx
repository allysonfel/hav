import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { decifrar } from "@/lib/cifra";
import { abrirConta } from "@/lib/contaBancaria";
import { Retorno } from "@/components/basicos";
import { ERROS_INVESTIDOR, FormInvestidor } from "../../FormInvestidor";
import { excluirInvestidor } from "../../acoes";

export default async function EditarInvestidor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  await requireUser(["admin"]);
  const id = Number((await params).id);
  const { erro } = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [i] = await sql<{ id: number; nome: string; email: string; celular: string; documento_cifrado: string | null; pix_cifrado: string | null; conta_cifrada: string | null }[]>`
    SELECT id, nome, email, celular, documento_cifrado, pix_cifrado, conta_cifrada FROM investidores WHERE id = ${id}`;
  if (!i) notFound();
  const c = abrirConta(i.conta_cifrada);
  return (
    <>
      <Retorno erro={erro} mapaErro={ERROS_INVESTIDOR} />
      <FormInvestidor inv={{ id: i.id, nome: i.nome, email: i.email, celular: i.celular, documento: decifrar(i.documento_cifrado), pix: decifrar(i.pix_cifrado), banco: c?.banco ?? "", agencia: c?.agencia ?? "", conta: c?.conta ?? "" }} />
      <form action={excluirInvestidor} style={{ marginTop: 14 }}>
        <input type="hidden" name="id" value={i.id} />
        <button className="btn btn-danger btn-sm">Excluir investidor</button>
        <span className="muted sm" style={{ marginLeft: 10 }}>Só para quem não tem cotas nem histórico.</span>
      </form>
    </>
  );
}
