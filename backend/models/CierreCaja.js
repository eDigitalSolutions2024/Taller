const mongoose = require('mongoose');
const { Schema } = mongoose;

// Denominaciones fijas del formato en papel (billetes y monedas de curso legal).
const DENOMINACIONES_BILLETES = [1000, 500, 200, 100, 50, 20];
const DENOMINACIONES_MONEDAS = [10, 5, 2, 1, 0.5, 0.2, 0.1];

// Terminales que se suman solas a partir de los pagos del día (ver
// utils/totalIngresosDia): los 5 bancos reales de pago.notaVenta.banco
// (BANCOS_CAJA en models/Vehiculo.js, excluyendo EFECTIVOS/DOLARES que ya
// se reflejan en el conteo físico de billetes/monedas y en Dólares) más
// tarjeta/cheque de pago.reciboProvisional.formaPago.
const TERMINALES_KEYS = [
  'BANREGIO',
  'AMERICAN EXPRESS',
  'BANAMEX',
  'BANORTE',
  'BBVA BANCOMER',
  'OTRAS_TARJETAS',
  'CHEQUE',
];

const conteoSchema = new Schema(
  {
    denominacion: { type: Number, required: true },
    cantidad: { type: Number, default: 0 },
  },
  { _id: false }
);

const cierreCajaSchema = new Schema(
  {
    // Medianoche local del día que se cierra.
    fecha: { type: Date, required: true },

    billetes: [conteoSchema],
    monedas: [conteoSchema],

    // Todas auto-calculadas desde los pagos del día mientras la caja sigue
    // ABIERTA; se congelan al cerrar (ver POST /cerrar).
    terminales: {
      BANREGIO: { type: Number, default: 0 },
      'AMERICAN EXPRESS': { type: Number, default: 0 },
      BANAMEX: { type: Number, default: 0 },
      BANORTE: { type: Number, default: 0 },
      'BBVA BANCOMER': { type: Number, default: 0 },
      OTRAS_TARJETAS: { type: Number, default: 0 },
      CHEQUE: { type: Number, default: 0 },
    },

    // Dólares físicos contados a mano (no se infieren de los pagos: un pago
    // en USD puede haberse liquidado por transferencia, no en billete).
    dolares: {
      cantidad: { type: Number, default: 0 },
      tipoCambio: { type: Number, default: 0 },
    },

    // totalReportes y fondoCaja se recalculan server-side (pagos del día /
    // Configuración) mientras la caja sigue ABIERTA, y se congelan al cerrar.
    totalReportes: { type: Number, default: 0 },
    fondoCaja: { type: Number, default: 0 },

    capturadoPor: { type: String, default: '' },

    // ABIERTA: el día se sigue capturando desde Gestión de Caja (editable).
    // CERRADA: el reporte quedó congelado, solo lectura.
    estado: { type: String, enum: ['ABIERTA', 'CERRADA'], default: 'ABIERTA' },
    cerradoEn: { type: Date, default: null },
    cerradoPor: { type: String, default: '' },

    // Solo un admin puede reabrir un día ya cerrado (directo, sin tickets).
    restablecidoEn: { type: Date, default: null },
    restablecidoPor: { type: String, default: '' },
  },
  { timestamps: true }
);

cierreCajaSchema.index({ fecha: 1 }, { unique: true });

module.exports = mongoose.model('CierreCaja', cierreCajaSchema);
module.exports.DENOMINACIONES_BILLETES = DENOMINACIONES_BILLETES;
module.exports.DENOMINACIONES_MONEDAS = DENOMINACIONES_MONEDAS;
module.exports.TERMINALES_KEYS = TERMINALES_KEYS;
