import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { decifrar } from "@/lib/cifra";
import { abrirConta } from "@/lib/contaBancaria";
import { salvarPix } from "../../acoes";

const ERROS: Record<string, string> = { pix: "Informe a chave Pix ou a conta bancária.", conta: "Conta incompleta: informe banco, agência e conta (só números e traço), ou deixe os três em branco.", senha: "Senha incorreta.", limite: "Muitas tentativas. Aguarde 15 minutos." };

export default async function Pix({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const i = await requireInvestidor();
  const sp = await searchParams;
  const [r] = await sql<{ pix_cifrado: string | null; conta_cifrada: string | null }[]>`SELECT pix_cifrado, conta_cifrada FROM investidores WHERE id = ${i.id}`;
  const c = abrirConta(r.conta_cifrada);
  return (
    <>
      <div className="hello"><Link className="link sm" href="/perfil">← Perfil</Link><h2>Dados para repasse</h2></div>
      {sp.ok && <div className="aviso ok">Dados para repasse salvos.</div>}
      {sp.erro && <div className="aviso erro">{ERROS[sp.erro] ?? "Confira os dados."}</div>}
      <form action={salvarPix} className="card card-p">
        <div className="field"><label htmlFor="pix">Chave Pix</label><input id="pix" name="pix" defaultValue={decifrar(r.pix_cifrado)} maxLength={140} /><small>Guardada com criptografia.</small></div>
        <div className="box-title">Conta bancária</div>
        <div className="field"><label htmlFor="banco">Banco</label><input id="banco" name="banco" defaultValue={c?.banco} maxLength={60} /></div>
        <div className="field"><label htmlFor="agencia">Agência</label><input id="agencia" name="agencia" defaultValue={c?.agencia} maxLength={12} inputMode="numeric" /></div>
        <div className="field"><label htmlFor="conta">Conta com dígito</label><input id="conta" name="conta" defaultValue={c?.conta} maxLength={24} /><small>A equipe da HAV usa estes dados para os repasses. Aparecem no seu relatório mensal.</small></div>
        <div className="field"><label htmlFor="senha">Sua senha, para confirmar</label><input id="senha" name="senha" type="password" required maxLength={200} autoComplete="current-password" /></div>
        <button className="btn btn-primary btn-block">Salvar</button>
      </form>
    </>
  );
}
