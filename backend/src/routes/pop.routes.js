import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";
import popController from "../controllers/pop.controller.js";
import uploadPop from "../config/multer.pop.js";

const router = Router();

router.get("/", authMiddleware, (req, res) => popController.list(req, res));

router.post(
  "/upload",
  authMiddleware,
  adminMiddleware,
  uploadPop.single("pop"),
  (req, res) => popController.upload(req, res)
);

router.get("/admin/all", authMiddleware, adminMiddleware, (req, res) =>
  popController.listAllForAdmin(req, res)
);

router.get("/:id/download", authMiddleware, (req, res) =>
  popController.download(req, res)
);

router.delete("/:id", authMiddleware, adminMiddleware, (req, res) =>
  popController.removeByAdmin(req, res)
);

export default router;
