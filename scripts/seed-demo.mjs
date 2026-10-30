// Dados de demonstração com as usinas do protótipo: 2 operando, 1 em captação,
// investidores, interessados e os últimos 6 meses fechados com rateio.
// O mês anterior ao atual fica com repasses a marcar. Só roda se ainda não há
// usinas. Rodar com o sistema já tendo subido uma vez (as tabelas nascem aí):
//   DATABASE_URL=... node scripts/seed-demo.mjs
// SEED_SEM_LOGINS=sim não cria os logins @demo.local (para demonstração em produção).
import postgres from "postgres";
import { randomBytes, scryptSync } from "crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL.");
const db = postgres(url, { ssl: /localhost|127\.0\.0\.1|railway\.internal/.test(url) ? false : "prefer", onnotice: () => {} });

const hash = (s) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(s, sal, 64).toString("hex")}`;
};
const reais = (r) => r * 100;

const USINAS = [
  { nome: "Usina Horizonte Dourado", cidade: "Petrolina", uf: "PE", kwp: 1100, invest: 3_800_000, status: "operando", desde: "2024-03-01", marca: "Fronius", modelo: "Tauro 100-3-P", qtd: 10, mon: "Fronius Solar.web" },
  { nome: "Usina Vale do Sol", cidade: "Juazeiro", uf: "BA", kwp: 980, invest: 3_500_000, status: "operando", desde: "2024-07-01", marca: "Growatt", modelo: "MAX 100KTL3", qtd: 9, mon: "ShinePhone" },
  { nome: "Usina Serra Clara", cidade: "Ouricuri", uf: "PE", kwp: 1050, invest: 3_960_000, status: "captacao", desde: null, marca: "", modelo: "", qtd: 0, mon: "" },
];

const NOMES = {
  "marcos.andrade": "Marcos Andrade", "renata.siqueira": "Renata Siqueira", joaopedro: "João Pedro Alencar", "camila.duarte": "Camila Duarte",
  "felipe.barros": "Felipe Barros", participacoes: "HAV Participações", "patricia.gomes": "Patrícia Gomes", "eduardo.lins": "Eduardo Lins",
  "larissa.monteiro": "Larissa Monteiro", "tiago.rocha": "Tiago Rocha",
};

// Valor investido em reais. Cota = valor / investimento total da usina.
const COTAS = {
  "Usina Horizonte Dourado": { "marcos.andrade": 684_000, "renata.siqueira": 836_000, joaopedro: 570_000, "camila.duarte": 760_000, "felipe.barros": 456_000, participacoes: 494_000 },
  "Usina Vale do Sol": { "marcos.andrade": 420_000, "patricia.gomes": 700_000, "eduardo.lins": 1_050_000, "larissa.monteiro": 805_000, participacoes: 525_000 },
  "Usina Serra Clara": { "eduardo.lins": 900_000, "tiago.rocha": 650_000, "larissa.monteiro": 500_000, participacoes: 400_000 },
};

// Proporção de cada mês em relação ao último (curvas do protótipo).
const CURVA = { "Usina Horizonte Dourado": [100, 106, 114, 118, 115, 120], "Usina Vale do Sol": [96, 104, 111, 117, 113, 120] };
const ULTIMO_KWH = { "Usina Horizonte Dourado": 142_300, "Usina Vale do Sol": 126_800 };

function dividir(total, ppms) {
  const t = BigInt(total);
  const partes = ppms.map((c) => (t * BigInt(c)) / 1_000_000n);
  const frac = ppms.map((c, i) => ({ i, f: (t * BigInt(c)) % 1_000_000n })).sort((a, b) => (a.f === b.f ? a.i - b.i : a.f > b.f ? -1 : 1));
  let sobra = t - partes.reduce((a, b) => a + b, 0n);
  for (const { i } of frac) {
    if (sobra <= 0n) break;
    partes[i] += 1n;
    sobra -= 1n;
  }
  return partes.map(Number);
}

const hoje = new Date();
const mesMenos = (n) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - n, 1)).toISOString().slice(0, 10);

const [{ n }] = await db`SELECT count(*)::int AS n FROM usinas`;
if (n > 0) {
  console.log("Já existem usinas: nada feito.");
  await db.end();
  process.exit(0);
}

await db.begin(async (tx) => {
  let admin = (await tx`SELECT id FROM usuarios WHERE perfil = 'admin' ORDER BY id LIMIT 1`)[0]?.id ?? null;
  if (process.env.SEED_SEM_LOGINS !== "sim") {
    const senha = hash("hav-demo-2026");
    const [v] = await tx`INSERT INTO usuarios (nome, email, senha_hash, perfil, cargo, ultimo_acesso) VALUES ('Valdick Henrique', 'valdick@demo.local', ${senha}, 'admin', 'Diretor', now()) ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`;
    admin = v.id;
    await tx`INSERT INTO usuarios (nome, email, senha_hash, perfil, ultimo_acesso) VALUES ('Suelen Moraes', 'suelen@demo.local', ${senha}, 'operador', now()) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ('Diego Farias', 'diego@demo.local', ${hash(randomBytes(12).toString("hex"))}, 'operador') ON CONFLICT DO NOTHING`;
  }

  const investidores = {};
  for (const [k, nome] of Object.entries(NOMES)) {
    const [i] = await tx`INSERT INTO investidores (nome, email) VALUES (${nome}, ${`${k}@demo.local`}) RETURNING id`;
    investidores[k] = i.id;
  }

  for (const u of USINAS) {
    const [us] = await tx`
      INSERT INTO usinas (nome, cidade, uf, capacidade_wp, investimento_centavos, status, operando_desde, inversor_marca, inversor_modelo, inversor_qtd, monitoramento)
      VALUES (${u.nome}, ${u.cidade}, ${u.uf}, ${u.kwp * 1000}, ${reais(u.invest)}, ${u.status}, ${u.desde}, ${u.marca}, ${u.modelo}, ${u.qtd}, ${u.mon}) RETURNING id`;
    u.id = us.id;
    const cotas = Object.entries(COTAS[u.nome]).map(([k, valor]) => ({ investidor: investidores[k], valor, ppm: Math.round((valor / u.invest) * 1_000_000) }));
    for (const c of cotas) await tx`INSERT INTO cotas (usina_id, investidor_id, cota_ppm, valor_centavos) VALUES (${u.id}, ${c.investidor}, ${c.ppm}, ${reais(c.valor)})`;
    if (u.status !== "operando") continue;

    const ppms = cotas.map((c) => c.ppm);
    for (let m = 6; m >= 1; m--) {
      const kwh = Math.round(ULTIMO_KWH[u.nome] * (CURVA[u.nome][6 - m] / 120));
      const wh = kwh * 1000;
      const centavos = kwh * 50; // R$ 0,50 por kWh, como no protótipo
      const [f] = await tx`
        INSERT INTO fechamentos (usina_id, competencia, geracao_wh, receita_centavos, status, lancado_por, fechado_por, fechado_em)
        VALUES (${u.id}, ${mesMenos(m)}, ${wh}, ${centavos}, 'fechado', ${admin}, ${admin}, ${mesMenos(m - 1)}::date + 1) RETURNING id`;
      const g = dividir(wh, ppms);
      const r = dividir(centavos, ppms);
      for (let i = 0; i < cotas.length; i++) {
        // No último mês fechado, o repasse da Horizonte para Felipe Barros segue pendente (como no protótipo).
        const pendente = m === 1 && cotas[i].investidor === investidores["felipe.barros"];
        await tx`
          INSERT INTO rateios (fechamento_id, investidor_id, cota_ppm, geracao_wh, receita_centavos, repasse_status, pago_em, pago_por)
          VALUES (${f.id}, ${cotas[i].investidor}, ${ppms[i]}, ${g[i]}, ${r[i]}, ${pendente ? "pendente" : "pago"}, ${pendente ? null : tx`${mesMenos(m - 1)}::timestamptz + interval '5 days'`}, ${pendente ? null : admin})`;
      }
    }
  }

  const serra = USINAS[2].id;
  const interesses = [
    ["Camila Duarte", investidores["camila.duarte"], 150_000, "app", "aguardando", ""],
    ["Igor Nascimento", null, 300_000, "indicacao", "aguardando", "81999990001"],
    ["Beatriz Lemos", null, 220_000, "app", "negociacao", "81999990002"],
    ["Rafael Tenório", null, 180_000, "indicacao", "aguardando", "87999990003"],
    ["Helena Cavalcanti", null, 250_000, "app", "aguardando", "81999990004"],
    ["Otávio Menezes", null, 120_000, "equipe", "negociacao", "87999990005"],
    ["Sofia Queiroz", null, 90_000, "app", "aguardando", "81999990006"],
  ];
  for (const [nome, inv, valor, origem, status, tel] of interesses) {
    await tx`INSERT INTO interesses (usina_id, investidor_id, nome, telefone, valor_centavos, origem, status) VALUES (${serra}, ${inv}, ${nome}, ${tel}, ${reais(valor)}, ${origem}, ${status})`;
  }
});

await db.end();
console.log("Demonstração criada. Painel: valdick@demo.local e suelen@demo.local, senha hav-demo-2026 (só local).");
