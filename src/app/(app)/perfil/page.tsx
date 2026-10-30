import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { iniciais } from "@/lib/format";
import { sair } from "../acoes";

export default async function Perfil() {
  const i = await requireInvestidor();
  const linha = (href: string, nome: string) => <Link className="profile-row" href={href}><span>{nome}</span><span className="seta">›</span></Link>;
  return (
    <>
      <div className="hello"><h2 style={{ fontSize: 17 }}>Perfil</h2></div>
      <div className="card" style={{ padding: 18, marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div className="av-grande">{iniciais(i.nome)}</div>
        <div><b style={{ display: "block", fontSize: 14.5 }}>{i.nome}</b><span className="muted" style={{ fontSize: 12 }}>{i.email}</span></div>
      </div>
      <div className="card" style={{ padding: "4px 16px", marginBottom: 14 }}>
        {linha("/perfil/dados", "Dados pessoais")}
        {linha("/perfil/pix", "Dados bancários para repasse")}
        {linha("/perfil/senha", "Segurança e senha")}
        {linha("/avisos", "Notificações")}
      </div>
      <div className="card" style={{ padding: "4px 16px", marginBottom: 14 }}>
        {linha("/ajuda", "Central de ajuda")}
        {linha("/ajuda#falar", "Falar com a HAV Energia")}
        {linha("/privacidade", "Aviso de privacidade")}
      </div>
      <form action={sair}><button className="btn btn-ghost btn-block">Sair da conta</button></form>
    </>
  );
}
