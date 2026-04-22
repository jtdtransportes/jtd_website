import contrachequeService from "../services/contracheque.service.js";

class ContrachequeController {
  async upload(req, res) {
    try {
      const contracheque = await contrachequeService.upload(req.file, req.body);

      return res.status(201).json({
        ok: true,
        message: "Contracheque enviado com sucesso.",
        contracheque,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async list(req, res) {
    try {
      const contracheques = await contrachequeService.listByUser(req.user.id);

      return res.status(200).json({
        ok: true,
        contracheques,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async deactivate(req, res) {
    try {
      await contrachequeService.deactivate(req.user.id, req.params.id);

      return res.status(200).json({
        ok: true,
        message: "Contracheque desativado com sucesso.",
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
  async listAllForAdmin(req, res) {
  try {
    const contracheques = await contrachequeService.listAllForAdmin();

    return res.status(200).json({
      ok: true,
      contracheques,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: error.message,
    });
  }
}

async removeByAdmin(req, res) {
  try {
    await contrachequeService.removeByAdmin(req.params.id);

    return res.status(200).json({
      ok: true,
      message: "Contracheque removido com sucesso.",
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: error.message,
    });
  }
}
}

export default new ContrachequeController();