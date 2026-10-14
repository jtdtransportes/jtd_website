import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";
import repository from "../repositories/contrachequeImport.repository.js";
import drive from "../config/googleDrive.js";
import { ContrachequeImportService, MAX_PDF_BYTES } from "../services/contrachequeImport.service.js";

const service = new ContrachequeImportService({
  repository, drive, secret: () => process.env.JWT_SECRET,
  folderId: () => process.env.GOOGLE_DRIVE_FOLDER_ID,
});

export function createContrachequeImportRouter(importService = service) {
  const router = Router();
  router.use(authMiddleware, adminMiddleware);
  router.post("/preview", async (req, res) => {
    try { res.json({ ok: true, ...await importService.preview(req.body, req.user.id) }); }
    catch (error) { res.status(400).json({ ok: false, message: error.message }); }
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 1, parts: 3, fieldSize: 8192 },
    fileFilter: (_, file, cb) => cb(null, file.mimetype === "application/pdf"),
  }).single("contracheque");
  router.post("/file", (req, res) => {
    upload(req, res, async (error) => {
      if (error) return res.status(400).json({ ok: false, message: "Envie um PDF de até 5 MB por requisição." });
      try { res.json({ ok: true, ...await importService.importFile(req.file, req.body, req.user.id) }); }
      catch (err) { res.status(400).json({ ok: false, message: err.message }); }
    });
  });
  return router;
}

export default createContrachequeImportRouter();
