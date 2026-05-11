import popService from "../services/pop.service.js";

class PopController {
  async upload(req, res) {
    try {
      const pop = await popService.upload(req.file, req.body, req.user.id);

      return res.status(201).json({
        ok: true,
        message: "POP enviado com sucesso.",
        pop,
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
      const result = await popService.listByUser(req.user.id);

      return res.status(200).json({
        ok: true,
        ...result,
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
      const pops = await popService.listAllForAdmin();

      return res.status(200).json({
        ok: true,
        pops,
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
      await popService.removeByAdmin(req.params.id);

      return res.status(200).json({
        ok: true,
        message: "POP removido com sucesso.",
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async download(req, res) {
    try {
      const { pop, stream } = await popService.getDownloadStream(
        req.user.id,
        req.params.id
      );

      res.setHeader("Content-Type", pop.mime_type || "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${pop.file_name}"`);

      stream.on("error", (error) => {
        console.error("Erro no stream do Google Drive:", error.message);

        if (!res.headersSent) {
          return res.status(500).json({
            ok: false,
            message: "Erro ao baixar o arquivo.",
          });
        }

        res.end();
      });

      stream.pipe(res);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
}

export default new PopController();
