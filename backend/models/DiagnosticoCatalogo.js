// backend/models/DiagnosticoCatalogo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const diagnosticoCatalogoSchema = new Schema(
  {
    texto: { type: String, required: true, trim: true },
    vecesUsado: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DiagnosticoCatalogo', diagnosticoCatalogoSchema);