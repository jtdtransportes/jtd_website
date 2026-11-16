// Autorização do módulo: admin sempre; demais apenas se o setor estiver autorizado; escrita só admin.
import test from "node:test";
import assert from "node:assert/strict";
import repo from "../repositories/antt.repository.js";
import { verificarAcesso } from "../services/antt.service.js";
import { anttLeitura, anttEscrita } from "../middlewares/antt.middleware.js";

function mock(t, usuario, setoresAutorizados = []) {
  t.mock.method(repo, "getUsuarioAcesso", async () => usuario);
  t.mock.method(repo, "getConfigRows", async () => ({ setores_autorizados: JSON.stringify(setoresAutorizados) }));
}
const resp = () => { const r = { status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };

test("admin ativo: leitura e edição", async (t) => {
  mock(t, { id: 1, role: "admin", sector_id: 1, is_active: 1 });
  assert.deepEqual(await verificarAcesso(1), { acesso: true, pode_editar: true, pode_comunicar: true, role: "admin" });
});

test("usuário comum em setor NÃO autorizado: sem acesso", async (t) => {
  mock(t, { id: 2, role: "user", sector_id: 5, is_active: 1 }, [3]);
  const r = await verificarAcesso(2);
  assert.equal(r.acesso, false);
  assert.match(r.motivo, /setor/i);
});

test("usuário comum em setor autorizado: apenas leitura", async (t) => {
  mock(t, { id: 2, role: "user", sector_id: 3, is_active: 1 }, [3]);
  const r = await verificarAcesso(2);
  assert.equal(r.acesso, true);
  assert.equal(r.pode_editar, false);
});

test("padrão seguro: nenhum setor autorizado → só administradores", async (t) => {
  mock(t, { id: 2, role: "user", sector_id: 3, is_active: 1 }, []);
  assert.equal((await verificarAcesso(2)).acesso, false);
});

test("usuário inativo ou inexistente nunca tem acesso (nem admin)", async (t) => {
  mock(t, { id: 1, role: "admin", sector_id: 1, is_active: 0 });
  assert.equal((await verificarAcesso(1)).acesso, false);
  mock(t, null);
  assert.equal((await verificarAcesso(9)).acesso, false);
});

test("middleware de leitura responde 403 sem acesso e libera com acesso", async (t) => {
  mock(t, { id: 2, role: "user", sector_id: 9, is_active: 1 }, [3]);
  const r = resp(); let passou = false;
  await anttLeitura({ user: { id: 2 } }, r, () => { passou = true; });
  assert.equal(r.code, 403); assert.equal(passou, false);
  mock(t, { id: 1, role: "admin", sector_id: 1, is_active: 1 });
  const req = { user: { id: 1 } };
  await anttLeitura(req, resp(), () => { passou = true; });
  assert.equal(passou, true);
  assert.equal(req.anttAcesso.pode_editar, true);
});

test("middleware de escrita bloqueia leitores (403)", () => {
  const r = resp(); let passou = false;
  anttEscrita({ anttAcesso: { acesso: true, pode_editar: false } }, r, () => { passou = true; });
  assert.equal(r.code, 403); assert.equal(passou, false);
  anttEscrita({ anttAcesso: { acesso: true, pode_editar: true } }, resp(), () => { passou = true; });
  assert.equal(passou, true);
});
