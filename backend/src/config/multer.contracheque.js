import multer from "multer";

function fileFilter(_, file, cb) {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Apenas arquivos PDF são permitidos."));
  }

  cb(null, true);
}

const uploadContracheque = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadContracheque;