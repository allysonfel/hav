import Link from "next/link";
import { requireInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { dataBr } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { salvarEmailRelatorio } from "../acoes";

export default async function Avisos({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const i = await requireInvestidor();
  const { ok } = await searchParams;
  const s = await getSettings();
  const [{ relatorio_email }] = await sql<{ relatorio_email: boolean }[]>`SELECT relatorio_email FROM investidores WHERE id = ${i.id}`;
  const avisos = await sql<{ id: number; titulo: string; texto: string; href: string; criado_em: Date; lido_em: Date | null }[]>`
    SELECT id, titulo, texto, href, criado_em, lido_em FROM avisos_investidor WHERE investidor_id = ${i.id} ORDER BY criado_em DESC LIMIT 50`;
  // Abrir a tela conta como leitura; o layout já calculou o sino desta visita.
  await sql`UPDATE avisos_investidor SET lido_em = now() WHERE investidor_id = ${i.id} AND lido_em IS NULL`;
  return (
    <>
      <div className="hello"><h2 style={{ fontSize: 17 }}>Avisos</h2></div>
      {ok === "email" && <div className="aviso ok">Preferência salva.</div>}
      {s.emailRelatorio && (
        <form action={salvarEmailRelatorio} className="card" style={{ padding: 16, marginBottom: 14 }}>
          <label className="linha" style={{ flexWrap: "nowrap", alignItems: "flex-start", fontSize: 13 }}>
            <input type="checkbox" name="ligado" value="1" defaultChecked={relatorio_email} style={{ marginTop: 3 }} />
            <span><b>Relatório mensal por e-mail</b><br /><span className="muted" style={{ fontSize: 12 }}>Quando a equipe fechar o mês, você recebe o PDF em {i.email}.</span></span>
          </label>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>Salvar</button>
        </form>
      )}
      {avisos.length === 0 && <div className="card card-p vazio">Nenhum aviso por enquanto.</div>}
      {avisos.length > 0 && (
        <div className="card" style={{ padding: "4px 0" }}>
          {avisos.map((a) => (
            <Link key={a.id} href={a.href} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="meta">
                <b>{!a.lido_em && <span className="novo" />}{a.titulo}</b>
                <span>{a.texto} · {dataBr(a.criado_em)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
