import {
  getAllSectors,
  createNewSector,
  updateSectorById,
  deleteSectorById,
  getAllUsersWithSectors,
  updateUserSectorById,
} from "../services/sectors.service.js";

export async function getSectors(req, res) {
  try {
    const sectors = await getAllSectors();

    return res.status(200).json({
      ok: true,
      sectors,
    });
  } catch (error) {
    console.error("Erro ao buscar setores:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro ao buscar setores.",
    });
  }
}

export async function createSector(req, res) {
  try {
    const { descricao } = req.body;

    if (!descricao || !descricao.trim()) {
      return res.status(400).json({
        ok: false,
        message: "A descrição do setor é obrigatória.",
      });
    }

    const sector = await createNewSector({
      descricao: descricao.trim(),
    });

    return res.status(201).json({
      ok: true,
      message: "Setor criado com sucesso.",
      sector,
    });
  } catch (error) {
    console.error("Erro ao criar setor:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro ao criar setor.",
    });
  }
}

export async function updateSector(req, res) {
  try {
    const { id } = req.params;
    const { descricao } = req.body;

    if (!descricao || !descricao.trim()) {
      return res.status(400).json({
        ok: false,
        message: "A descrição do setor é obrigatória.",
      });
    }

    const sector = await updateSectorById(id, {
      descricao: descricao.trim(),
    });

    if (!sector) {
      return res.status(404).json({
        ok: false,
        message: "Setor não encontrado.",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Setor atualizado com sucesso.",
      sector,
    });
  } catch (error) {
    console.error("Erro ao atualizar setor:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro ao atualizar setor.",
    });
  }
}

export async function deleteSector(req, res) {
  try {
    const { id } = req.params;

    const deleted = await deleteSectorById(id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message: "Setor não encontrado.",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Setor excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir setor:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(400).json({
        ok: false,
        message:
          "Este setor não pode ser excluído porque possui usuários vinculados a ele.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Erro ao excluir setor.",
    });
  }
}

export async function getUsersWithSectors(req, res) {
  try {
    const users = await getAllUsersWithSectors();

    return res.status(200).json({
      ok: true,
      users,
    });
  } catch (error) {
    console.error("Erro ao buscar usuários com setores:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro ao buscar usuários.",
    });
  }
}

export async function updateUserSector(req, res) {
  try {
    const { userId } = req.params;
    const { sector_id } = req.body;

    const updatedUser = await updateUserSectorById(userId, sector_id);

    if (!updatedUser) {
      return res.status(404).json({
        ok: false,
        message: "Usuário não encontrado.",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Setor do usuário atualizado com sucesso.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Erro ao atualizar setor do usuário:", error);

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        ok: false,
        message: "Setor selecionado não existe.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Erro ao atualizar setor do usuário.",
    });
  }
}