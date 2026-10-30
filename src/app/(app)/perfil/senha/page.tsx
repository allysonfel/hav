import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { SENHA_MINIMA } from "@/lib/auth";
import { trocarSenha } from "../../acoes";

const ERROS: Record<string, string> = { atual: "Senha atual incorreta.", curta: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`, limite: "Muitas tentativas. Aguarde 15 minutos." };

export default async function Senha({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireInvestidor();
  const sp = await searchParams;
  return (
    <>
      <div className="hello"><Link className="link sm" href="/perfil">← Perfil</Link><h2 style={{ fontSize: 17 }}>Segurança e senha</h2></div>
      {sp.ok && <div className="aviso ok">Senha trocada. As outras sessões foram encerradas.</div>}
      {sp.erro && <div className="aviso erro">{ERROS[sp.erro] ?? "Confira os dados."}</div>}
      <form action={trocarSenha} className="card card-p">
        <div className="field"><label htmlFor="atual">Senha atual</label><input id="atual" name="atual" type="password" required maxLength={200} autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="nova">Nova senha (mínimo {SENHA_MINIMA} caracteres)</label><input id="nova" name="nova" type="password" required minLength={SENHA_MINIMA} maxLength={200} autoComplete="new-password" /></div>
        <button className="btn btn-primary btn-block">Trocar senha</button>
      </form>
    </>
  );
}
