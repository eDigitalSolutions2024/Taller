const multer = require("multer");
const path = require("path");
const fs = require("fs");

const DEST_DIR = path.join(__dirname, "..", "uploads", "facturas");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    cb(null, DEST_DIR);
  },
  filename(req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes o PDF"));
  }
};

const uploadFactura = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = uploadFactura;
