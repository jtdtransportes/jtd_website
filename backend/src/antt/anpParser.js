// Leitura e validação de arquivos oficiais da ANP (Diesel S10).
//  1) Microdados por posto (CSV ";", dados abertos):  agregados DIÁRIOS por Brasil/região/UF
//  2) Resumo semanal oficial (XLSX, abas BRASIL / REGIOES / ESTADOS)
// Nada aqui inventa dados: linhas inválidas são rejeitadas e contabilizadas.
import ExcelJS from "exceljs";
import * as D from "./decimal.js";

export const PRODUTO = "DIESEL S10";
export const PRECO_MIN_PLAUSIVEL = "1";   // R$/l — abaixo disso a linha é rejeitada
export const PRECO_MAX_PLAUSIVEL = "30";  // R$/l — acima disso a linha é rejeitada

export const REGIOES = { N: "Norte", NE: "Nordeste", CO: "Centro-Oeste", SE: "Sudeste", S: "Sul" };
export const ESTADOS = {
  AC: ["Acre", "N"], AL: ["Alagoas", "NE"], AP: ["Amapá", "N"], AM: ["Amazonas", "N"], BA: ["Bahia", "NE"],
  CE: ["Ceará", "NE"], DF: ["Distrito Federal", "CO"], ES: ["Espírito Santo", "SE"], GO: ["Goiás", "CO"],
  MA: ["Maranhão", "NE"], MT: ["Mato Grosso", "CO"], MS: ["Mato Grosso do Sul", "CO"], MG: ["Minas Gerais", "SE"],
  PA: ["Pará", "N"], PB: ["Paraíba", "NE"], PR: ["Paraná", "S"], PE: ["Pernambuco", "NE"], PI: ["Piauí", "NE"],
  RJ: ["Rio de Janeiro", "SE"], RN: ["Rio Grande do Norte", "NE"], RS: ["Rio Grande do Sul", "S"],
  RO: ["Rondônia", "N"], RR: ["Roraima", "N"], SC: ["Santa Catarina", "S"], SP: ["São Paulo", "SE"],
  SE: ["Sergipe", "NE"], TO: ["Tocantins", "N"],
};

export const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const NOME_ESTADO_PARA_UF = Object.fromEntries(Object.entries(ESTADOS).map(([uf, [nome]]) => [norm(nome), uf]));
const NOME_REGIAO_PARA_SIGLA = {
  NORTE: "N", NORDESTE: "NE", "CENTRO OESTE": "CO", "CENTRO-OESTE": "CO", SUDESTE: "SE", SUL: "S",
};

/** Decodifica Buffer: UTF-8 (com/sem BOM) e, se houver caracteres inválidos, Latin-1. */
export function decodificarTexto(buffer) {
  let text = buffer.toString("utf8");
  if (text.includes("�")) text = buffer.toString("latin1");
  return text.replace(/^﻿/, "");
}

/** Parser CSV (delimitador configurável, aspas, quebras de linha em campos). */
export function parseCsv(text, delimiter = ";") {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === "") inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

function dataBr(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const dentroDoPlausivel = (p) => p >= D.parse(PRECO_MIN_PLAUSIVEL) && p <= D.parse(PRECO_MAX_PLAUSIVEL);

/**
 * Microdados por posto → agregados diários.
 * Retorna { diarios: [{data_coleta, escopo, chave, n_observacoes, soma_precos, preco_minimo, preco_maximo}], estatisticas }
 */
export function agregarMicrodados(buffer) {
  const rows = parseCsv(decodificarTexto(buffer));
  if (!rows.length) throw new Error("Arquivo CSV vazio.");
  const header = rows[0].map(norm);
  const col = (nome) => header.findIndex((h) => h === norm(nome));
  const iReg = col("Regiao - Sigla"), iUf = col("Estado - Sigla"), iProd = col("Produto");
  const iData = col("Data da Coleta"), iValor = col("Valor de Venda"), iUn = col("Unidade de Medida");
  if ([iReg, iUf, iProd, iData, iValor].some((i) => i < 0)) {
    throw new Error("Formato não reconhecido: esperado CSV de microdados da ANP (Regiao - Sigla; Estado - Sigla; Produto; Data da Coleta; Valor de Venda).");
  }
  const acc = new Map();
  const est = { linhas: 0, diesel_s10: 0, validas: 0, rejeitadas: 0, motivos: {} };
  const rejeita = (motivo) => { est.rejeitadas++; est.motivos[motivo] = (est.motivos[motivo] || 0) + 1; };
  const push = (data, escopo, chave, p) => {
    const k = `${data}|${escopo}|${chave}`;
    const a = acc.get(k);
    if (!a) acc.set(k, { data_coleta: data, escopo, chave, n: 1, soma: p, min: p, max: p });
    else { a.n++; a.soma += p; if (p < a.min) a.min = p; if (p > a.max) a.max = p; }
  };
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    est.linhas++;
    if (norm(c[iProd]) !== PRODUTO) continue;
    est.diesel_s10++;
    if (iUn >= 0 && c[iUn] && !/LITRO/i.test(c[iUn])) { rejeita("unidade_invalida"); continue; }
    const data = dataBr(c[iData] ?? "");
    if (!data) { rejeita("data_invalida"); continue; }
    let p;
    try { p = D.parse(c[iValor]); } catch { rejeita("preco_invalido"); continue; }
    if (!dentroDoPlausivel(p)) { rejeita("preco_implausivel"); continue; }
    const regiao = norm(c[iReg]);
    const uf = norm(c[iUf]);
    if (!REGIOES[regiao] || !ESTADOS[uf]) { rejeita("regiao_ou_uf_invalida"); continue; }
    est.validas++;
    push(data, "BRASIL", "BR", p);
    push(data, "REGIAO", regiao, p);
    push(data, "ESTADO", uf, p);
  }
  const diarios = [...acc.values()].map((a) => ({
    data_coleta: a.data_coleta, escopo: a.escopo, chave: a.chave, n_observacoes: a.n,
    soma_precos: D.fmt(a.soma, 4), preco_minimo: D.fmt(a.min, 4), preco_maximo: D.fmt(a.max, 4),
  }));
  return { diarios, estatisticas: est };
}

/** Resume agregados diários (soma/n) em preço médio semanal com 4 casas. */
export function precoMedioDeSoma(soma, n) {
  return D.fmt(D.div(soma, D.parse(n)), 4);
}

const ehXlsx = (buffer) => buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"

function celula(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return celula(v.result);
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

function dataIso(v) {
  v = celula(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return dataBr(s);
}

/**
 * Resumo semanal oficial (XLSX). Lê abas BRASIL, REGIOES e ESTADOS, produto "OLEO DIESEL S10".
 * Retorna { semanais: [{semana_inicio, semana_fim, escopo, chave, preco_medio, preco_minimo, preco_maximo, n_postos}], estatisticas }
 */
export async function lerResumoSemanalXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const semanais = [];
  const est = { abas: [], linhas: 0, validas: 0, rejeitadas: 0, motivos: {} };
  const rejeita = (m) => { est.rejeitadas++; est.motivos[m] = (est.motivos[m] || 0) + 1; };
  const alvo = { BRASIL: "BRASIL", REGIOES: "REGIAO", ESTADOS: "ESTADO" };
  for (const ws of wb.worksheets) {
    // "REGIOES" (resumo semanal) ou "REGIÕES - DESDE 30.12.2012" (série histórica semanal oficial)
    const nomeAba = norm(ws.name);
    const escopo = Object.entries(alvo).find(([k]) => nomeAba === k || nomeAba.startsWith(`${k} `))?.[1];
    if (!escopo) continue;
    let headerRow = -1, h = null;
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (headerRow > 0) return;
      const vals = Array.from(row.values, (v) => norm(celula(v)));
      if (vals.includes("DATA INICIAL") && vals.includes("PRODUTO")) { headerRow = i; h = vals; }
    });
    if (headerRow < 0) { est.abas.push({ aba: ws.name, erro: "cabeçalho não encontrado" }); continue; }
    const idx = (nome) => h.findIndex((x) => x === nome);
    const iIni = idx("DATA INICIAL"), iFim = idx("DATA FINAL"), iProd = idx("PRODUTO");
    const iN = h.findIndex((x) => x.startsWith("NUMERO DE POSTOS"));
    const iMed = idx("PRECO MEDIO REVENDA"), iMin = idx("PRECO MINIMO REVENDA"), iMax = idx("PRECO MAXIMO REVENDA");
    const iChave = escopo === "BRASIL" ? idx("BRASIL") : escopo === "REGIAO" ? idx("REGIAO") : idx("ESTADOS");
    if ([iIni, iFim, iProd, iMed].some((i) => i < 0) || iChave < 0) {
      est.abas.push({ aba: ws.name, erro: "colunas obrigatórias ausentes" }); continue;
    }
    let lidas = 0;
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= headerRow) return;
      const v = row.values;
      if (norm(celula(v[iProd])) !== "OLEO DIESEL S10") return;
      est.linhas++; lidas++;
      const ini = dataIso(v[iIni]), fim = dataIso(v[iFim]);
      if (!ini || !fim) return rejeita("data_invalida");
      const dIni = new Date(`${ini}T00:00:00Z`), dFim = new Date(`${fim}T00:00:00Z`);
      if (dIni.getUTCDay() !== 0 || (dFim - dIni) / 86400000 !== 6) return rejeita("semana_invalida");
      let preco;
      try { preco = D.parse(celula(v[iMed])); } catch { return rejeita("preco_invalido"); }
      if (!dentroDoPlausivel(preco)) return rejeita("preco_implausivel");
      let chave;
      const bruto = norm(celula(v[iChave]));
      if (escopo === "BRASIL") chave = "BR";
      else if (escopo === "REGIAO") chave = NOME_REGIAO_PARA_SIGLA[bruto];
      else chave = NOME_ESTADO_PARA_UF[bruto];
      if (!chave) return rejeita("regiao_ou_estado_desconhecido");
      const opcional = (j) => { try { return j >= 0 && celula(v[j]) != null ? D.round(celula(v[j]), 4) : null; } catch { return null; } };
      const n = iN >= 0 ? Number(celula(v[iN])) : 0;
      est.validas++;
      semanais.push({
        semana_inicio: ini, semana_fim: fim, escopo, chave,
        preco_medio: D.fmt(preco, 4), preco_minimo: opcional(iMin), preco_maximo: opcional(iMax),
        n_postos: Number.isFinite(n) ? n : 0,
      });
    });
    est.abas.push({ aba: ws.name, linhas_diesel_s10: lidas });
  }
  if (!est.abas.length) throw new Error("Planilha não reconhecida: esperadas as abas BRASIL, REGIOES ou ESTADOS do resumo semanal da ANP.");
  return { semanais, estatisticas: est };
}

/** Detecta o tipo do arquivo enviado e devolve um resultado padronizado. */
export async function lerArquivoAnp(buffer, nomeArquivo = "") {
  if (ehXlsx(buffer) || /\.xlsx$/i.test(nomeArquivo)) {
    if (!ehXlsx(buffer)) throw new Error("Arquivo .xlsx inválido.");
    return { tipo: "RESUMO_SEMANAL", ...(await lerResumoSemanalXlsx(buffer)) };
  }
  return { tipo: "MICRODADOS", ...agregarMicrodados(buffer) };
}
