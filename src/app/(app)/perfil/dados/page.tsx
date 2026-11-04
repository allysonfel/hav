import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { celularFormatado } from "@/lib/cpf";
import { salvarCelular } from "../../acoes";

export default async function Dados({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const i = await requireInvestidor();
  const sp = await searchParams;
  const [r] = await sql<{ documento_final: string }[]>`SELECT documento_final FROM investidores WHERE id = ${i.id}`;
  return (
    <>
      <div className="hello"><Link className="link sm" href="/perfil">← Perfil</Link><h2>Dados pessoais</h2></div>
      {sp.ok && <div className="aviso ok">Celular salvo.</div>}
      {sp.erro && <div className="aviso erro">Confira o celular, com DDD.</div>}
      <form action={salvarCelular} className="card card-p" style={{ marginBottom: 14 }}>
        <div className="field"><label>Nome</label><input value={i.nome} disabled readOnly /></div>
        <div className="field"><label>E-mail</label><input value={i.email} disabled readOnly /></div>
        <div className="field"><label>CPF/CNPJ</label><input value={r.documento_final ? `••••••${r.documento_final}` : "Não informado"} disabled readOnly /></div>
        <div className="field"><label htmlFor="celular">Celular</label><input id="celular" name="celular" defaultValue={i.celular ? celularFormatado(i.celular) : ""} required maxLength={20} inputMode="tel" /></div>
        <button className="btn btn-primary btn-block">Salvar</button>
        <p className="muted sm" style={{ margin: "10px 0 0" }}>Para mudar nome, e-mail ou documento, fale com a equipe.</p>
      </form>
      <a className="btn btn-ghost btn-block" href="/perfil/meus-dados/exportar">Baixar cópia dos meus dados</a>
    </>
  );
}
