import test from "node:test";
import assert from "node:assert/strict";
import * as D from "./decimal.js";

test("decimal: soma exata sem erro de ponto flutuante", () => {
  assert.notEqual(0.1 + 0.2, 0.3); // prova do problema do float
  assert.equal(D.fmt(D.add("0.1", "0.2"), 2), "0.30");
  assert.equal(D.fmt(D.sum(["0.1", "0.2", "0.3"]), 1), "0.6");
});

test("decimal: aceita vírgula decimal e rejeita lixo", () => {
  assert.equal(D.fmt(D.parse("7,31"), 2), "7.31");
  assert.equal(D.fmt(D.parse("1.234,56"), 2), "1234.56");
  assert.throws(() => D.parse("abc"));
  assert.throws(() => D.parse(""));
  assert.throws(() => D.parse(Number.NaN));
});

test("decimal: arredondamento half-up exato (0,125 → 0,13; -0,125 → -0,13)", () => {
  assert.equal(D.round("0.125", 2), "0.13");
  assert.equal(D.round("-0.125", 2), "-0.13");
  assert.equal(D.round("750.085", 2), "750.09");
  assert.equal(D.round("0.004", 2), "0.00");
});

test("decimal: multiplicação e divisão", () => {
  assert.equal(D.fmt(D.mul("1234.5678", "0.085"), 4), "104.9383");
  assert.equal(D.fmt(D.div("10", "3"), 6), "3.333333");
  assert.throws(() => D.div("1", "0"));
});

test("variação % = ((atual / referência) - 1) × 100", () => {
  assert.equal(D.variacaoPct("7.35", "7"), "5.0000");
  assert.equal(D.variacaoPct("6.65", "7"), "-5.0000");
  assert.equal(D.variacaoPct("7", "7"), "0.0000");
  assert.equal(D.variacaoPct("7.3325", "6.0740"), "20.7195");
  assert.throws(() => D.variacaoPct("7", "0"));
});

test("gatilho: acima de +5% → ALTA; abaixo de -5% → BAIXA; entre → SEM_GATILHO", () => {
  assert.equal(D.classificarGatilho("7.36", "7"), "ALTA");
  assert.equal(D.classificarGatilho("6.64", "7"), "BAIXA");
  assert.equal(D.classificarGatilho("7.00", "7"), "SEM_GATILHO");
  assert.equal(D.classificarGatilho("7.20", "7"), "SEM_GATILHO");
});

test("gatilho INCLUSIVO: exatamente +5% e exatamente −5% disparam", () => {
  assert.equal(D.classificarGatilho("7.35", "7"), "ALTA");
  assert.equal(D.classificarGatilho("6.65", "7"), "BAIXA");
  assert.equal(D.classificarGatilho("6.405", "6.1"), "ALTA");   // 6,10 × 1,05
  assert.equal(D.classificarGatilho("5.795", "6.1"), "BAIXA");  // 6,10 × 0,95
});

test("gatilho: comparação exata — 4,99999% não dispara, mesmo exibido como 5,00%", () => {
  assert.equal(D.classificarGatilho("7.349999", "7"), "SEM_GATILHO");
  assert.equal(D.variacaoPct("7.349999", "7", 2), "5.00");
  assert.equal(D.classificarGatilho("6.650001", "7"), "SEM_GATILHO");
});

test("gatilho: limite configurável", () => {
  assert.equal(D.classificarGatilho("7.21", "7", 3), "ALTA");
  assert.equal(D.classificarGatilho("7.25", "7", 5), "SEM_GATILHO");
  assert.throws(() => D.classificarGatilho("7", "0"));
});
