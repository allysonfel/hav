import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";

export default async function Enviado() {
  await requireInvestidor();
  return (
    <div className="vazio" style={{ paddingTop: 60 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 15.5, color: "var(--ink)" }}>Interesse enviado</h3>
      <p>A equipe da HAV Energia vai te chamar em breve para alinhar os próximos passos.</p>
      <Link className="btn btn-primary" style={{ marginTop: 18 }} href="/">Voltar ao início</Link>
    </div>
  );
}
