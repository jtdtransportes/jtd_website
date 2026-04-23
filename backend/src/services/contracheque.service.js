import { Readable } from "stream";
import contrachequeRepository from "../repositories/contracheque.repository.js";
import userRepository from "../repositories/user.repository.js";
import drive from "../config/googleDrive.js";

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

    const safeUserName = this.sanitizeName(user.nome);
    const finalFileName = `Contracheque-${safeUserName}-${ano}-${String(mes).padStart(2, "0")}.pdf`;

    const uploaded = await drive.files.create({
      requestBody: {
        name: finalFileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
      fields: "id,name,mimeType",
    });

    const created = await contrachequeRepository.create({
      user_id: userId,
      mes,
      ano,
      file_name: uploaded.data.name || finalFileName,
      original_name: file.originalname,
      drive_file_id: uploaded.data.id,
      mime_type: uploaded.data.mimeType || file.mimetype,
    });

    return created;
  }

  async listByUser(userId) {
    return contrachequeRepository.findAllByUserId(userId);
  }

  async deactivate(userId, contrachequeId) {
    const contracheque = await contrachequeRepository.findByIdAndUserId(
      contrachequeId,
      userId
    );

    if (!contracheque) {
      throw new Error("Contracheque não encontrado.");
    }

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

    if (contracheque.drive_file_id) {
      await drive.files.delete({
        fileId: contracheque.drive_file_id,
      });
    }

    await contrachequeRepository.deleteById(contrachequeId);
  }

  async getDownloadStream(userId, contrachequeId, isAdmin = false) {
    const contracheque = isAdmin
      ? await contrachequeRepository.findById(contrachequeId)
      : await contrachequeRepository.findByIdAndUserId(contrachequeId, userId);

    if (!contracheque) {
      throw new Error("Contracheque não encontrado.");
    }

    if (!contracheque.drive_file_id) {
      throw new Error("Arquivo não encontrado no Google Drive.");
    }

    const response = await drive.files.get(
      {
        fileId: contracheque.drive_file_id,
        alt: "media",
      },
      {
        responseType: "stream",
      }
    );

    return {
      contracheque,
      stream: response.data,
    };
  }
}

export default new ContrachequeService();