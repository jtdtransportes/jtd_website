import multer from "multer";

function fileFilter(_, file, cb) {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Apenas arquivos PDF sao permitidos."));
  }

  cb(null, true);
}

const uploadPop = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export default uploadPop;
