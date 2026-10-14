import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { createContrachequeImportRouter } from "./contrachequeImport.routes.js";
import { ContrachequeImportService } from "../services/contrachequeImport.service.js";

test("rotas exigem admin e fazem conferencia/upload multipart completos", async () => {
  const secret = process.env.JWT_SECRET || "test-only-route-secret";
  process.env.JWT_SECRET = secret;
  let uploads = 0; let saved = false;
  const service = new ContrachequeImportService({
    secret: () => secret, folderId: () => "test-folder",
    repository: {
      matchUsers: async () => [{ id: 1, nome: "Teste", cpf: "001.234.567-89", paycheck_active: saved ? 1 : null }],
      saveImport: async () => { saved = true; return { status: "imported" }; },
    },
    drive: { files: { create: async () => { uploads++; return { data: { id: "fixture-id" } }; } } },
  });
  const app = express();
  app.use(express.json({ limit: "200kb" }));
  app.use("/import", createContrachequeImportRouter(service));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/import`;
  const admin = jwt.sign({ id: 1, role: "admin" }, secret);
  const member = jwt.sign({ id: 2, role: "user" }, secret);
  const pdf = Buffer.from("%PDF-1.4 test fixture");
  const name = "00123456789 - JOÃO TESTE 09-2026.pdf";
  const payload = { mes: 9, ano: 2026, files: [{ name, size: pdf.length, type: "application/pdf" }] };
  const post = (suffix, token, body, json = true) => fetch(url + suffix, {
    signal: AbortSignal.timeout(10000),
    method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(body) : body,
  });
  try {
    for (const suffix of ["/preview", "/file"]) {
      assert.equal((await post(suffix, null, payload)).status, 401);
      assert.equal((await post(suffix, member, payload)).status, 403);
    }
    const previewResponse = await post("/preview", admin, payload);
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json();
    assert.equal(preview.rows[0].status, "ready");
    assert.equal(uploads, 0);
    const upload = async blob => {
      const body = new FormData();
      body.append("ticket", preview.rows[0].ticket);
      body.append("contracheque", blob, name);
      return post("/file", admin, body, false);
    };
    assert.equal((await upload(new Blob(["invalid"], { type: "application/pdf" }))).status, 400);
    const response = await upload(new Blob([pdf], { type: "application/pdf" }));
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.status, "imported");
    const retry = await upload(new Blob([pdf], { type: "application/pdf" }));
    assert.equal((await retry.json()).status, "existing");
    assert.equal(uploads, 1);
    assert.equal((await upload(new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "application/pdf" }))).status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
