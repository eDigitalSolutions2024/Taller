const mongoose = require('mongoose');

const tipoCambioSchema = new mongoose.Schema(
  {
    valor: { type: Number, required: true, min: 0 },
    fecha: { type: Date, required: true, default: Date.now },
    capturadoPor: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TipoCambio', tipoCambioSchema);
