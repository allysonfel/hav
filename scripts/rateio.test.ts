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
