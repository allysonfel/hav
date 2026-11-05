// Relatórios em PDF com a identidade da HAV Energia (Plus): logo, azul-marinho
// e dourado do sistema. Fonte Helvetica embutida no leitor de PDF (cobre os
// acentos do português), sem arquivo de fonte para carregar.
import path from "node:path";
import { readFileSync } from "node:fs";
import { Document, Image, Page, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { cnpjFormatado } from "../cpf";
import { brl, dataBr, kwh, kwp, mesAbrev, mesLongo, num, pct, periodo, periodoTexto, tarifaTxt } from "../format";
import { previsaoRepasse } from "../acompanhamento";
import type { RelatorioFechamento, RelatorioInvestidor } from "../relatorios";
import type { Settings } from "../settings";

// Lido como bytes: o leitor de imagem do react-pdf falha com caminho com acento
// (a pasta do projeto pode ficar em C:/Users/André/...).
let logo: { data: Buffer; format: "png" } | null = null;
const LOGO = () => (logo ??= { data: readFileSync(path.join(process.cwd(), "public", "logo-hav.png")), format: "png" });
const C = { navy: "#0f2742", navy3: "#1d3c5c", gold: "#f0a93a", goldBar: "#d4870f", ink: "#142033", muted: "#5c6b7c", faint: "#8894a1", line: "#e3e7ec", bg: "#f5f7f9", ok: "#1f9d55", okBg: "#e9f8ef", warn: "#c77e12", warnBg: "#fff4e2" };

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, paddingBottom: 54, lineHeight: 1.4 },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 36, paddingTop: 22, paddingBottom: 10 },
  logo: { width: 112, height: 57 },
  topoDir: { alignItems: "flex-end" },
  tipo: { fontSize: 8, color: C.faint, letterSpacing: 1.2 },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 3 },
  faixa: { height: 5, backgroundColor: C.navy, flexDirection: "row" },
  faixaOuro: { width: 90, backgroundColor: C.gold },
  corpo: { paddingHorizontal: 36, paddingTop: 18 },
  para: { fontSize: 9, color: C.muted, marginBottom: 2 },
  nome: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  hero: { backgroundColor: C.navy, borderRadius: 10, padding: 16, marginBottom: 14, flexDirection: "row", justifyContent: "space-between" },
  heroLbl: { fontSize: 7.5, color: "#b7c6d8", letterSpacing: 0.8, marginBottom: 4 },
  heroValor: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff", lineHeight: 1.15 },
  heroSub: { fontSize: 8.5, color: "#c3d0de", marginTop: 6 },
  cards: { flexDirection: "row", marginBottom: 14 },
  card: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginRight: 8 },
  cardUlt: { marginRight: 0 },
  cardLbl: { fontSize: 7.5, color: C.muted, marginBottom: 3 },
  cardValor: { fontSize: 11.5, fontFamily: "Helvetica-Bold" },
  secao: { fontSize: 8, color: C.faint, letterSpacing: 1, marginTop: 6, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  tab: { borderWidth: 1, borderColor: C.line, borderRadius: 8, marginBottom: 14 },
  th: { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6, paddingHorizontal: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5, paddingHorizontal: 8 },
  trUlt: { borderBottomWidth: 0 },
  thTxt: { fontSize: 7.5, color: C.muted, fontFamily: "Helvetica-Bold" },
  dir: { textAlign: "right" },
  pillOk: { color: C.ok, fontFamily: "Helvetica-Bold" },
  pillWarn: { color: C.warn, fontFamily: "Helvetica-Bold" },
  nota: { fontSize: 7.5, color: C.faint, marginTop: 4, lineHeight: 1.45 },
  rodape: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 7, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.faint },
});

function Topo({ tipo, titulo }: { tipo: string; titulo: string }) {
  return (
    <>
      <View style={s.topo}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={LOGO()} style={s.logo} />
        <View style={s.topoDir}>
          <Text style={s.tipo}>{tipo}</Text>
          <Text style={s.titulo}>{titulo}</Text>
        </View>
      </View>
      <View style={s.faixa}><View style={s.faixaOuro} /></View>
    </>
  );
}

function Rodape({ e, emitido }: { e: Settings; emitido: string }) {
  const contato = [e.suporteEmail, e.suporteWhatsapp && `WhatsApp +${e.suporteWhatsapp}`].filter(Boolean).join(" · ");
  return (
    <View style={s.rodape} fixed>
      <Text style={{ flex: 1 }}>{[e.razaoSocial || e.empresa, e.cnpj && `CNPJ ${cnpjFormatado(e.cnpj)}`].filter(Boolean).join(" · ")}{contato ? ` · ${contato}` : ""}</Text>
      <Text>Emitido em {emitido}</Text>
    </View>
  );
}

function Card({ lbl, valor, ultimo }: { lbl: string; valor: string; ultimo?: boolean }) {
  return <View style={[s.card, ultimo ? s.cardUlt : {}]}><Text style={s.cardLbl}>{lbl}</Text><Text style={s.cardValor}>{valor}</Text></View>;
}

function Repasse({ status, pago }: { status: string; pago: Date | null }) {
  return status === "pago" ? <Text style={s.pillOk}>Pago{pago ? ` em ${dataBr(pago)}` : ""}</Text> : <Text style={s.pillWarn}>Pendente</Text>;
}

// Barras da receita do investidor nos últimos meses (mesmo dourado do app; o mês do relatório em azul).
function Grafico({ dados }: { dados: { comp: string; receita_centavos: number }[] }) {
  const W = 523, H = 84, base = 70;
  const max = Math.max(...dados.map((d) => d.receita_centavos), 1);
  const passo = W / Math.max(dados.length, 6);
  const larg = Math.min(30, passo * 0.6);
  return (
    <View style={{ marginBottom: 14 }}>
      <Svg width={W} height={H}>
        <Rect x={0} y={base} width={W} height={0.8} fill={C.line} />
        {dados.map((d, i) => {
          const h = Math.max(2, (d.receita_centavos / max) * 60);
          return <Rect key={d.comp} x={passo * i + (passo - larg) / 2} y={base - h} width={larg} height={h} rx={3} fill={i === dados.length - 1 ? C.navy : C.gold} />;
        })}
      </Svg>
      <View style={{ flexDirection: "row", marginTop: -9 }}>
        {dados.map((d) => <Text key={d.comp} style={{ width: passo, textAlign: "center", fontSize: 7, color: C.faint }}>{mesAbrev(d.comp)}/{d.comp.slice(2, 4)}</Text>)}
      </View>
    </View>
  );
}

// Comparativo do relatório: o retorno do período sobre o mesmo valor investido.
function Comparativo({ itens }: { itens: { nome: string; valor: number; cor: string }[] }) {
  const W = 523, H = 100, base = 96;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const passo = W / itens.length;
  const larg = Math.min(70, passo * 0.55);
  return (
    <View style={{ marginBottom: 6 }}>
      <Svg width={W} height={H}>
        <Rect x={0} y={base} width={W} height={0.8} fill={C.line} />
        {itens.map((it, i) => {
          const h = Math.max(2, (it.valor / max) * 86);
          return <Rect key={it.nome} x={passo * i + (passo - larg) / 2} y={base - h} width={larg} height={h} rx={3} fill={it.cor} />;
        })}
      </Svg>
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {itens.map((it) => (
          <View key={it.nome} style={{ width: passo, alignItems: "center" }}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>{brl(it.valor)}</Text>
            <Text style={{ fontSize: 7.5, color: C.muted }}>{it.nome}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Linha2({ a, b, ultimo }: { a: string; b: string; ultimo?: boolean }) {
  return (
    <View style={[s.tr, ultimo ? s.trUlt : {}]}>
      <Text style={{ flex: 1, color: C.muted }}>{a}</Text>
      <Text style={{ flex: 1.4, fontFamily: "Helvetica-Bold" }}>{b}</Text>
    </View>
  );
}

const casas = (n: number, min: number, max: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });
const pct2 = (parte: number, total: number) => (total > 0 ? `${casas((parte / total) * 100, 2, 2)}%` : "-");
const taxaTxt = (ppm: number) => `${casas(ppm / 10_000, 2, 3)}%`;
// Energia com 2 casas, como no relatório da HAV (13.458,32 kWh).
const kwh2 = (wh: number) => `${casas(wh / 1000, 2, 2)} kWh`;

// Relatório de performance do investidor, no modelo que a HAV fazia à mão:
// tudo proporcional à cota de quem recebe (geração, receita, aporte, retorno).
export function RelatorioInvestidorPdf({ r }: { r: RelatorioInvestidor }) {
  const f = r.fechamento;
  const x = r.extra;
  const e = r.empresa;
  const emitido = dataBr(new Date());
  const per = periodo(f.comp, e.inicioPeriodo);
  const perTxt = periodoTexto(f.comp, e.inicioPeriodo);
  const minha = r.rateio.geracao_wh;
  const mediaDia = Math.round(minha / per.dias);
  const performance = x.esperada_wh ? f.geracao_wh / x.esperada_wh : null;
  const aporte = x.aporte_centavos;
  const receita = r.rateio.receita_centavos;
  const cota = pct(r.rateio.cota_ppm);
  const inteira = r.rateio.cota_ppm >= 1_000_000;
  const previsto = previsaoRepasse(f.fechado_em, e.prazoRepasse);
  const repasse = r.rateio.repasse_status === "pago"
    ? `Pago${r.rateio.pago_em ? ` em ${dataBr(r.rateio.pago_em)}` : ""}`
    : `Pendente${previsto ? `, previsto até ${dataBr(previsto)}` : ""}`;
  const taxa = (ppm: number) => Math.round((aporte * ppm) / 1_000_000);
  const extenso = (iso: string) => `${Number(iso.slice(8, 10))} de ${mesLongo(iso.slice(0, 7)).replace(/ de \d{4}$/, "")}`;

  return (
    <Document title={`Relatório ${mesLongo(f.comp)} · ${f.usina}`} author={e.empresa} subject="Relatório de performance do investidor">
      <Page size="A4" style={s.page}>
        <Topo tipo="RELATÓRIO DE PERFORMANCE UFV" titulo={f.usina} />
        <View style={s.corpo}>
          <View style={[s.tab, { marginBottom: 12 }]}>
            <Linha2 a="Empreendimento" b={[f.usina, [f.cidade, f.uf].filter(Boolean).join(", "), kwp(f.capacidade_wp)].filter(Boolean).join(" · ")} />
            <Linha2 a="Investidor" b={r.investidor.nome} />
            <Linha2 a="Sua cota" b={cota} />
            <Linha2 a="Período" b={perTxt} />
            <Linha2 a="Data de emissão" b={emitido} ultimo />
          </View>

          <Text style={s.secao}>1. SUMÁRIO EXECUTIVO</Text>
          <Text style={{ marginBottom: 6, textAlign: "justify" }}>
            Entre {extenso(per.ini)} e {extenso(per.fim)} de {per.fim.slice(0, 4)}, a {f.usina} registrou geração total de {kwh2(f.geracao_wh)}
            {inteira ? `, média diária de ${kwh2(mediaDia)}.` : `. A sua cota de ${cota} corresponde a ${kwh2(minha)}, média diária de ${kwh2(mediaDia)}.`}
            {x.disponibilidade_ppm != null ? ` No mesmo período, a disponibilidade operacional foi de ${pct(x.disponibilidade_ppm)}.` : ""}
            {performance !== null ? ` A geração ficou em ${num(performance * 100, 1)}% do estimado no projeto.` : ""}
          </Text>
          <Text style={{ marginBottom: 12, textAlign: "justify" }}>
            No resultado econômico do período, a energia {inteira ? "gerada" : "da sua cota"} proporcionou receita de {brl(receita)}.
            {aporte > 0 ? ` Considerando o aporte de ${brl(aporte)}, o valor corresponde a aproximadamente ${pct2(receita, aporte)} do capital investido no ciclo.` : ""}
            {" "}A receita acompanha o volume efetivamente gerado, a disponibilidade da usina e as condições comerciais da energia produzida.
          </Text>

          <Text style={s.secao}>2. INDICADORES DO PERÍODO</Text>
          <View style={s.cards}>
            <Card lbl={inteira ? "Energia gerada" : "Sua energia gerada"} valor={kwh2(minha)} />
            <Card lbl="Média diária" valor={kwh2(mediaDia)} />
            <Card lbl="Disponibilidade" valor={x.disponibilidade_ppm != null ? pct(x.disponibilidade_ppm) : "-"} />
            <Card lbl="Performance vs estimado" valor={performance !== null ? `${num(performance * 100, 1)}%` : "-"} ultimo />
          </View>
          <View style={s.tab}>
            {x.tarifa_kwh ? <Linha2 a="Tarifa contratada" b={tarifaTxt(x.tarifa_kwh)} /> : null}
            <Linha2 a={inteira ? "Receita do período" : "Sua receita do período"} b={brl(receita)} />
            {aporte > 0 ? <Linha2 a="Aporte" b={brl(aporte)} /> : null}
            {aporte > 0 ? <Linha2 a="Retorno sobre o aporte" b={pct2(receita, aporte)} /> : null}
            <Linha2 a="Repasse" b={repasse} ultimo />
          </View>
          {!inteira && (
            <Text style={s.nota}>
              A usina inteira gerou {kwh2(f.geracao_wh)} e teve receita de {brl(f.receita_centavos)} no período. Os seus números são a sua cota ({cota}) desses totais.
            </Text>
          )}

          <Text style={[s.secao, { marginTop: 12 }]}>SOBRE O INVESTIMENTO</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>Perspectiva do investidor: </Text>receita vinculada à produção de energia, exposição a infraestrutura resiliente, baixa correlação com ativos tradicionais e potencial de renda recorrente.</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>Governança e gestão: </Text>monitoramento contínuo, manutenção preventiva, controle de performance e otimização operacional.</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>Riscos monitorados: </Text>oscilações climáticas, indisponibilidade técnica, eventos de rede, mudanças regulatórias e manutenção extraordinária.</Text>
          <Text style={[s.para, { marginBottom: 10 }]}><Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>Classes de ativos: </Text>CDI e renda fixa têm liquidez alta e retorno baixo a moderado; FIIs, dividendos variáveis e volatilidade média; imóveis físicos, baixa liquidez, gestão ativa e vacância; usina solar operacional, receita recorrente, ativo real e gestão profissional.</Text>

        </View>
        <Rodape e={e} emitido={emitido} />
      </Page>

      <Page size="A4" style={s.page}>
        <Topo tipo="RELATÓRIO DE PERFORMANCE UFV" titulo={f.usina} />
        <View style={s.corpo}>
          {aporte > 0 && (
            <>
              <Text style={s.secao}>3. O SEU RETORNO VS OUTROS INVESTIMENTOS</Text>
              <Comparativo itens={[
                { nome: "Usina solar (você)", valor: receita, cor: "#0d5c3a" },
                { nome: "CDI / CDB 100% CDI", valor: taxa(e.cdiPeriodo), cor: C.navy },
                { nome: "FIIs (média)", valor: taxa(e.fiiPeriodo), cor: "#46698f" },
                { nome: "Poupança", valor: taxa(e.poupancaPeriodo), cor: "#8a9099" },
              ]} />
              <Text style={[s.nota, { marginBottom: 12 }]}>
                Quanto o mesmo aporte ({brl(aporte)}) teria rendido no período: CDI {taxaTxt(e.cdiPeriodo)}, FIIs {taxaTxt(e.fiiPeriodo)}, poupança {taxaTxt(e.poupancaPeriodo)}. Taxas de referência informadas pela {e.empresa}.
              </Text>
            </>
          )}

          <Text style={s.secao}>{aporte > 0 ? "4" : "3"}. SUA RECEITA NOS ÚLTIMOS MESES</Text>
          <Grafico dados={r.historico} />
          <View style={s.tab}>
            <View style={s.th}>
              <Text style={[s.thTxt, { flex: 2 }]}>Mês (últimos 6)</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>{inteira ? "Geração" : "Sua geração"}</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Receita</Text>
            </View>
            {[...r.historico].reverse().slice(0, 6).map((h, i, l) => (
              <View key={h.comp} style={[s.tr, i === l.length - 1 ? s.trUlt : {}]}>
                <Text style={{ flex: 2 }}>{mesLongo(h.comp)}</Text>
                <Text style={[s.dir, { flex: 2 }]}>{kwh2(h.geracao_wh)}</Text>
                <Text style={[s.dir, { flex: 2 }]}>{brl(h.receita_centavos)}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.nota, { marginTop: -8, marginBottom: 12 }]}>Seu acumulado nesta usina: {brl(r.acumulado_centavos)}.</Text>

          <Text style={s.secao}>{aporte > 0 ? "5" : "4"}. DADOS PARA O PAGAMENTO</Text>
          <View style={s.tab}>
            {x.conta ? <Linha2 a="Conta" b={`${x.conta.banco} · Ag. ${x.conta.agencia} · C/C ${x.conta.conta}`} /> : null}
            {x.pix ? <Linha2 a="Chave Pix" b={x.pix} /> : null}
            {!x.conta && !x.pix ? <Linha2 a="Conta" b="Não informada. Cadastre no app, em Perfil, Dados bancários." /> : null}
            <Linha2 a="Favorecido" b={r.investidor.nome} ultimo />
          </View>

          <Text style={s.nota}>
            Relatório emitido pela {(e.razaoSocial || e.empresa)}, com o mês fechado pela equipe em {dataBr(f.fechado_em)}. Valores passados não garantem resultados futuros. Dúvidas: fale com a {e.empresa} pelos canais abaixo ou pelo app.
          </Text>
        </View>
        <Rodape e={e} emitido={emitido} />
      </Page>
    </Document>
  );
}

export function RelatorioFechamentoPdf({ r }: { r: RelatorioFechamento }) {
  const f = r.fechamento;
  const pendentes = r.linhas.filter((l) => l.repasse_status === "pendente").length;
  return (
    <Document title={`Fechamento ${mesLongo(f.comp)} · ${f.usina}`} author={r.empresa.empresa} subject="Rateio mensal da usina">
      <Page size="A4" style={s.page}>
        <Topo tipo="RATEIO MENSAL DA USINA" titulo={`${f.usina} · ${mesAbrev(f.comp)}/${f.comp.slice(0, 4)}`} />
        <View style={s.corpo}>
          <View style={s.cards}>
            <Card lbl="Geração do mês" valor={kwh(f.geracao_wh)} />
            <Card lbl="Receita distribuída" valor={brl(f.receita_centavos)} />
            <Card lbl="Cotistas" valor={String(r.linhas.length)} />
            <Card lbl="Repasses pendentes" valor={String(pendentes)} ultimo />
          </View>
          <Text style={s.para}>
            {[f.cidade, f.uf].filter(Boolean).join(", ")}{f.cidade || f.uf ? " · " : ""}{kwp(f.capacidade_wp)} · período {periodoTexto(f.comp, r.empresa.inicioPeriodo)} · fechado em {dataBr(f.fechado_em)}{f.quem ? ` por ${f.quem}` : ""}
          </Text>
          <Text style={[s.secao, { marginTop: 12 }]}>RATEIO POR COTA</Text>
          <View style={s.tab}>
            <View style={s.th} fixed>
              <Text style={[s.thTxt, { flex: 3 }]}>Investidor</Text>
              <Text style={[s.thTxt, s.dir, { flex: 1.2 }]}>Cota</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Geração</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Receita</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Repasse</Text>
            </View>
            {r.linhas.map((l, i) => (
              <View key={i} style={[s.tr, i === r.linhas.length - 1 ? s.trUlt : {}]} wrap={false}>
                <Text style={{ flex: 3 }}>{l.nome}</Text>
                <Text style={[s.dir, { flex: 1.2 }]}>{pct(l.cota_ppm)}</Text>
                <Text style={[s.dir, { flex: 2 }]}>{kwh(l.geracao_wh)}</Text>
                <Text style={[s.dir, { flex: 2 }]}>{brl(l.receita_centavos)}</Text>
                <View style={{ flex: 2, alignItems: "flex-end" }}><Repasse status={l.repasse_status} pago={l.pago_em} /></View>
              </View>
            ))}
          </View>
          <Text style={s.nota}>Documento interno da {r.empresa.empresa}: contém dados de todos os cotistas da usina.</Text>
        </View>
        <Rodape e={r.empresa} emitido={dataBr(new Date())} />
      </Page>
    </Document>
  );
}

export const pdfInvestidor = (r: RelatorioInvestidor) => renderToBuffer(<RelatorioInvestidorPdf r={r} />);
export const pdfFechamento = (r: RelatorioFechamento) => renderToBuffer(<RelatorioFechamentoPdf r={r} />);

export function respostaPdf(buf: Buffer, nome: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
