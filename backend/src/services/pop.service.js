import { Readable } from "stream";
import popRepository from "../repositories/pop.repository.js";
import userRepository from "../repositories/user.repository.js";
import drive from "../config/googleDrive.js";

class PopService {
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

    const title = String(file.originalname || "POP").replace(/\.pdf$/i, "").trim();

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
      return await popRepository.create({
        sector_id: sectorId,
        title,
        file_name: uploaded.data.name || finalFileName,
        original_name: file.originalname,
        drive_file_id: uploaded.data.id,
        mime_type: uploaded.data.mimeType || file.mimetype,
        created_by: createdBy,
      });
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

    if (!user.sector_id) {
      return {
        sector_id: null,
        sector_name: null,
        pops: [],
      };
    }

    const pops = await popRepository.findActiveBySectorId(user.sector_id);

    return {
      sector_id: user.sector_id,
      sector_name: user.sector_name || null,
      pops,
    };
  }

  async listAllForAdmin() {
    return popRepository.findAllDetailed();
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

  async getDownloadStream(userId, popId, isAdmin = false) {
    const pop = await popRepository.findById(popId);

    if (!pop || Number(pop.is_active) !== 1) {
      throw new Error("POP nao encontrado.");
    }

    if (!isAdmin) {
      const user = await userRepository.findById(userId);

      if (!user || Number(user.sector_id) !== Number(pop.sector_id)) {
        throw new Error("Voce nao tem acesso a este POP.");
      }
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
      pop,
      stream: response.data,
    };
  }
}

export default new PopService();
