import jwt from "jsonwebtoken";
import { Readable } from "node:stream";

export const MAX_IMPORT_FILES = 300;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export function normalizeImportCpf(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 0 && digits.length <= 11 ? digits.padStart(11, "0") : "";
}

function competence(data) {
  const mes = Number(data.mes);
  const ano = Number(data.ano);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 ||
      !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    throw new Error("Informe mês (1 a 12) e ano (2000 a 2100) válidos.");
  }
  return { mes, ano };
}

export function inspectImportFile(file, period) {
  const name = file?.name;
  if (typeof name !== "string" || name.length > 255 || /[\x00-\x1f/\\]/.test(name)) {
    return { status: "invalid", message: "Nome de arquivo inválido." };
  }
  const match = /^(\d{11}) - (.+) (0[1-9]|1[0-2])-(\d{4})\.pdf$/i.exec(name);
  if (!match) return { status: "invalid", message: "Use o padrão CPF - NOME MM-AAAA.pdf." };
  const cpf = match[1];
  if (Number(match[3]) !== period.mes || Number(match[4]) !== period.ano) {
    return { cpf, status: "invalid", message: "A competência no nome difere do mês/ano selecionado." };
  }
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return { cpf, status: "invalid", message: "O PDF deve ter entre 1 byte e 5 MB." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { cpf, status: "invalid", message: "Apenas arquivos PDF são permitidos." };
  }
  return { cpf, status: "ready", message: "Pronto para importar." };
}

export class ContrachequeImportService {
  constructor({ repository, drive, secret, folderId, logger = console }) {
    Object.assign(this, { repository, drive, secret, folderId, logger });
  }

  async preview(data, adminId) {
    const period = competence(data);
    if (!Array.isArray(data.files) || !data.files.length || data.files.length > MAX_IMPORT_FILES) {
      throw new Error(`Selecione entre 1 e ${MAX_IMPORT_FILES} PDFs por lote.`);
    }
    const rows = data.files.map((file, index) => ({
      index, file_name: typeof file?.name === "string" ? file.name : "",
      size: file?.size, ...inspectImportFile(file, period),
    }));
    const counts = new Map();
    for (const row of rows) if (row.cpf) counts.set(row.cpf, (counts.get(row.cpf) || 0) + 1);
    const cpfs = [...new Set(rows.filter(r => r.status === "ready").map(r => r.cpf))];
    const users = cpfs.length ? await this.repository.matchUsers(cpfs, period) : [];
    const byCpf = new Map();
    for (const user of users) {
      const cpf = normalizeImportCpf(user.cpf);
      byCpf.set(cpf, [...(byCpf.get(cpf) || []), user]);
    }
    for (const row of rows) {
      if (row.status !== "ready") continue;
      const matches = byCpf.get(row.cpf) || [];
      if (matches.length === 1) row.user = { id: matches[0].id, nome: matches[0].nome, cpf: row.cpf };
      if (counts.get(row.cpf) > 1) {
        Object.assign(row, { status: "duplicate", message: "CPF repetido no lote. Selecione apenas um PDF por CPF." });
      } else if (matches.length === 0) {
        Object.assign(row, { status: "unmatched", message: "Nenhum usuário cadastrado com esse CPF." });
      } else if (matches.length > 1) {
        Object.assign(row, { status: "ambiguous", message: "Mais de um usuário possui esse CPF. Corrija o cadastro antes de importar." });
      } else if (Number(matches[0].paycheck_active) === 1) {
        Object.assign(row, { status: "existing", message: "Já existe contracheque ativo nesta competência. Será mantido." });
      } else {
        row.action = matches[0].paycheck_id ? "reactivate" : "insert";
        row.message = row.action === "reactivate" ? "Registro inativo: será reativado com este PDF." : "Pronto para importar.";
        row.ticket = jwt.sign({
          purpose: "paycheck-import", adminId, userId: row.user.id, cpf: row.cpf,
          name: row.file_name, size: row.size, ...period,
        }, this.secret(), { algorithm: "HS256", audience: "paycheck-import", expiresIn: "4h" });
      }
    }
    return { ...period, rows };
  }

  async importFile(file, data, adminId) {
    let ticket;
    try {
      ticket = jwt.verify(data.ticket, this.secret(), { algorithms: ["HS256"], audience: "paycheck-import" });
    } catch {
      throw new Error("Conferência expirada ou inválida. Confira os arquivos novamente.");
    }
    if (ticket.purpose !== "paycheck-import" || ticket.adminId !== adminId) {
      throw new Error("A conferência pertence a outro administrador.");
    }
    const uploadedName = file?.originalname;
    // Busboy pode interpretar o nome UTF-8 do multipart como latin1.
    const decodedName = uploadedName ? Buffer.from(uploadedName, "latin1").toString("utf8") : "";
    if (!file || (uploadedName !== ticket.name && decodedName !== ticket.name) ||
        file.size !== ticket.size || file.buffer?.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("O arquivo enviado não corresponde ao PDF conferido.");
    }
    const period = competence(ticket);
    const checked = inspectImportFile({ name: ticket.name, size: file.size, type: file.mimetype }, period);
    if (checked.status !== "ready" || checked.cpf !== ticket.cpf) throw new Error("PDF inválido para esta competência.");
    const matches = await this.repository.matchUsers([ticket.cpf], period);
    if (matches.length !== 1 || matches[0].id !== ticket.userId) {
      throw new Error("O cadastro do CPF mudou. Confira os arquivos novamente.");
    }
    if (Number(matches[0].paycheck_active) === 1) {
      return { status: "existing", message: "Já importado nesta competência. Nenhuma duplicidade criada." };
    }
    if (!this.folderId()) throw new Error("Pasta do Google Drive não configurada.");
    let driveId;
    try {
      const uploaded = await this.drive.files.create({
        requestBody: { name: ticket.name, parents: [this.folderId()] },
        media: { mimeType: "application/pdf", body: Readable.from(file.buffer) },
        fields: "id",
      }, { timeout: 90000, retry: false });
      driveId = uploaded.data.id;
      if (!driveId) throw new Error("O Google Drive não retornou o ID do arquivo.");
      const result = await this.repository.saveImport({
        userId: ticket.userId, cpf: ticket.cpf, ...period, name: ticket.name, driveId,
      });
      if (result.status === "existing") await this.cleanup(driveId);
      return result;
    } catch (error) {
      // Em falha de confirmação do COMMIT, o vínculo pode existir: preservar o PDF.
      if (driveId && !error.commitUncertain) await this.cleanup(driveId);
      this.logger.error("Falha na importação de contracheque:", error.code || error.message);
      throw new Error("Não foi possível concluir este arquivo. Tente novamente; vínculos existentes serão preservados.");
    }
  }

  async cleanup(fileId) {
    try { await this.drive.files.delete({ fileId }, { timeout: 30000 }); }
    catch { this.logger.error("Não foi possível remover PDF sem vínculo da importação:", fileId); }
  }
}
