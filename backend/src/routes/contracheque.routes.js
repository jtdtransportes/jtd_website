import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import contrachequeController from "../controllers/contracheque.controller.js";
import uploadContracheque from "../config/multer.contracheque.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = Router();

router.post(
  "/upload",
  authMiddleware,
  adminMiddleware,
  uploadContracheque.single("contracheque"),
  (req, res) => contrachequeController.upload(req, res)
);

router.get("/", authMiddleware, (req, res) =>
  contrachequeController.list(req, res)
);

router.get("/:id/download", authMiddleware, (req, res) =>
  contrachequeController.download(req, res)
);

router.patch("/:id/deactivate", authMiddleware, (req, res) =>
  contrachequeController.deactivate(req, res)
);

router.get("/admin/all", authMiddleware, adminMiddleware, (req, res) =>
  contrachequeController.listAllForAdmin(req, res)
);

router.delete("/:id", authMiddleware, adminMiddleware, (req, res) =>
  contrachequeController.removeByAdmin(req, res)
);

export default router;