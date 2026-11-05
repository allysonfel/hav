// Dados de demonstração para apresentar o sistema preenchido (inclusive em produção).
//
// São as usinas e os investidores do protótipo, com 24 meses fechados e a
// captação da Serra Clara. Tudo o que é criado fica anotado em demo_registros;
// "remover" apaga só esses registros e o que nasceu deles (rateios, avisos,
// fila de e-mail), sem tocar nos dados reais. Os investidores fictícios usam
// e-mail @demo.hav.invalid e não têm senha: ninguém entra com eles, e a fila de
// e-mail nunca envia para eles (lib/envios.ts).
import "server-only";
import { sql } from "./db";
import { dividir } from "./rateio";
import { mesAtual, somarMeses } from "./format";

export const EMAIL_DEMO = "@demo.hav.invalid";
type Tabela = "usinas" | "investidores" | "fechamentos" | "interesses";

export async function demoAtiva(): Promise<boolean> {
  const [r] = await sql<{ ok: boolean }[]>`SELECT EXISTS (SELECT 1 FROM demo_registros) AS ok`;
  return r.ok;
}

const USINAS = [
  { nome: "Usina Horizonte Dourado", cidade: "Petrolina", uf: "PE", kwp: 1100, invest: 3_800_000, status: "operando", desde: "2024-03", marca: "Fronius", modelo: "Tauro 100-3-P", qtd: 10, mon: "Fronius Solar.web", ultimo: 142_300, curva: [100, 106, 114, 118, 115, 120], fator: 1 },
  { nome: "Usina Vale do Sol", cidade: "Juazeiro", uf: "BA", kwp: 980, invest: 3_500_000, status: "operando", desde: "2024-07", marca: "Growatt", modelo: "MAX 100KTL3", qtd: 9, mon: "ShinePhone", ultimo: 126_800, curva: [96, 104, 111, 117, 113, 120], fator: 0.97 },
  { nome: "Usina Serra Clara", cidade: "Ouricuri", uf: "PE", kwp: 1050, invest: 3_960_000, status: "captacao", desde: null, marca: "", modelo: "", qtd: 0, mon: "", ultimo: 0, curva: [], fator: 1 },
] as const;

const NOMES: Record<string, string> = {
  "marcos.andrade": "Marcos Andrade", "renata.siqueira": "Renata Siqueira", joaopedro: "João Pedro Alencar", "camila.duarte": "Camila Duarte",
  "felipe.barros": "Felipe Barros", participacoes: "HAV Participações", "patricia.gomes": "Patrícia Gomes", "eduardo.lins": "Eduardo Lins",
  "larissa.monteiro": "Larissa Monteiro", "tiago.rocha": "Tiago Rocha",
};

// Valor investido em reais. Cota = valor / investimento total da usina.
const COTAS: Record<string, Record<string, number>> = {
  "Usina Horizonte Dourado": { "marcos.andrade": 684_000, "renata.siqueira": 836_000, joaopedro: 570_000, "camila.duarte": 760_000, "felipe.barros": 456_000, participacoes: 494_000 },
  "Usina Vale do Sol": { "marcos.andrade": 420_000, "patricia.gomes": 700_000, "eduardo.lins": 1_050_000, "larissa.monteiro": 805_000, participacoes: 525_000 },
  "Usina Serra Clara": { "eduardo.lins": 900_000, "tiago.rocha": 650_000, "larissa.monteiro": 500_000, participacoes: 400_000 },
};

// Peso de cada mês do ano (jan a dez): sol mais forte de setembro a janeiro.
const SAZONAL = [112, 106, 101, 94, 88, 84, 87, 96, 108, 116, 118, 116];

const INTERESSES: [string, string | null, number, string, string, string][] = [
  ["Camila Duarte", "camila.duarte", 150_000, "app", "aguardando", ""],
  ["Igor Nascimento", null, 300_000, "indicacao", "aguardando", "81999990001"],
  ["Beatriz Lemos", null, 220_000, "app", "negociacao", "81999990002"],
  ["Rafael Tenório", null, 180_000, "indicacao", "aguardando", "87999990003"],
  ["Helena Cavalcanti", null, 250_000, "app", "aguardando", "81999990004"],
  ["Otávio Menezes", null, 120_000, "equipe", "negociacao", "87999990005"],
  ["Sofia Queiroz", null, 90_000, "app", "aguardando", "81999990006"],
];

export async function carregarDemo(adminId: number): Promise<void> {
  if (await demoAtiva()) return;
  const ocupados = await sql<{ nome: string }[]>`
    SELECT nome FROM usinas WHERE nome IN ${sql(USINAS.map((u) => u.nome))}
    UNION ALL SELECT email FROM investidores WHERE email LIKE ${"%" + EMAIL_DEMO}`;
  if (ocupados.length) throw new Error(`Já existe um cadastro com nome de demonstração (${ocupados[0].nome}). Renomeie antes de carregar.`);

  await sql.begin(async (tx) => {
    const marca = (tabela: Tabela, id: number) => tx`INSERT INTO demo_registros (tabela, id) VALUES (${tabela}, ${id}) ON CONFLICT DO NOTHING`;
    const atual = mesAtual();
    // Último mês fechado = mês passado; o repasse dele para Felipe Barros fica pendente (como no protótipo).
    const ultimoFechado = somarMeses(atual, -1);

    const inv: Record<string, number> = {};
    for (const [k, nome] of Object.entries(NOMES)) {
      const [i] = await tx<{ id: number }[]>`INSERT INTO investidores (nome, email, relatorio_email) VALUES (${nome}, ${k + EMAIL_DEMO}, false) RETURNING id`;
      inv[k] = i.id;
      await marca("investidores", i.id);
    }

    for (const u of USINAS) {
      const [us] = await tx<{ id: number }[]>`
        INSERT INTO usinas (nome, cidade, uf, capacidade_wp, investimento_centavos, status, operando_desde, inversor_marca, inversor_modelo, inversor_qtd, monitoramento, geracao_esperada_wh)
        VALUES (${u.nome}, ${u.cidade}, ${u.uf}, ${u.kwp * 1000}, ${u.invest * 100}, ${u.status}, ${u.desde ? u.desde + "-01" : null}, ${u.marca}, ${u.modelo}, ${u.qtd}, ${u.mon},
          ${u.status === "operando" ? u.kwp * 125_000 : null})
        RETURNING id`;
      await marca("usinas", us.id);
      const cotas = Object.entries(COTAS[u.nome]).map(([k, valor]) => ({ investidor: inv[k], valor, ppm: Math.round((valor / u.invest) * 1_000_000) }));
      for (const c of cotas) await tx`INSERT INTO cotas (usina_id, investidor_id, cota_ppm, valor_centavos) VALUES (${us.id}, ${c.investidor}, ${c.ppm}, ${c.valor * 100})`;
      if (u.status !== "operando") {
        for (const [nome, k, valor, origem, status, tel] of INTERESSES) {
          const [it] = await tx<{ id: number }[]>`INSERT INTO interesses (usina_id, investidor_id, nome, telefone, valor_centavos, origem, status)
            VALUES (${us.id}, ${k ? inv[k] : null}, ${nome}, ${tel}, ${valor * 100}, ${origem}, ${status}) RETURNING id`;
          await marca("interesses", it.id);
        }
        continue;
      }

      const ppms = cotas.map((c) => c.ppm);
      for (let m = 24; m >= 1; m--) {
        const comp = somarMeses(atual, -m);
        if (u.desde && comp < u.desde) continue;
        const mes = Number(comp.slice(5, 7)) - 1;
        const kwh = m <= 6
          ? Math.round(u.ultimo * (u.curva[6 - m] / 120))
          : Math.round(u.ultimo * (SAZONAL[mes] / SAZONAL[Number(ultimoFechado.slice(5, 7)) - 1]) * (m > 12 ? 0.94 : 0.98) * (1 + (((m * (u.nome.length + 3)) % 9) - 4) / 100) * u.fator);
        const wh = kwh * 1000;
        const centavos = kwh * 50; // R$ 0,50 por kWh, como no protótipo
        const fechadoEm = new Date(`${somarMeses(comp, 1)}-02T12:00:00-03:00`);
        const [f] = await tx<{ id: number }[]>`
          INSERT INTO fechamentos (usina_id, competencia, geracao_wh, receita_centavos, status, lancado_por, fechado_por, lancado_em, fechado_em)
          VALUES (${us.id}, ${comp + "-01"}, ${wh}, ${centavos}, 'fechado', ${adminId}, ${adminId}, ${fechadoEm}, ${fechadoEm}) RETURNING id`;
        await marca("fechamentos", f.id);
        const g = dividir(wh, ppms);
        const r = dividir(centavos, ppms);
        for (let i = 0; i < cotas.length; i++) {
          const pendente = m === 1 && cotas[i].investidor === inv["felipe.barros"];
          const pagoEm = new Date(fechadoEm.getTime() + 3 * 86_400_000);
          await tx`
            INSERT INTO rateios (fechamento_id, investidor_id, cota_ppm, geracao_wh, receita_centavos, repasse_status, pago_em, pago_por)
            VALUES (${f.id}, ${cotas[i].investidor}, ${ppms[i]}, ${g[i]}, ${r[i]}, ${pendente ? "pendente" : "pago"}, ${pendente ? null : pagoEm}, ${pendente ? null : adminId})`;
        }
      }
    }
  });
}

// Apaga a demonstração: os registros anotados e tudo o que depende deles.
// Cadastro real ligado à demonstração (ex.: cota real numa usina fictícia) faz a
// transação falhar pela chave estrangeira: nada é apagado e a tela avisa.
export async function removerDemo(): Promise<void> {
  await sql.begin(async (tx) => {
    const ids = async (t: Tabela) => (await tx<{ id: number }[]>`SELECT id FROM demo_registros WHERE tabela = ${t}`).map((x) => Number(x.id));
    const U = (await ids("usinas")).concat(0), I = (await ids("investidores")).concat(0), IT = (await ids("interesses")).concat(0);
    // Fechamentos das usinas fictícias, inclusive os lançados durante a apresentação.
    const F = (await tx<{ id: number }[]>`SELECT id FROM fechamentos WHERE usina_id IN ${tx(U)}`).map((x) => x.id).concat(0);
    await tx`DELETE FROM envios_email WHERE fechamento_id IN ${tx(F)} OR investidor_id IN ${tx(I)}`;
    await tx`DELETE FROM rateios WHERE fechamento_id IN ${tx(F)}`;
    await tx`DELETE FROM fechamentos WHERE id IN ${tx(F)}`;
    await tx`DELETE FROM interesses WHERE id IN ${tx(IT)} OR (usina_id IN ${tx(U)} AND investidor_id IN ${tx(I)})`;
    await tx`DELETE FROM cotas WHERE usina_id IN ${tx(U)} AND investidor_id IN ${tx(I)}`;
    await tx`DELETE FROM avisos_investidor WHERE investidor_id IN ${tx(I)}`;
    await tx`DELETE FROM acesso_tokens WHERE investidor_id IN ${tx(I)}`;
    await tx`DELETE FROM investidores WHERE id IN ${tx(I)}`;
    await tx`DELETE FROM usinas WHERE id IN ${tx(U)}`;
    await tx`DELETE FROM demo_registros`;
  });
}
