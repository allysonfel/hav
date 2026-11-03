// Rodar: npm run teste
import { test } from "node:test";
import assert from "node:assert/strict";
import { dividir } from "../src/lib/rateio.ts";

const horizonte = [180000, 220000, 150000, 200000, 120000, 130000];

test("reproduz os valores do protótipo", () => {
  assert.deepEqual(dividir(7_115_000, horizonte), [1_280_700, 1_565_300, 1_067_250, 1_423_000, 853_800, 924_950]);
});

test("a soma fecha com o total, mesmo com dízima", () => {
  for (const total of [1, 2, 100, 9_999_999, 7_115_001]) {
    assert.equal(dividir(total, [333333, 333333, 333334]).reduce((a, b) => a + b, 0), total);
  }
});

test("a sobra vai para a maior fração", () => {
  assert.deepEqual(dividir(1, [250000, 750000]), [0, 1]);
});

test("não perde precisão em valores altos", () => {
  const total = 99_999_999_999_999;
  assert.equal(dividir(total, horizonte).reduce((a, b) => a + b, 0), total);
});

test("mês sem receita dá zero para todos", () => {
  assert.deepEqual(dividir(0, [500000, 500000]), [0, 0]);
});

import { projetar, somarProjecoes } from "../src/lib/projecao.ts";

const meses = (inicio: string, valores: number[]) => valores.map((valor, i) => {
  const t = Number(inicio.slice(0, 4)) * 12 + Number(inicio.slice(5, 7)) - 1 + i;
  return { comp: `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`, valor };
});

test("projeção: menos de 3 meses não projeta", () => {
  assert.deepEqual(projetar(meses("2026-08", [10, 20])), []);
});

test("projeção: sem ano anterior usa a média dos 3 últimos", () => {
  const p = projetar(meses("2026-06", [100, 200, 300, 400]));
  assert.deepEqual(p.map((x) => [x.comp, x.valor, x.metodo]), [["2026-10", 300, "media"], ["2026-11", 300, "media"], ["2026-12", 300, "media"]]);
});

test("projeção: com ano anterior segue a sazonalidade e a tendência (limitada a 20%)", () => {
  // 2025: 12 meses de 100, menos novembro (150). 2026 até outubro: 110 (tendência +10%).
  const v2025 = Array.from({ length: 12 }, (_, i) => (i === 10 ? 150 : 100));
  const p = projetar([...meses("2025-01", v2025), ...meses("2026-01", Array(10).fill(110))]);
  assert.deepEqual(p.map((x) => [x.comp, x.valor, x.metodo]), [["2026-11", 165, "sazonal"], ["2026-12", 110, "sazonal"], ["2027-01", 121, "sazonal"]]);
  const alto = projetar([...meses("2025-01", Array(12).fill(100)), ...meses("2026-01", Array(10).fill(300))]);
  assert.equal(alto[0].valor, 120);
});

test("projeção: buraco nos 3 últimos meses não projeta", () => {
  assert.deepEqual(projetar([...meses("2026-05", [1, 2, 3]), ...meses("2026-09", [4])]), []);
});

test("soma de projeções por mês", () => {
  const a = projetar(meses("2026-06", [100, 100, 100]));
  const b = projetar(meses("2026-06", [50, 50, 50]));
  assert.deepEqual(somarProjecoes([a, b]).map((x) => x.valor), [150, 150, 150]);
});
