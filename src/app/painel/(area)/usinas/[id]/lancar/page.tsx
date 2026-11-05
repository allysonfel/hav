import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { COMPETENCIA, campoDecimal, competenciaEsperada, kwh, mesAno, mesAtual, periodoCurto, periodoTexto, somarMeses, tarifaTxt } from "@/lib/format";
import { Retorno } from "@/components/basicos";
import { lancarGeracao } from "../../acoes";

const ERROS: Record<string, string> = {
  mes: "Escolha um mês válido (não pode ser no futuro).",
  geracao: "Informe a geração do mês em kWh.",
  receita: "Informe a receita do mês em reais.",
  disponibilidade: "Confira a disponibilidade (de 0 a 100%).",
  fechado: "Este mês já foi fechado. Para corrigir, o administrador reabre o mês.",
};

export default async function Lancar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; comp?: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id < 1) notFound();
  const [u] = await sql<{ id: number; nome: string; status: string; geracao_esperada_wh: number | null; tarifa_kwh: number | null }[]>`SELECT id, nome, status, geracao_esperada_wh, tarifa_kwh FROM usinas WHERE id = ${id}`;
  if (!u) notFound();
  if (u.status === "captacao") redirect(`/painel/usinas/${id}`);

  const s = await getSettings();
  const esperada = competenciaEsperada(s.diaFechamento);
  const comp = sp.comp && COMPETENCIA.test(sp.comp) ? sp.comp : esperada;
  const meses = Array.from({ length: 24 }, (_, i) => somarMeses(mesAtual(), -i));
  const lancados = await sql<{ comp: string; geracao_wh: number; receita_centavos: number; status: string; disponibilidade_ppm: number | null }[]>`
    SELECT to_char(competencia, 'YYYY-MM') AS comp, geracao_wh, receita_centavos, status, disponibilidade_ppm FROM fechamentos WHERE usina_id = ${id}`;
  const atual = lancados.find((l) => l.comp === comp);
  const rotulo = (m: string) => {
    const l = lancados.find((x) => x.comp === m);
    return `${mesAno(m)} (${periodoTexto(m, s.inicioPeriodo).replace(/\/\d{4}/g, "")})${l ? (l.status === "fechado" ? " (fechado)" : " (rascunho)") : ""}`;
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
            <p className="muted sm" style={{ margin: "0 0 10px" }}>Período de {mesAno(comp)}: <b>{periodoTexto(comp, s.inicioPeriodo)}</b>.</p>
            <div className="field"><label htmlFor="geracao">Geração de {mesAno(comp)} (kWh)</label><input id="geracao" name="geracao" required inputMode="decimal" defaultValue={atual ? campoDecimal(atual.geracao_wh / 1000, 3) : ""} placeholder="142.300" />
              <small>{u.geracao_esperada_wh ? `Esperado para esta usina: cerca de ${kwh(u.geracao_esperada_wh)} por mês. Abaixo de 85% disso, o sistema avisa.` : "Valor do aplicativo de monitoramento dos inversores, no período inteiro."}</small></div>
            {u.tarifa_kwh ? (
              <div className="aviso info" style={{ marginBottom: 14 }}>A receita é calculada sozinha: geração x <b>{tarifaTxt(u.tarifa_kwh)}</b>. Cada cotista recebe a parte da própria cota.</div>
            ) : (
              <div className="field"><label htmlFor="receita">Receita a distribuir (R$)</label><input id="receita" name="receita" required inputMode="decimal" defaultValue={atual ? campoDecimal(atual.receita_centavos / 100, 2) : ""} placeholder="71.150" />
                <small>O que vai ser dividido entre os cotistas pela cota de cada um. Para calcular sozinho, cadastre o valor por kWh em Editar usina.</small></div>
            )}
            <div className="field"><label htmlFor="disponibilidade">Disponibilidade da usina no período (%, opcional)</label><input id="disponibilidade" name="disponibilidade" inputMode="decimal" defaultValue={atual?.disponibilidade_ppm != null ? campoDecimal(atual.disponibilidade_ppm / 10_000, 1) : ""} placeholder="98,5" />
              <small>Do aplicativo de monitoramento. Aparece no relatório do investidor.</small></div>
            <button className="btn btn-gold">{atual ? "Salvar rascunho" : "Lançar"}</button>
          </form>
        )}
      </div>
    </>
  );
}
