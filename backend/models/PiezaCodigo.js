const mongoose = require('mongoose');

const piezaCodigoSchema = new mongoose.Schema(
  {
    codigo: {
      type: String, required: true, unique: true, trim: true, uppercase: true,
    },
    nombrePieza:  { type: String, required: true, trim: true },
    numeroPieza:  { type: String, trim: true, default: '' },
    proveedor:    { type: String, required: true, trim: true },
    marca:        { type: String, trim: true, default: '' },
    unidadMedida: {
      type: String, trim: true, default: 'PZA',
      enum: ['PZA', 'PAR', 'JGO', 'LT', 'ML', 'KG', 'GR', 'MT', 'CM', 'OTRO'],
    },
    cantidad:       { type: Number, required: true, min: 0, default: 0 },
    cantidadMinima: { type: Number, min: 0, default: 0 },   // ← NUEVO
    cantidadMaxima: { type: Number, min: 0, default: 0 },   // ← NUEVO (0 = sin límite)
    precioUnitario: { type: Number, required: true, min: 0, default: 0 },
    estatus: {
      type: String,
      enum: ['disponible', 'agotado', 'bajo_inventario', 'descontinuado'],
      default: 'disponible',
    },
    notas: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'piezas_codigos_prueba',
  }
);

// Auto-calcular estatus según cantidad y cantidadMinima
piezaCodigoSchema.pre('save', function (next) {
  if (this.estatus !== 'descontinuado') {
    if (this.cantidad === 0) {
      this.estatus = 'agotado';
    } else if (this.cantidadMinima > 0 && this.cantidad <= this.cantidadMinima) {
      // Si hay mínimo definido, usar ese umbral
      this.estatus = 'bajo_inventario';
    } else if (this.cantidadMinima === 0 && this.cantidad <= 5) {
      // Si no hay mínimo definido, usar umbral por defecto de 5
      this.estatus = 'bajo_inventario';
    } else {
      this.estatus = 'disponible';
    }
  }
  next();
});

piezaCodigoSchema.index({ codigo: 1 });
piezaCodigoSchema.index({ nombrePieza: 'text', proveedor: 'text', marca: 'text' });

module.exports = mongoose.model('PiezaCodigo', piezaCodigoSchema);