import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { ContrachequeImportService, normalizeImportCpf } from "./contrachequeImport.service.js";
import { ContrachequeImportRepository } from "../repositories/contrachequeImport.repository.js";

const secret = "isolated-import-test-secret";
const cpf = "00123456789";
const name = `${cpf} - TESTE DE IMPORTACAO 09-2026.pdf`;
const buffer = Buffer.from("%PDF-1.4 test fixture");
const metadata = { name, size: buffer.length, type: "application/pdf" };
const file = { originalname: name, size: buffer.length, mimetype: "application/pdf", buffer };
const user = { id: 10, nome: "Usuario de teste", cpf: "001.234.567-89", paycheck_id: null, paycheck_active: null };

function setup(overrides = {}) {
  const calls = { uploads: 0, deletes: [], saves: [] };
  const repository = {
    matchUsers: async () => [user],
    saveImport: async data => { calls.saves.push(data); return { status: "imported" }; },
    ...overrides,
  };
  const service = new ContrachequeImportService({
    repository, secret: () => secret, folderId: () => "test-folder",
    drive: { files: {
      create: async () => { calls.uploads++; return { data: { id: "test-drive-id" } }; },
      delete: async ({ fileId }) => { calls.deletes.push(fileId); },
    } }, logger: { error() {} },
  });
  return { service, repository, calls };
}

async function ticketFor(service, entry = metadata) {
  const result = await service.preview({ mes: 9, ano: 2026, files: [entry] }, 1);
  return result.rows[0].ticket;
}

test("normaliza pontuacao, espacos, barras e zeros iniciais sem truncar", () => {
  for (const value of [cpf, "001.234.567-89", " 001 / 234 567-89 ", 123456789]) assert.equal(normalizeImportCpf(value), cpf);
  assert.equal(normalizeImportCpf(""), "");
  assert.equal(normalizeImportCpf("123456789012"), "");
});

test("confere 200 PDFs em uma consulta, preservando ordem e CPF", async () => {
  const files = Array.from({ length: 200 }, (_, i) => ({ ...metadata, name: `${String(i + 1).padStart(11, "0")} - TESTE 09-2026.pdf` }));
  let queries = 0;
  const { service, calls } = setup({ matchUsers: async cpfs => {
    queries++; return cpfs.map((value, index) => ({ ...user, cpf: value, id: index + 1 }));
  } });
  const result = await service.preview({ mes: 9, ano: 2026, files }, 1);
  assert.equal(queries, 1);
  assert.equal(result.rows.length, 200);
  assert.ok(result.rows.every((row, i) => row.status === "ready" && row.index === i && row.ticket));
  assert.equal(calls.uploads, 0);
});

test("bloqueia duplicados, competencia diferente e nomes sem CPF", async () => {
  const { service } = setup();
  const { rows } = await service.preview({ mes: 9, ano: 2026, files: [metadata, metadata,
    { ...metadata, name: name.replace("09-2026", "08-2026") }, { ...metadata, name: "contracheque.pdf" },
  ] }, 1);
  assert.deepEqual(rows.map(r => r.status), ["duplicate", "duplicate", "invalid", "invalid"]);
  assert.ok(rows.every(r => !r.ticket));
});

test("distingue CPF sem cadastro, ambiguo, existente e inativo", async () => {
  for (const [matches, status, action] of [
    [[], "unmatched"], [[user, { ...user, id: 11 }], "ambiguous"],
    [[{ ...user, paycheck_id: 5, paycheck_active: 1 }], "existing"],
    [[{ ...user, paycheck_id: 5, paycheck_active: 0 }], "ready", "reactivate"],
  ]) {
    const { service } = setup({ matchUsers: async () => matches });
    const { rows } = await service.preview({ mes: 9, ano: 2026, files: [metadata] }, 1);
    assert.equal(rows[0].status, status);
    assert.equal(rows[0].action, action);
  }
});

test("rejeita limites, ano fracionado e arquivos vazios/grandes", async () => {
  const { service } = setup();
  await assert.rejects(service.preview({ mes: 9, ano: 2026.5, files: [metadata] }, 1));
  await assert.rejects(service.preview({ mes: 9, ano: 2026, files: Array(301).fill(metadata) }, 1));
  const { rows } = await service.preview({ mes: 9, ano: 2026, files: [{ ...metadata, size: 0 }, { ...metadata, size: 6 * 1024 * 1024 }] }, 1);
  assert.ok(rows.every(r => r.status === "invalid"));
});

test("importa PDF conferido com ID retornado pelo Drive e usuario do CPF", async () => {
  const { service, calls } = setup();
  const ticket = await ticketFor(service);
  const result = await service.importFile(file, { ticket }, 1);
  assert.equal(result.status, "imported");
  assert.equal(calls.uploads, 1);
  assert.deepEqual(calls.saves[0], { userId: 10, cpf, mes: 9, ano: 2026, name, driveId: "test-drive-id" });
});

test("rejeita ticket alterado/expirado/de outro admin, nome ou conteudo trocado", async () => {
  const { service, calls } = setup();
  const ticket = await ticketFor(service);
  await assert.rejects(service.importFile(file, { ticket: "invalid" }, 1));
  await assert.rejects(service.importFile(file, { ticket }, 2));
  const expired = jwt.sign({ purpose: "paycheck-import", adminId: 1 }, secret, { expiresIn: -1, audience: "paycheck-import" });
  await assert.rejects(service.importFile(file, { ticket: expired }, 1));
  await assert.rejects(service.importFile({ ...file, originalname: "outro.pdf" }, { ticket }, 1));
  await assert.rejects(service.importFile({ ...file, buffer: Buffer.from("not-a-pdf") }, { ticket }, 1));
  assert.equal(calls.uploads, 0);
});

test("aceita acentos no nome multipart e mantem o nome original", async () => {
  const { service, calls } = setup();
  const accentedName = name.replace("TESTE DE IMPORTACAO", "TESTE JOÃO");
  const ticket = await ticketFor(service, { ...metadata, name: accentedName });
  await service.importFile({ ...file, originalname: Buffer.from(accentedName).toString("latin1") }, { ticket }, 1);
  assert.equal(calls.saves[0].name, accentedName);
});

test("revalida cadastro e evita reenvio quando outro lote ja importou", async () => {
  const { service, repository, calls } = setup();
  const ticket = await ticketFor(service);
  repository.matchUsers = async () => [{ ...user, paycheck_id: 1, paycheck_active: 1 }];
  assert.equal((await service.importFile(file, { ticket }, 1)).status, "existing");
  assert.equal(calls.uploads, 0);
  repository.matchUsers = async () => [];
  await assert.rejects(service.importFile(file, { ticket }, 1));
});

test("limpa upload sem vinculo em conflito ou falha, preserva commit incerto", async () => {
  for (const mode of ["existing", "error", "uncertain"]) {
    const { service, calls } = setup({ saveImport: async () => {
      if (mode === "existing") return { status: "existing" };
      throw Object.assign(new Error("db failure"), { commitUncertain: mode === "uncertain" });
    } });
    const ticket = await ticketFor(service);
    if (mode === "existing") await service.importFile(file, { ticket }, 1);
    else await assert.rejects(service.importFile(file, { ticket }, 1));
    assert.equal(calls.deletes.length, mode === "uncertain" ? 0 : 1);
  }
});

test("repositorio bloqueia usuario e consulta competencia antes de gravar", async () => {
  for (const existing of [undefined, { id: 2, is_active: 0 }, { id: 2, is_active: 1 }]) {
    const statements = []; let committed = false; let released = false;
    const repository = new ContrachequeImportRepository({ getConnection: async () => ({
      beginTransaction: async () => {},
      execute: async (sql, params) => {
        statements.push({ sql, params });
        if (sql.startsWith("SELECT id, cpf")) return [[user]];
        if (sql.startsWith("SELECT id, is_active")) return [[existing].filter(Boolean)];
        return [{}];
      },
      commit: async () => { committed = true; }, rollback: async () => {}, release: () => { released = true; },
    }) });
    const result = await repository.saveImport({ userId: 10, cpf, mes: 9, ano: 2026, name, driveId: "test-drive-id" });
    assert.match(statements[0].sql, /FOR UPDATE/);
    assert.match(statements[1].sql, /user_id = \? AND mes = \? AND ano = \? FOR UPDATE/);
    assert.equal(released, true);
    assert.equal(committed, existing?.is_active !== 1);
    assert.equal(result.status, existing?.is_active === 1 ? "existing" : "imported");
    if (existing?.is_active !== 1) assert.match(statements[2].sql, existing ? /^UPDATE/ : /^INSERT/);
  }
});
