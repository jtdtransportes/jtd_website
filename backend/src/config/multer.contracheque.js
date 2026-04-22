import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// necessário no ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// subir até /backend/src
const uploadDir = path.join(__dirname, "..", "uploads", "contracheques");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir);
  },
  filename: (_, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `temp_${timestamp}_${safeName}`);
  },
});

function fileFilter(_, file, cb) {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Apenas arquivos PDF são permitidos."));
  }

  cb(null, true);
}

const uploadContracheque = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadContracheque;