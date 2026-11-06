// Relatórios em PDF com a identidade da HAV Energia (Plus): logo, azul-marinho
// e dourado do sistema. Fonte Helvetica embutida no leitor de PDF (cobre os
// acentos do português), sem arquivo de fonte para carregar.
import path from "node:path";
import { readFileSync } from "node:fs";
import { Document, Image, Line, Page, Polyline, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { cnpjFormatado } from "../cpf";
import { brl, brl0, dataBr, kwh, kwp, mesAbrev, mesLongo, num, pct, periodo, periodoTexto, receitaPorTarifa, tarifaTxt } from "../format";
import { previsaoRepasse } from "../acompanhamento";
import type { RelatorioFechamento, RelatorioInvestidor } from "../relatorios";
import type { Settings } from "../settings";

// Lido como bytes: o leitor de imagem do react-pdf falha com caminho com acento
// (a pasta do projeto pode ficar em C:/Users/André/...).
let logo: { data: Buffer; format: "png" } | null = null;
const LOGO = () => (logo ??= { data: readFileSync(path.join(process.cwd(), "public", "logo-hav.png")), format: "png" });
const C = { navy: "#0f2742", navy3: "#1d3c5c", gold: "#f0a93a", goldBar: "#d4870f", ink: "#142033", muted: "#364353", faint: "#4f5b69", line: "#d9dfe6", grade: "#e4e8ee", bg: "#f5f7f9", ok: "#1f9d55", okBg: "#e9f8ef", warn: "#c77e12", warnBg: "#fff4e2" };

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, paddingBottom: 66, lineHeight: 1.4 },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 36, paddingTop: 22, paddingBottom: 10 },
  logo: { width: 112, height: 57 },
  topoDir: { alignItems: "flex-end" },
  tipo: { fontSize: 8, color: C.muted, letterSpacing: 1.2, fontFamily: "Helvetica-Bold" },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 3 },
  faixa: { height: 5, backgroundColor: C.navy, flexDirection: "row" },
  faixaOuro: { width: 90, backgroundColor: C.gold },
  corpo: { paddingHorizontal: 36, paddingTop: 18 },
  para: { fontSize: 9.5, color: C.ink, marginBottom: 2 },
  nome: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  hero: { backgroundColor: C.navy, borderRadius: 10, padding: 16, marginBottom: 14, flexDirection: "row", justifyContent: "space-between" },
  heroLbl: { fontSize: 7.5, color: "#b7c6d8", letterSpacing: 0.8, marginBottom: 4 },
  heroValor: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff", lineHeight: 1.15 },
  heroSub: { fontSize: 8.5, color: "#c3d0de", marginTop: 6 },
  cards: { flexDirection: "row", marginBottom: 14 },
  card: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginRight: 8 },
  cardUlt: { marginRight: 0 },
  cardLbl: { fontSize: 8, color: C.muted, marginBottom: 3, fontFamily: "Helvetica-Bold" },
  cardValor: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.navy },
  secao: { fontSize: 13, color: C.navy, marginTop: 8, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  subTit: { fontSize: 8, color: C.muted, letterSpacing: 0.8, fontFamily: "Helvetica-Bold", textAlign: "center" },
  bullet: { fontSize: 9.5, marginBottom: 1.5, paddingLeft: 6 },
  tab: { borderWidth: 1, borderColor: C.line, borderRadius: 8, marginBottom: 14 },
  th: { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6, paddingHorizontal: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5, paddingHorizontal: 8 },
  trUlt: { borderBottomWidth: 0 },
  thTxt: { fontSize: 7.5, color: C.ink, fontFamily: "Helvetica-Bold" },
  dir: { textAlign: "right" },
  pillOk: { color: C.ok, fontFamily: "Helvetica-Bold" },
  pillWarn: { color: C.warn, fontFamily: "Helvetica-Bold" },
  nota: { fontSize: 8, color: C.muted, marginTop: 4, lineHeight: 1.45 },
  rodape: { position: "absolute", bottom: 16, left: 36, right: 36, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, alignItems: "center", fontSize: 7.5, color: C.muted, lineHeight: 1.35 },
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

// Rodapé do relatório que a HAV fazia: nome e slogan, sede, CNPJ e contatos.
const fone = (w: string) => {
  const d = w.startsWith("55") ? w.slice(2) : w;
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : w;
};
function Rodape({ e }: { e: Settings; emitido?: string }) {
  const nome = (e.razaoSocial || e.empresa).toUpperCase();
  const l2 = [e.endereco, e.cnpj && `CNPJ ${cnpjFormatado(e.cnpj)}`, e.suporteWhatsapp && `Telefone / WhatsApp: ${fone(e.suporteWhatsapp)}`].filter(Boolean).join("  |  ");
  const l3 = [e.suporteEmail && `E-mail: ${e.suporteEmail}`, e.instagram && `Instagram: ${e.instagram}`].filter(Boolean).join("  |  ");
  return (
    <View style={s.rodape} fixed>
      <Text><Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{nome}</Text>{e.slogan ? `  |  ${e.slogan}` : ""}</Text>
      {l2 ? <Text>{l2}</Text> : null}
      {l3 ? <Text>{l3}</Text> : null}
    </View>
  );
}

function Card({ lbl, valor, ultimo }: { lbl: string; valor: string; ultimo?: boolean }) {
  return <View style={[s.card, ultimo ? s.cardUlt : {}]}><Text style={s.cardLbl}>{lbl}</Text><Text style={s.cardValor}>{valor}</Text></View>;
}

function Repasse({ status, pago }: { status: string; pago: Date | null }) {
  return status === "pago" ? <Text style={s.pillOk}>Pago{pago ? ` em ${dataBr(pago)}` : ""}</Text> : <Text style={s.pillWarn}>Pendente</Text>;
}

// Escala "redonda" para o eixo: até 5 linhas de grade com passos 1, 2, 2,5 ou 5.
function escala(max: number, linhas = 4) {
  if (max <= 0) return { topo: 1, passo: 0.25 };
  const bruto = max / linhas;
  const p10 = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((v) => v >= bruto) ?? 10 * p10;
  return { topo: passo * Math.ceil(max / passo - 1e-9), passo };
}

type Serie = { valores: number[]; cor: string; fmt: (v: number) => string; titulo: string };

// Gráfico com eixo à esquerda (barras) e, se houver, à direita (linha), linhas de
// grade e o nome de cada coluna embaixo, como o gráfico de monitoramento do
// relatório da HAV. Rótulos de valor em cima das barras são opcionais.
function GraficoEixos({ rotulos, barras, linha, altura = 150, valorNaBarra, destaqueUltima, cada = 1, cores }: {
  rotulos: string[]; barras: Serie; linha?: Serie; altura?: number; valorNaBarra?: boolean; destaqueUltima?: boolean; cada?: number; cores?: string[];
}) {
  const W = 523, E = 50, D = linha ? 50 : 8, T = valorNaBarra ? 16 : 8, B = 20;
  const pw = W - E - D, ph = altura - T - B;
  const n = Math.max(rotulos.length, 1), passo = pw / n, larg = Math.min(60, passo * 0.62);
  const eb = escala(Math.max(...barras.valores, 0));
  const nt = Math.round(eb.topo / eb.passo);
  // A linha fica na ponta das barras: a receita é proporcional à geração
  // (geração x valor do kWh), então o eixo da direita é o da esquerda vezes essa
  // proporção. Assim cada ponto cai no topo da sua barra e as linhas de grade valem
  // para os dois lados.
  const somaB = barras.valores.reduce((a, v) => a + v, 0), somaL = linha ? linha.valores.reduce((a, v) => a + v, 0) : 0;
  const topoL = linha && somaB > 0 && somaL > 0 ? eb.topo * (somaL / somaB) : 1;
  const yb = (v: number) => T + ph - (v / eb.topo) * ph;
  const yl = (v: number) => T + ph - (v / topoL) * ph;
  const ticks = Array.from({ length: nt + 1 }, (_, i) => i);
  const yt = (i: number) => T + ph - (i / nt) * ph;
  const lbl = { position: "absolute" as const, fontSize: 7, color: C.muted };
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <View style={{ width: W, height: altura, position: "relative" }}>
        <Svg width={W} height={altura} style={{ position: "absolute", top: 0, left: 0 }}>
          {ticks.map((i) => <Line key={i} x1={E} x2={W - D} y1={yt(i)} y2={yt(i)} stroke={i === 0 ? C.faint : C.grade} strokeWidth={i === 0 ? 0.8 : 0.6} />)}
          <Line x1={E} x2={E} y1={T} y2={T + ph} stroke={C.faint} strokeWidth={0.6} />
          {linha ? <Line x1={W - D} x2={W - D} y1={T} y2={T + ph} stroke={C.faint} strokeWidth={0.6} /> : null}
          {barras.valores.map((v, i) => (
            <Rect key={i} x={E + passo * i + (passo - larg) / 2} y={yb(v)} width={larg} height={Math.max(0.5, T + ph - yb(v))}
              fill={cores?.[i] ?? (destaqueUltima && i === n - 1 ? C.navy : barras.cor)} />
          ))}
          {linha && linha.valores.length > 1 ? (
            <Polyline points={linha.valores.map((v, i) => `${E + passo * i + passo / 2},${yl(v)}`).join(" ")} fill="none" stroke={linha.cor} strokeWidth={1.3} />
          ) : null}
          {linha ? linha.valores.map((v, i) => <Rect key={`p${i}`} x={E + passo * i + passo / 2 - 1.5} y={yl(v) - 1.5} width={3} height={3} fill={linha.cor} />) : null}
        </Svg>
        {ticks.map((i) => (
          <View key={`t${i}`} style={{ position: "absolute", top: yt(i) - 4, left: 0, width: W }}>
            <Text style={[lbl, { top: 0, left: 0, width: E - 5, textAlign: "right" }]}>{barras.fmt(i * eb.passo)}</Text>
            {linha ? <Text style={[lbl, { top: 0, left: W - D + 5, width: D - 5 }]}>{linha.fmt(i * (topoL / nt))}</Text> : null}
          </View>
        ))}
        {valorNaBarra ? barras.valores.map((v, i) => (
          <Text key={`v${i}`} style={[lbl, { top: yb(v) - 11, left: E + passo * i - 4, width: passo + 8, textAlign: "center", fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 7.5 }]}>{barras.fmt(v)}</Text>
        )) : null}
        {rotulos.map((r, i) => (i % cada === 0 ? (
          <Text key={`r${i}`} style={[lbl, { top: T + ph + 5, left: E + passo * i - 8, width: passo + 16, textAlign: "center" }]}>{r}</Text>
        ) : null))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 2 }}>
        {!cores ? <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}><View style={{ width: 8, height: 8, backgroundColor: barras.cor, marginRight: 4 }} /><Text style={{ fontSize: 7.5, color: C.muted }}>{barras.titulo}</Text></View> : null}
        {linha ? <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ width: 12, height: 1.6, backgroundColor: linha.cor, marginRight: 4 }} /><Text style={{ fontSize: 7.5, color: C.muted }}>{linha.titulo}</Text></View> : null}
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

// "Brasília, 28 de setembro de 2026.", como no fecho do relatório da HAV.
const dataExtenso = (d: Date) => {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return `${Number(iso.slice(8, 10))} de ${mesLongo(iso.slice(0, 7))}`;
};

// Fecho do relatório: cidade e data de emissão, quem responde por ele e a empresa.
function Assinatura({ e }: { e: Settings }) {
  return (
    <View style={{ marginTop: 18 }} wrap={false}>
      {/* Espaço para a assinatura (à mão ou o carimbo da assinatura digital, como no modelo da HAV). */}
      <Text style={{ textAlign: "right", marginBottom: 78 }}>{e.cidade ? `${e.cidade}, ` : ""}{dataExtenso(new Date())}.</Text>
      <View style={{ alignItems: "center" }}>
        {e.responsavel ? <View style={{ width: 200, borderTopWidth: 1, borderTopColor: C.ink, marginBottom: 3 }} /> : null}
        {e.responsavel ? <Text style={{ fontFamily: "Helvetica-Bold" }}>{e.responsavel}</Text> : null}
        {e.responsavelCargo ? <Text style={{ fontSize: 8.5, color: C.muted }}>{e.responsavelCargo}</Text> : null}
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 4 }}>{(e.razaoSocial || e.empresa).toUpperCase()}</Text>
      </View>
    </View>
  );
}

type Dia = { n: number; data: string; dataLonga: string; wh: number; horas: number; receita: number | null };
function diasDoRelatorio(r: RelatorioInvestidor): Dia[] {
  const ppm = r.rateio.cota_ppm, tarifa = r.extra.tarifa_kwh, cap = r.fechamento.capacidade_wp;
  return r.dias.map((d, i) => {
    const wh = Math.floor((d.geracao_wh * ppm) / 1_000_000);
    return {
      n: i + 1,
      data: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`,
      dataLonga: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}/${d.dia.slice(0, 4)}`,
      wh,
      // Horas de geração (full load hours) = geração da usina no dia / capacidade: igual para todos os cotistas.
      horas: cap ? d.geracao_wh / cap : 0,
      receita: tarifa ? receitaPorTarifa(wh, tarifa) : null,
    };
  });
}

// Página de geração diária, no modelo da HAV: tabela em duas colunas e os totais.
function PaginaDias({ r, perTxt }: { r: RelatorioInvestidor; perTxt: string }) {
  const ppm = r.rateio.cota_ppm;
  const tarifa = r.extra.tarifa_kwh;
  const linhas = diasDoRelatorio(r);
  const total = linhas.reduce((a, l) => a + l.wh, 0);
  const metade = Math.ceil(linhas.length / 2);
  const Coluna = ({ itens }: { itens: Dia[] }) => (
    <View style={[s.tab, { flex: 1, marginRight: 6 }]}>
      <View style={[s.th, { backgroundColor: C.navy }]}>
        <Text style={[s.thTxt, { width: 16, color: "#fff" }]}>Nº</Text>
        <Text style={[s.thTxt, { flex: 1.9, color: "#fff" }]}>DATA</Text>
        <Text style={[s.thTxt, s.dir, { flex: 1.8, color: "#fff" }]}>YIELD (kWh)</Text>
        <Text style={[s.thTxt, s.dir, { flex: 1.9, color: "#fff" }]}>FULL LOAD (h)</Text>
        {tarifa ? <Text style={[s.thTxt, s.dir, { flex: 1.7, color: "#fff" }]}>RECEITA</Text> : null}
      </View>
      {itens.map((l, k) => (
        <View key={l.n} style={[s.tr, { paddingVertical: 2.6, backgroundColor: k % 2 ? C.bg : "#fff" }, k === itens.length - 1 ? s.trUlt : {}]}>
          <Text style={{ width: 16, fontSize: 8 }}>{l.n}</Text>
          <Text style={{ flex: 1.9, fontSize: 8 }}>{l.dataLonga}</Text>
          <Text style={[s.dir, { flex: 1.8, fontSize: 8 }]}>{casas(l.wh / 1000, 3, 3)}</Text>
          <Text style={[s.dir, { flex: 1.9, fontSize: 8 }]}>{casas(l.horas, 3, 3)}</Text>
          {l.receita !== null ? <Text style={[s.dir, { flex: 1.7, fontSize: 8 }]}>{brl(l.receita)}</Text> : null}
        </View>
      ))}
    </View>
  );
  return (
    <Page size="A4" style={s.page}>
      <Topo tipo="RELATÓRIO DE PERFORMANCE UFV" titulo={r.fechamento.usina} />
      <View style={s.corpo}>
        <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: C.navy, textAlign: "center" }}>GERAÇÃO DIÁRIA DE ENERGIA</Text>
        <Text style={{ textAlign: "center", marginTop: 2 }}>Período: {perTxt}  |  Total do Período: {kwh2(total)}</Text>
        <Text style={{ textAlign: "center", fontSize: 7.5, color: C.muted, marginBottom: 8 }}>
          {ppm >= 1_000_000 ? "Geração da usina" : `Sua parte (${pct(ppm)}) da geração da usina`}, com os dados do app de monitoramento dos inversores.
        </Text>
        <View style={{ flexDirection: "row" }}>
          <Coluna itens={linhas.slice(0, metade)} />
          <Coluna itens={linhas.slice(metade)} />
        </View>
        <View style={s.cards}>
          <Card lbl="GERAÇÃO TOTAL" valor={kwh2(total)} />
          <Card lbl="DIAS DO PERÍODO" valor={`${linhas.length} dias`} />
          <Card lbl="MÉDIA DIÁRIA" valor={kwh2(Math.round(total / Math.max(1, linhas.length)))} />
          <Card lbl="MÉDIA FULL LOAD" valor={`${casas(linhas.reduce((a, l) => a + l.horas, 0) / Math.max(1, linhas.length), 2, 2)} h/dia`} ultimo={!tarifa} />
          {tarifa ? <Card lbl="RECEITA" valor={brl(linhas.reduce((a, l) => a + (l.receita ?? 0), 0))} ultimo /> : null}
        </View>
        {tarifa ? <Text style={s.nota}>A receita de cada dia é a geração do dia x {tarifaTxt(tarifa)}. A soma dos dias pode diferir alguns centavos do valor oficial do período, que é calculado sobre o total.</Text> : null}
        <Assinatura e={r.empresa} />
      </View>
      <Rodape e={r.empresa} />
    </Page>
  );
}

const Bullet = ({ children }: { children: string }) => <Text style={s.bullet}>•  {children}</Text>;
const Rotulo = ({ a, b }: { a: string; b: string }) => <Text style={{ marginBottom: 1.5, paddingLeft: 6 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>{a}: </Text>{b}</Text>;

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
  const dias = diasDoRelatorio(r);
  const kwhEixo = (wh: number) => num(wh / 1000, wh < 10_000 ? 1 : 0);
  const reais = (c: number) => (c >= 100_000 ? brl0(c) : brl(c));
  const hist = r.historico;
  let n = 7;

  return (
    <Document title={`Relatório ${mesLongo(f.comp)} · ${f.usina}`} author={e.empresa} subject="Relatório de performance do investidor">
      <Page size="A4" style={s.page}>
        <Topo tipo="RELATÓRIO DE PERFORMANCE UFV" titulo={f.usina} />
        <View style={s.corpo}>
          <View style={[s.tab, { marginBottom: 10 }]}>
            <Linha2 a="Empreendimento" b={[f.usina, [f.cidade, f.uf].filter(Boolean).join(", "), kwp(f.capacidade_wp)].filter(Boolean).join(" · ")} />
            <Linha2 a="Investidor" b={r.investidor.nome} />
            <Linha2 a="Cota" b={cota} />
            <Linha2 a="Período" b={perTxt} />
            <Linha2 a="Data de Emissão" b={emitido} ultimo />
          </View>

          <Text style={s.secao}>1. Sumário Executivo</Text>
          <Text style={{ marginBottom: 6, textAlign: "justify" }}>
            Entre {extenso(per.ini)} e {extenso(per.fim)} de {per.fim.slice(0, 4)}, a {f.usina} registrou geração total de {kwh2(f.geracao_wh)}
            {inteira ? `, equivalente a uma média diária de ${kwh2(mediaDia)}.` : `. A sua cota de ${cota} corresponde a ${kwh2(minha)}, equivalente a uma média diária de ${kwh2(mediaDia)}.`}
            {x.disponibilidade_ppm != null ? ` No mesmo período, a disponibilidade operacional atingiu ${pct(x.disponibilidade_ppm)}` : ""}
            {performance !== null ? `${x.disponibilidade_ppm != null ? " e" : " A"} geração ficou em ${num(performance * 100, 1)}% do estimado no projeto.` : x.disponibilidade_ppm != null ? "." : ""}
            {" "}Esses indicadores consolidam o comportamento técnico do ativo no ciclo analisado e servem de base para o acompanhamento das condições de operação.
          </Text>
          <Text style={{ marginBottom: 6, textAlign: "justify" }}>
            No resultado econômico do período, a energia {inteira ? "gerada" : "da sua cota"} proporcionou receita de {brl(receita)}.
            {aporte > 0 ? ` Considerando o aporte de ${brl(aporte)}, o valor corresponde a aproximadamente ${pct2(receita, aporte)} do capital investido no ciclo.` : ""}
            {" "}A evolução da receita permanece diretamente relacionada ao volume efetivamente gerado, à disponibilidade da usina e às condições comerciais aplicáveis à energia produzida.
          </Text>

          <Text style={s.secao}>2. Dashboard de Indicadores-Chave</Text>
          <View style={s.cards}>
            <Card lbl={inteira ? "Energia Gerada" : "Sua Energia Gerada"} valor={kwh2(minha)} />
            <Card lbl="Média Diária" valor={kwh2(mediaDia)} />
            <Card lbl="Disponibilidade" valor={x.disponibilidade_ppm != null ? pct(x.disponibilidade_ppm) : "-"} />
            <Card lbl="Performance vs Estimado" valor={performance !== null ? `${num(performance * 100, 1)}%` : "-"} ultimo />
          </View>
          <View style={s.tab}>
            {x.tarifa_aferida ? <Linha2 a="Tarifa Aferida" b={tarifaTxt(x.tarifa_aferida)} /> : null}
            {x.tarifa_kwh ? <Linha2 a="Tarifa Contratada" b={tarifaTxt(x.tarifa_kwh)} /> : null}
            <Linha2 a="Receita do Período" b={brl(receita)} />
            {aporte > 0 ? <Linha2 a="Aporte" b={brl(aporte)} /> : null}
            {aporte > 0 ? <Linha2 a="Retorno sobre o aporte" b={pct2(receita, aporte)} /> : null}
            <Linha2 a="Repasse" b={repasse} ultimo />
          </View>
          {!inteira && (
            <Text style={[s.nota, { marginTop: -8 }]}>
              A usina inteira gerou {kwh2(f.geracao_wh)} e teve receita de {brl(f.receita_centavos)} no período. Os seus números são a sua cota ({cota}) desses totais.
            </Text>
          )}
        </View>
        <Rodape e={e} />
      </Page>

      <Page size="A4" style={s.page}>
        <Topo tipo="RELATÓRIO DE PERFORMANCE UFV" titulo={f.usina} />
        <View style={s.corpo}>
          <Text style={s.secao}>3. Perspectiva do Investidor</Text>
          <Bullet>Receita vinculada à produção de energia</Bullet>
          <Bullet>Exposição a infraestrutura resiliente</Bullet>
          <Bullet>Baixa correlação com ativos tradicionais</Bullet>
          <Bullet>Potencial de renda recorrente</Bullet>

          <Text style={s.secao}>4. Governança & Gestão</Text>
          <Text style={{ paddingLeft: 6 }}>Monitoramento contínuo, manutenção preventiva, controle de performance e otimização operacional.</Text>

          <Text style={s.secao}>5. Riscos Monitorados</Text>
          <Text style={{ paddingLeft: 6 }}>Oscilações climáticas, indisponibilidade técnica, eventos de rede, mudanças regulatórias e manutenção extraordinária.</Text>

          <Text style={s.secao}>6. Comparativo Estratégico de Classe de Ativos</Text>
          <Rotulo a="CDI/Renda Fixa" b="liquidez alta, retorno baixo a moderado." />
          <Rotulo a="FIIs" b="dividendos variáveis, volatilidade média." />
          <Rotulo a="Imóveis Físicos" b="baixa liquidez, gestão ativa, vacância." />
          <Rotulo a="Usina Solar Operacional" b="receita recorrente, ativo real, gestão profissional." />

          {aporte > 0 && (
            <View wrap={false} style={{ marginTop: 16 }}>
              <Text style={s.subTit}>O RETORNO DO INVESTIDOR VS OUTROS INVESTIMENTOS</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: C.navy, textAlign: "center", marginBottom: 6 }}>COMPARATIVO DE RENTABILIDADE</Text>
              <GraficoEixos
                rotulos={["Usina solar (você)", "CDI / CDB 100% CDI", "FIIs (média)", "Poupança"]}
                barras={{ valores: [receita, taxa(e.cdiPeriodo), taxa(e.fiiPeriodo), taxa(e.poupancaPeriodo)], cor: C.navy, fmt: reais, titulo: "Retorno no período (R$)" }}
                cores={["#0d5c3a", C.navy, "#46698f", "#8a9099"]}
                altura={160}
                valorNaBarra
              />
              <Text style={{ textAlign: "center", fontFamily: "Helvetica-Bold", color: C.navy, fontSize: 9 }}>
                Aporte realizado: {brl(aporte)}  |  Retorno no período: {brl(receita)} ({pct2(receita, aporte)})
              </Text>
              <Text style={[s.nota, { textAlign: "center" }]}>
                Quanto o mesmo aporte teria rendido no período: CDI {taxaTxt(e.cdiPeriodo)}, FIIs {taxaTxt(e.fiiPeriodo)}, poupança {taxaTxt(e.poupancaPeriodo)}. Taxas de referência informadas pela {e.empresa}.
              </Text>
            </View>
          )}
          <Text style={[s.nota, { marginTop: 16 }]}>
            Relatório emitido pela {(e.razaoSocial || e.empresa)}, com o mês fechado pela equipe em {dataBr(f.fechado_em)}. Valores passados não garantem resultados futuros. Dúvidas: fale com a {e.empresa} pelos canais do rodapé ou pelo app.
          </Text>
        </View>
        <Rodape e={e} />
      </Page>

      <Page size="A4" style={s.page}>
        <Topo tipo="RELATÓRIO DE PERFORMANCE UFV" titulo={f.usina} />
        <View style={s.corpo}>
          <Text style={s.secao}>{n++}. Dados Financeiros para Liquidação</Text>
          {x.conta ? <Text style={{ paddingLeft: 6 }}>{x.conta.banco}  |  AG {x.conta.agencia}  |  C/C {x.conta.conta}</Text> : null}
          {x.pix ? <Text style={{ paddingLeft: 6 }}>Chave Pix: {x.pix}</Text> : null}
          {!x.conta && !x.pix ? <Text style={{ paddingLeft: 6, color: C.muted }}>Conta não informada. Cadastre no app, em Perfil, Dados bancários.</Text> : null}
          <Text style={{ paddingLeft: 6, marginTop: 3 }}>Favorecido: {r.investidor.nome}</Text>

          {dias.length > 0 && (
            <>
              <Text style={s.secao}>{n++}. Dados de monitoramento</Text>
              <Text style={[s.subTit, { marginBottom: 4 }]}>DADOS DE MONITORAMENTO: DISTRIBUIÇÃO DIÁRIA{inteira ? "" : ` (SUA COTA, ${cota})`}</Text>
              <GraficoEixos
                rotulos={dias.map((d) => d.data)}
                barras={{ valores: dias.map((d) => d.wh), cor: "#f2c38a", fmt: kwhEixo, titulo: "Geração (kWh)" }}
                linha={x.tarifa_kwh ? { valores: dias.map((d) => d.receita ?? 0), cor: C.goldBar, fmt: (c) => num(c / 100, 0), titulo: "Receita diária (R$)" } : undefined}
                altura={170}
                cada={dias.length > 16 ? 2 : 1}
              />
            </>
          )}

          {hist.length > 0 && (
            <>
              <Text style={s.secao}>{n++}. Sua receita nos últimos meses</Text>
              <GraficoEixos
                rotulos={hist.map((h) => `${mesAbrev(h.comp)}/${h.comp.slice(2, 4)}`)}
                barras={{ valores: hist.map((h) => h.receita_centavos), cor: C.gold, fmt: reais, titulo: "Receita (R$)" }}
                linha={{ valores: hist.map((h) => h.geracao_wh), cor: C.navy, fmt: kwhEixo, titulo: "Geração (kWh)" }}
                altura={150}
                destaqueUltima
              />
              <View style={s.tab}>
                <View style={s.th}>
                  <Text style={[s.thTxt, { flex: 2 }]}>Mês (últimos 4)</Text>
                  <Text style={[s.thTxt, s.dir, { flex: 2 }]}>{inteira ? "Geração" : "Sua geração"}</Text>
                  <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Receita</Text>
                </View>
                {[...hist].reverse().slice(0, 4).map((h, i, l) => (
                  <View key={h.comp} style={[s.tr, i === l.length - 1 ? s.trUlt : {}]}>
                    <Text style={{ flex: 2 }}>{mesLongo(h.comp)}</Text>
                    <Text style={[s.dir, { flex: 2 }]}>{kwh2(h.geracao_wh)}</Text>
                    <Text style={[s.dir, { flex: 2 }]}>{brl(h.receita_centavos)}</Text>
                  </View>
                ))}
              </View>
              <Text style={[s.nota, { marginTop: -8 }]}>Seu acumulado nesta usina: {brl(r.acumulado_centavos)}.</Text>
            </>
          )}

          {dias.length === 0 && <Assinatura e={e} />}
        </View>
        <Rodape e={e} />
      </Page>
      {dias.length > 0 && <PaginaDias r={r} perTxt={perTxt} />}
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
        <Rodape e={r.empresa} />
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
