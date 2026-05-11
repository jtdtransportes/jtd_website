import { Readable } from "stream";
import popRepository from "../repositories/pop.repository.js";
import userRepository from "../repositories/user.repository.js";
import drive from "../config/googleDrive.js";
import { fixMojibake, fixObjectTextFields } from "../utils/textEncoding.js";

const POP_TEXT_FIELDS = ["title", "file_name", "original_name", "sector_name"];

class PopService {
  normalizePop(pop) {
    return fixObjectTextFields(pop, POP_TEXT_FIELDS);
  }

  normalizePops(pops) {
    return Array.isArray(pops) ? pops.map((pop) => this.normalizePop(pop)) : [];
  }

  sanitizeName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  getPopFolderId() {
    return process.env.GOOGLE_DRIVE_POP_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
  }

  async upload(file, data, createdBy) {
    const sectorId = Number(data.sector_id);

    if (!file) {
      throw new Error("Arquivo nao enviado.");
    }

    if (!sectorId) {
      throw new Error("Selecione o setor do POP.");
    }

    const originalName = fixMojibake(file.originalname || "POP");
    const title = String(originalName).replace(/\.pdf$/i, "").trim();

    if (!title.trim()) {
      throw new Error("Nao foi possivel identificar o nome do PDF.");
    }

    const sectorExists = await popRepository.sectorExists(sectorId);

    if (!sectorExists) {
      throw new Error("Setor selecionado nao existe.");
    }

    const safeTitle = this.sanitizeName(title);
    const finalFileName = `POP-${safeTitle || "documento"}-${Date.now()}.pdf`;
    const folderId = this.getPopFolderId();

    if (!folderId) {
      throw new Error("Pasta do Google Drive nao configurada.");
    }

    const uploaded = await drive.files.create({
      requestBody: {
        name: finalFileName,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
      fields: "id,name,mimeType",
    });

    try {
      const pop = await popRepository.create({
        sector_id: sectorId,
        title,
        file_name: uploaded.data.name || finalFileName,
        original_name: originalName,
        drive_file_id: uploaded.data.id,
        mime_type: uploaded.data.mimeType || file.mimetype,
        created_by: createdBy,
      });

      return this.normalizePop(pop);
    } catch (error) {
      if (uploaded.data.id) {
        await drive.files.delete({
          fileId: uploaded.data.id,
        });
      }

      throw error;
    }
  }

  async listByUser(userId) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("Usuario nao encontrado.");
    }

    const pops = await popRepository.findActivePrioritizingSector(user.sector_id);

    return {
      sector_id: user.sector_id || null,
      sector_name: fixMojibake(user.sector_name) || null,
      pops: this.normalizePops(pops),
    };
  }

  async listAllForAdmin() {
    const pops = await popRepository.findAllDetailed();
    return this.normalizePops(pops);
  }

  async removeByAdmin(popId) {
    const pop = await popRepository.findById(popId);

    if (!pop) {
      throw new Error("POP nao encontrado.");
    }

    if (pop.drive_file_id) {
      await drive.files.delete({
        fileId: pop.drive_file_id,
      });
    }

    await popRepository.deleteById(popId);
  }

  async getDownloadStream(popId) {
    const pop = await popRepository.findById(popId);

    if (!pop || Number(pop.is_active) !== 1) {
      throw new Error("POP nao encontrado.");
    }

    if (!pop.drive_file_id) {
      throw new Error("Arquivo nao encontrado no Google Drive.");
    }

    const response = await drive.files.get(
      {
        fileId: pop.drive_file_id,
        alt: "media",
      },
      {
        responseType: "stream",
      }
    );

    return {
      pop: this.normalizePop(pop),
      stream: response.data,
    };
  }
}

export default new PopService();
