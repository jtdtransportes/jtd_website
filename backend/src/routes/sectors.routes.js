import express from "express";
import {
  getSectors,
  createSector,
  updateSector,
  deleteSector,
  getUsersWithSectors,
  updateUserSector,
} from "../controllers/sectors.controller.js";

const router = express.Router();

router.get("/", getSectors);
router.post("/", createSector);
router.put("/:id", updateSector);
router.delete("/:id", deleteSector);

router.get("/users", getUsersWithSectors);
router.put("/users/:userId/sector", updateUserSector);

export default router;