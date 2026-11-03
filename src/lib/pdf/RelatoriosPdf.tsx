// Relatórios em PDF com a identidade da HAV Energia (Plus): logo, azul-marinho
// e dourado do sistema. Fonte Helvetica embutida no leitor de PDF (cobre os
// acentos do português), sem arquivo de fonte para carregar.
import path from "node:path";
import { readFileSync } from "node:fs";
import { Document, Image, Page, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { cnpjFormatado } from "../cpf";
import { brl, dataBr, kwh, kwp, mesAbrev, mesLongo, pct } from "../format";
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

export function RelatorioInvestidorPdf({ r }: { r: RelatorioInvestidor }) {
  const f = r.fechamento;
  const emitido = dataBr(new Date());
  return (
    <Document title={`Relatório ${mesLongo(f.comp)} · ${f.usina}`} author={r.empresa.empresa} subject="Relatório mensal do investidor">
      <Page size="A4" style={s.page}>
        <Topo tipo="RELATÓRIO MENSAL DO INVESTIDOR" titulo={mesLongo(f.comp).replace(/^./, (c) => c.toUpperCase())} />
        <View style={s.corpo}>
          <Text style={s.para}>Investidor</Text>
          <Text style={s.nome}>{r.investidor.nome}</Text>

          <View style={s.hero}>
            <View>
              <Text style={s.heroLbl}>SUA RECEITA PROPORCIONAL NO MÊS</Text>
              <Text style={s.heroValor}>{brl(r.rateio.receita_centavos)}</Text>
              <Text style={s.heroSub}>{f.usina} · cota de {pct(r.rateio.cota_ppm)}</Text>
            </View>
            <View style={{ alignItems: "flex-end", justifyContent: "flex-end" }}>
              <Text style={s.heroLbl}>REPASSE</Text>
              <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: r.rateio.repasse_status === "pago" ? "#7ee2a8" : C.gold }}>
                {r.rateio.repasse_status === "pago" ? `Pago${r.rateio.pago_em ? ` em ${dataBr(r.rateio.pago_em)}` : ""}` : "Pendente"}
              </Text>
            </View>
          </View>

          <View style={s.cards}>
            <Card lbl="Sua geração proporcional" valor={kwh(r.rateio.geracao_wh)} />
            <Card lbl="Geração total da usina" valor={kwh(f.geracao_wh)} />
            <Card lbl="Receita total da usina" valor={brl(f.receita_centavos)} />
            <Card lbl="Seu acumulado nesta usina" valor={brl(r.acumulado_centavos)} ultimo />
          </View>

          <Text style={s.secao}>SUA RECEITA NOS ÚLTIMOS MESES · {f.usina.toUpperCase()}</Text>
          <Grafico dados={r.historico} />

          <View style={s.tab}>
            <View style={s.th}>
              <Text style={[s.thTxt, { flex: 2 }]}>Mês (últimos 6)</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Geração proporcional</Text>
              <Text style={[s.thTxt, s.dir, { flex: 2 }]}>Receita</Text>
            </View>
            {[...r.historico].reverse().slice(0, 6).map((h, i, l) => (
              <View key={h.comp} style={[s.tr, i === l.length - 1 ? s.trUlt : {}]}>
                <Text style={{ flex: 2 }}>{mesLongo(h.comp)}</Text>
                <Text style={[s.dir, { flex: 2 }]}>{kwh(h.geracao_wh)}</Text>
                <Text style={[s.dir, { flex: 2 }]}>{brl(h.receita_centavos)}</Text>
              </View>
            ))}
          </View>

          <Text style={s.secao}>A USINA</Text>
          <View style={s.cards}>
            <Card lbl="Usina" valor={f.usina} />
            <Card lbl="Local" valor={[f.cidade, f.uf].filter(Boolean).join(", ") || "-"} />
            <Card lbl="Capacidade instalada" valor={kwp(f.capacidade_wp)} ultimo />
          </View>
          <Text style={s.nota}>
            A receita proporcional é a receita da usina no mês multiplicada pela sua cota, registrada quando a equipe fechou o mês ({dataBr(f.fechado_em)}).
            Valores passados não garantem resultados futuros. Dúvidas: fale com a {r.empresa.empresa} pelos canais abaixo ou pelo app.
          </Text>
        </View>
        <Rodape e={r.empresa} emitido={emitido} />
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
            {[f.cidade, f.uf].filter(Boolean).join(", ")}{f.cidade || f.uf ? " · " : ""}{kwp(f.capacidade_wp)} · fechado em {dataBr(f.fechado_em)}{f.quem ? ` por ${f.quem}` : ""}
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
