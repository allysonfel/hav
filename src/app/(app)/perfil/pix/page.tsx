import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { decifrar } from "@/lib/cifra";
import { salvarPix } from "../../acoes";

const ERROS: Record<string, string> = { pix: "Informe a chave Pix.", senha: "Senha incorreta.", limite: "Muitas tentativas. Aguarde 15 minutos." };

export default async function Pix({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const i = await requireInvestidor();
  const sp = await searchParams;
  const [r] = await sql<{ pix_cifrado: string | null }[]>`SELECT pix_cifrado FROM investidores WHERE id = ${i.id}`;
  return (
    <>
      <div className="hello"><Link className="link sm" href="/perfil">← Perfil</Link><h2>Dados para repasse</h2></div>
      {sp.ok && <div className="aviso ok">Chave Pix salva.</div>}
      {sp.erro && <div className="aviso erro">{ERROS[sp.erro] ?? "Confira os dados."}</div>}
      <form action={salvarPix} className="card card-p">
        <div className="field"><label htmlFor="pix">Chave Pix</label><input id="pix" name="pix" defaultValue={decifrar(r.pix_cifrado)} required maxLength={140} /><small>Guardada com criptografia. A equipe da HAV usa esta chave para os repasses.</small></div>
        <div className="field"><label htmlFor="senha">Sua senha, para confirmar</label><input id="senha" name="senha" type="password" required maxLength={200} autoComplete="current-password" /></div>
        <button className="btn btn-primary btn-block">Salvar</button>
      </form>
    </>
  );
}
