import test from "node:test";
import assert from "node:assert/strict";
import { segredoValido, cronSync } from "./cron.js";

const SEGREDO = "segredo-de-teste-com-mais-de-24-chars";

test("cron: segredo válido somente quando configurado (≥ 24 caracteres) e idêntico", () => {
  assert.equal(segredoValido(SEGREDO, SEGREDO), true);
  assert.equal(segredoValido("errado", SEGREDO), false);
  assert.equal(segredoValido("", SEGREDO), false);
  assert.equal(segredoValido(undefined, SEGREDO), false);
  assert.equal(segredoValido("curto", "curto"), false);  // segredo fraco não habilita o endpoint
  assert.equal(segredoValido(SEGREDO, undefined), false);
});

const resposta = () => { const r = { status(c) { r.code = c; return r; }, json(b) { r.body = b; r.code ??= 200; return r; } }; return r; };

test("cron: endpoint desativado sem ANTT_CRON_SECRET e 401 com segredo errado (não sincroniza)", async () => {
  const anterior = process.env.ANTT_CRON_SECRET;
  try {
    delete process.env.ANTT_CRON_SECRET;
    let r = resposta();
    await cronSync({ get: () => SEGREDO }, r);
    assert.equal(r.code, 404);
    process.env.ANTT_CRON_SECRET = SEGREDO;
    r = resposta();
    await cronSync({ get: () => "errado" }, r);
    assert.equal(r.code, 401);
  } finally {
    if (anterior === undefined) delete process.env.ANTT_CRON_SECRET; else process.env.ANTT_CRON_SECRET = anterior;
  }
});
