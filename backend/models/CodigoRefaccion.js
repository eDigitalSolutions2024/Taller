const mongoose = require('mongoose');

const CodigoRefaccionSchema = new mongoose.Schema({
  numeroParte:  { type: String, required: true, trim: true, unique: true },
  descripcion:  { type: String, trim: true },
  marca:        { type: String, trim: true },
}, { timestamps: true });

CodigoRefaccionSchema.index({ numeroParte: 1 }, { unique: true });
CodigoRefaccionSchema.index({ marca: 1 });
CodigoRefaccionSchema.index({ descripcion: 'text', numeroParte: 'text', marca: 'text' });

module.exports = mongoose.model('CodigoRefaccion', CodigoRefaccionSchema);
