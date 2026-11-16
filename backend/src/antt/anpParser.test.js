import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseCsv, agregarMicrodados, lerArquivoAnp, lerResumoSemanalXlsx } from "./anpParser.js";

const HEADER = "Regiao - Sigla;Estado - Sigla;Municipio;Revenda;CNPJ da Revenda;Nome da Rua;Numero Rua;Complemento;Bairro;Cep;Produto;Data da Coleta;Valor de Venda;Valor de Compra;Unidade de Medida;Bandeira";
const linha = (reg, uf, produto, data, valor, revenda = "POSTO X") =>
  `${reg};${uf};CIDADE;${revenda}; 00.000.000/0001-00;RUA A;1;;CENTRO;00000-000;${produto};${data};${valor};;R$ / litro;BRANCA`;

test("CSV: delimitador ';', campos entre aspas com ';' e quebra de linha", () => {
  const rows = parseCsv('a;"b;c";d\r\n"x\ny";2;3\r\n');
  assert.deepEqual(rows, [["a", "b;c", "d"], ["x\ny", "2", "3"]]);
});

test("microdados: agrega por dia em Brasil/região/UF e filtra somente Diesel S10", () => {
  const csv = "﻿" + [
    HEADER,
    linha("SE", "SP", "DIESEL S10", "05/10/2026", "7,00", '"POSTO A; FILIAL"'),
    linha("SE", "SP", "DIESEL S10", "05/10/2026", "7,50"),
    linha("NE", "BA", "DIESEL S10", "05/10/2026", "6,50"),
    linha("NE", "BA", "DIESEL", "05/10/2026", "6,00"),         // outro produto
    linha("NE", "BA", "GNV", "05/10/2026", "4,00"),            // outro produto
  ].join("\r\n");
  const { diarios, estatisticas } = agregarMicrodados(Buffer.from(csv, "utf8"));
  const get = (escopo, chave) => diarios.find((d) => d.escopo === escopo && d.chave === chave && d.data_coleta === "2026-10-05");
  assert.equal(estatisticas.diesel_s10, 3);
  assert.equal(estatisticas.rejeitadas, 0);
  assert.deepEqual([get("BRASIL", "BR").n_observacoes, get("BRASIL", "BR").soma_precos, get("BRASIL", "BR").preco_minimo, get("BRASIL", "BR").preco_maximo], [3, "21.0000", "6.5000", "7.5000"]);
  assert.equal(get("ESTADO", "SP").soma_precos, "14.5000");
  assert.equal(get("REGIAO", "SE").n_observacoes, 2);
  assert.equal(get("REGIAO", "NE").n_observacoes, 1);
});

test("microdados: linhas inválidas são rejeitadas e contabilizadas (nada é inventado)", () => {
  const csv = [
    HEADER,
    linha("SE", "SP", "DIESEL S10", "31/02/2026", "7,00"),   // data inexistente
    linha("SE", "SP", "DIESEL S10", "05/10/2026", "abc"),    // preço inválido
    linha("SE", "SP", "DIESEL S10", "05/10/2026", "99,00"),  // implausível
    linha("XX", "ZZ", "DIESEL S10", "05/10/2026", "7,00"),   // UF/região inexistentes
    linha("SE", "SP", "DIESEL S10", "05/10/2026", "7,00"),   // válida
  ].join("\n");
  const { diarios, estatisticas } = agregarMicrodados(Buffer.from(csv, "utf8"));
  assert.equal(estatisticas.validas, 1);
  assert.equal(estatisticas.rejeitadas, 4);
  assert.deepEqual(estatisticas.motivos, { data_invalida: 1, preco_invalido: 1, preco_implausivel: 1, regiao_ou_uf_invalida: 1 });
  assert.equal(diarios.find((d) => d.escopo === "BRASIL").n_observacoes, 1);
});

test("microdados: arquivo fora do formato da ANP é recusado", () => {
  assert.throws(() => agregarMicrodados(Buffer.from("a;b;c\n1;2;3\n")), /Formato não reconhecido/);
});

test("microdados: reimportar o mesmo arquivo gera os mesmos agregados (base da idempotência)", () => {
  const csv = [HEADER, linha("SE", "SP", "DIESEL S10", "05/10/2026", "7,00"), linha("SE", "SP", "DIESEL S10", "06/10/2026", "7,10")].join("\n");
  const a = agregarMicrodados(Buffer.from(csv)).diarios;
  const b = agregarMicrodados(Buffer.from(csv)).diarios;
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((d) => `${d.data_coleta}|${d.escopo}|${d.chave}`)).size, a.length); // chaves únicas
});

async function xlsxResumo(linhas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ESTADOS");
  ws.addRow(["LEVANTAMENTO DE PREÇOS DE COMBUSTÍVEIS"]);
  ws.addRow([]);
  ws.addRow(["DATA INICIAL", "DATA FINAL", "REGIAO", "ESTADOS", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA", "DESVIO PADRÃO REVENDA", "PREÇO MÍNIMO REVENDA", "PREÇO MÁXIMO REVENDA", "COEF DE VARIAÇÃO REVENDA"]);
  for (const l of linhas) ws.addRow(l);
  const br = wb.addWorksheet("BRASIL");
  br.addRow(["DATA INICIAL", "DATA FINAL", "BRASIL", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA", "DESVIO PADRÃO REVENDA", "PREÇO MÍNIMO REVENDA", "PREÇO MÁXIMO REVENDA", "COEF DE VARIAÇÃO REVENDA"]);
  br.addRow([new Date("2026-10-25T00:00:00Z"), new Date("2026-10-31T00:00:00Z"), "BRASIL", "OLEO DIESEL S10", 3186, "R$/l", 7.31, 0.37, 5.89, 9.19, 0.051]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("XLSX oficial: lê Brasil e estados do Diesel S10 e valida a semana (domingo→sábado)", async () => {
  const d1 = new Date("2026-10-25T00:00:00Z"), d2 = new Date("2026-10-31T00:00:00Z");
  const buf = await xlsxResumo([
    [d1, d2, "SUDESTE", "SAO PAULO", "OLEO DIESEL S10", 860, "R$/l", 7.32, 0.3, 6.68, 9.19, 0.04],
    [d1, d2, "SUDESTE", "SAO PAULO", "OLEO DIESEL", 500, "R$/l", 7.0, 0.3, 6.0, 9.0, 0.04],       // outro produto: ignorado
    [new Date("2026-10-26T00:00:00Z"), new Date("2026-11-01T00:00:00Z"), "SUL", "PARANA", "OLEO DIESEL S10", 10, "R$/l", 7.1, 0, 7.1, 7.1, 0], // não começa no domingo
    [d1, d2, "SUL", "PARANA", "OLEO DIESEL S10", 10, "R$/l", 0.5, 0, 0.5, 0.5, 0],                 // preço implausível
  ]);
  const { semanais, estatisticas } = await lerResumoSemanalXlsx(buf);
  const sp = semanais.find((s) => s.chave === "SP");
  assert.deepEqual([sp.escopo, sp.preco_medio, sp.n_postos, sp.semana_inicio, sp.semana_fim], ["ESTADO", "7.3200", 860, "2026-10-25", "2026-10-31"]);
  assert.equal(semanais.find((s) => s.escopo === "BRASIL").preco_medio, "7.3100");
  assert.equal(estatisticas.rejeitadas, 2);
  assert.equal(semanais.length, 2);
});

test("série histórica oficial (aba 'REGIÕES - DESDE 30.12.2012') é lida como preço regional", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("REGIÕES - DESDE 30.12.2012");
  ws.addRow(["SISTEMA DE LEVANTAMENTO DE PREÇOS"]);
  ws.addRow(["DATA INICIAL", "DATA FINAL", "REGIÃO", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA", "DESVIO PADRÃO REVENDA", "PREÇO MÍNIMO REVENDA", "PREÇO MÁXIMO REVENDA", "MARGEM MÉDIA REVENDA", "COEF DE VARIAÇÃO REVENDA"]);
  ws.addRow([new Date("2026-11-01T00:00:00Z"), new Date("2026-11-07T00:00:00Z"), "NORDESTE", "OLEO DIESEL S10", 725, "R$/l", 7.42, 0.413, 6.15, 8.99, "-", 0.056]);
  ws.addRow([new Date("2026-11-01T00:00:00Z"), new Date("2026-11-07T00:00:00Z"), "NORTE", "OLEO DIESEL S10", 222, "R$/l", 7.44, 0.462, 6.65, 8.99, "-", 0.062]);
  ws.addRow([new Date("2026-11-01T00:00:00Z"), new Date("2026-11-07T00:00:00Z"), "NORTE", "GASOLINA COMUM", 222, "R$/l", 6.9, 0.4, 6, 8, "-", 0.06]);
  const { semanais } = await lerResumoSemanalXlsx(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.deepEqual(semanais.map((s) => [s.escopo, s.chave, s.preco_medio]), [["REGIAO", "NE", "7.4200"], ["REGIAO", "N", "7.4400"]]);
});

test("detecção de tipo: XLSX vs CSV; XLSX inválido é recusado", async () => {
  const buf = await xlsxResumo([]);
  assert.equal((await lerArquivoAnp(buf, "x.xlsx")).tipo, "RESUMO_SEMANAL");
  assert.equal((await lerArquivoAnp(Buffer.from(HEADER + "\n"), "x.csv")).tipo, "MICRODADOS");
  await assert.rejects(() => lerArquivoAnp(Buffer.from("não sou xlsx"), "x.xlsx"), /inválido/);
});
