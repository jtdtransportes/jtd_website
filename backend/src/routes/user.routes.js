import { Router } from "express";
import userController from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";
const router = Router();

router.post("/register", (req, res) => userController.register(req, res));
router.post("/login", (req, res) => userController.login(req, res));
router.get("/profile", authMiddleware, (req, res) => userController.profile(req, res));
router.put("/updateProfile", authMiddleware, (req, res) => userController.updateProfile(req, res));
router.patch("/deactivate", authMiddleware, (req, res) => userController.deactivateAccount(req, res));
router.put("/change-password", authMiddleware, (req, res) => userController.changePassword(req, res));
router.get("/", authMiddleware, (req, res) => userController.listUsers(req, res));
router.get("/admin/all", authMiddleware, adminMiddleware, (req, res) => userController.listUsersForAdmin(req, res));
router.patch("/:id/deactivate", authMiddleware, adminMiddleware, (req, res) => userController.adminDeactivateUser(req, res));
router.patch("/:id/activate", authMiddleware, adminMiddleware, (req, res) =>userController.adminActivateUser(req, res));
export default router;