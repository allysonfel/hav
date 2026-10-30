import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { COMPETENCIA, campoDecimal, competenciaEsperada, mesAno, mesAtual, somarMeses } from "@/lib/format";
import { Retorno } from "@/components/basicos";
import { lancarGeracao } from "../../acoes";

const ERROS: Record<string, string> = {
  mes: "Escolha um mês válido (não pode ser no futuro).",
  geracao: "Informe a geração do mês em kWh.",
  receita: "Informe a receita do mês em reais.",
  fechado: "Este mês já foi fechado. Para corrigir, o administrador reabre o mês.",
};

export default async function Lancar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; comp?: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [u] = await sql<{ id: number; nome: string; status: string }[]>`SELECT id, nome, status FROM usinas WHERE id = ${id}`;
  if (!u) notFound();
  if (u.status === "captacao") redirect(`/painel/usinas/${id}`);

  const s = await getSettings();
  const esperada = competenciaEsperada(s.diaFechamento);
  const comp = sp.comp && COMPETENCIA.test(sp.comp) ? sp.comp : esperada;
  const meses = Array.from({ length: 24 }, (_, i) => somarMeses(mesAtual(), -i));
  const lancados = await sql<{ comp: string; geracao_wh: number; receita_centavos: number; status: string }[]>`
    SELECT to_char(competencia, 'YYYY-MM') AS comp, geracao_wh, receita_centavos, status FROM fechamentos WHERE usina_id = ${id}`;
  const atual = lancados.find((l) => l.comp === comp);
  const rotulo = (m: string) => {
    const l = lancados.find((x) => x.comp === m);
    return `${mesAno(m)}${l ? (l.status === "fechado" ? " (fechado)" : " (rascunho)") : ""}`;
  };

  return (
    <>
      <Retorno erro={sp.erro} mapaErro={ERROS} />
      <Link className="btn btn-ghost" style={{ marginBottom: 14 }} href={`/painel/usinas/${id}`}>← {u.nome}</Link>
      <div className="card card-p" style={{ maxWidth: 520 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{u.nome}</h3>
        <p className="muted sm" style={{ margin: "0 0 16px" }}>O lançamento fica como rascunho até o administrador fechar o mês. Só depois disso entra no rateio.</p>
        {/* Trocar o mês recarrega a tela com os valores daquele mês. */}
        <form method="get" className="field">
          <label htmlFor="comp">Mês</label>
          <div className="linha" style={{ flexWrap: "nowrap" }}>
            <select id="comp" name="comp" defaultValue={comp}>
              {meses.map((m) => <option key={m} value={m}>{rotulo(m)}</option>)}
            </select>
            <button className="btn btn-ghost">Abrir</button>
          </div>
        </form>
        {atual?.status === "fechado" ? (
          <div className="aviso info">{mesAno(comp)} já está fechado. Escolha outro mês.</div>
        ) : (
          <form action={lancarGeracao} key={comp}>
            <input type="hidden" name="usina" value={id} />
            <input type="hidden" name="comp" value={comp} />
            <div className="field"><label htmlFor="geracao">Geração de {mesAno(comp)} (kWh)</label><input id="geracao" name="geracao" required inputMode="decimal" defaultValue={atual ? campoDecimal(atual.geracao_wh / 1000, 3) : ""} placeholder="142.300" /></div>
            <div className="field"><label htmlFor="receita">Receita a distribuir (R$)</label><input id="receita" name="receita" required inputMode="decimal" defaultValue={atual ? campoDecimal(atual.receita_centavos / 100, 2) : ""} placeholder="71.150" /></div>
            <button className="btn btn-gold">{atual ? "Salvar rascunho" : "Lançar"}</button>
          </form>
        )}
      </div>
    </>
  );
}
