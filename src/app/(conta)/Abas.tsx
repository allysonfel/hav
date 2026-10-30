import Link from "next/link";

const ABAS = [["/entrar", "Entrar"], ["/criar-conta", "Criar conta"], ["/recuperar", "Esqueci a senha"]];

export function Abas({ atual }: { atual: string }) {
  return (
    <div className="inv-tabs">
      {ABAS.map(([href, nome]) => <Link key={href} href={href} className={href === atual ? "active" : ""}>{nome}</Link>)}
    </div>
  );
}
