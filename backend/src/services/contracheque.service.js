import fs from "fs";
import path from "path";
import contrachequeRepository from "../repositories/contracheque.repository.js";
import userRepository from "../repositories/user.repository.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContrachequeService {
  sanitizeName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  async upload(file, data) {
    const userId = Number(data.user_id);
    const mes = Number(data.mes);
    const ano = Number(data.ano);

    if (!file) {
      throw new Error("Arquivo não enviado.");
    }

    if (!userId || !mes || !ano) {
      throw new Error("user_id, mes e ano são obrigatórios.");
    }

    if (mes < 1 || mes > 12) {
      throw new Error("Mês inválido.");
    }

    if (ano < 2000 || ano > 2100) {
      throw new Error("Ano inválido.");
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    const tempRelativePath = `uploads/contracheques/${file.filename}`;

    const created = await contrachequeRepository.create({
      user_id: userId,
      mes,
      ano,
      file_name: file.filename,
      original_name: file.originalname,
      file_path: tempRelativePath,
    });

    const safeUserName = this.sanitizeName(user.nome);
    const finalFileName = `${created.id}-Contracheque-${safeUserName}-${ano}-${String(mes).padStart(2, "0")}.pdf`;

    const oldPath = path.resolve(file.path);
    const newPath = path.join(
  path.resolve(),
  "src",
  "uploads",
  "contracheques",
  finalFileName
);

    fs.renameSync(oldPath, newPath);

    const updated = await contrachequeRepository.updateFileData(
      created.id,
      finalFileName,
      `uploads/contracheques/${finalFileName}`
    );

    return updated;
  }

  async listByUser(userId) {
    return contrachequeRepository.findAllByUserId(userId);
  }

  async deactivate(userId, contrachequeId) {
    await contrachequeRepository.deactivate(contrachequeId, userId);
  }
  async listAllForAdmin() {
    return contrachequeRepository.findAllDetailed();
  }

  async removeByAdmin(contrachequeId) {
    const contracheque = await contrachequeRepository.findById(contrachequeId);

    if (!contracheque) {
      throw new Error("Contracheque não encontrado.");
    }

    const normalizedPath = String(contracheque.file_path || "").replace(/^\/+/, "");
    const absolutePath = path.join(__dirname, "..", normalizedPath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await contrachequeRepository.deleteById(contrachequeId);
  }

}

export default new ContrachequeService();