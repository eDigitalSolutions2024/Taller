const Vehiculo = require('../models/Vehiculo');
const { limitesDiaLocal } = require('./totalIngresosDia');

const FOLIO_POR_TIPO = {
  NOTA_VENTA: (p) => p.notaVenta?.numero ?? null,
  REMISION: (p) => p.remision?.numero ?? null,
  RECIBO_PROVISIONAL: (p) => p.reciboProvisional?.numero ?? null,
};

const LABEL_POR_TIPO = {
  NOTA_VENTA: 'Nota de Venta',
  REMISION: 'Remisión',
  RECIBO_PROVISIONAL: 'Recibo Provisional',
};

// El nombre del cliente vive como snapshot plano en la propia orden (no hace
// falta populate('cliente')).
function nombreCliente(orden) {
  return (
    orden.nombreGobierno ||
    [orden.nombreCliente, orden.apellidoPaterno, orden.apellidoMaterno].filter(Boolean).join(' ') ||
    ''
  );
}

// Lista (no solo suma) de Notas de Venta, Remisiones y Recibos Provisionales
// generados en el día, para el resumen de Gestión de Caja.
async function listarComprobantesDia(fecha) {
  const { desde, hasta } = limitesDiaLocal(fecha);
  const tipos = Object.keys(FOLIO_POR_TIPO);

  const ordenes = await Vehiculo.find({
    pagos: { $elemMatch: { comprobante: { $in: tipos }, fecha: { $gte: desde, $lte: hasta } } },
  })
    .select('ordenServicio nombreCliente apellidoPaterno apellidoMaterno nombreGobierno pagos')
    .lean();

  const filas = [];
  for (const orden of ordenes) {
    for (const pago of orden.pagos || []) {
      if (pago.cancelado) continue;
      if (!tipos.includes(pago.comprobante)) continue;
      const f = new Date(pago.fecha);
      if (f < desde || f > hasta) continue;
      filas.push({
        tipo: pago.comprobante,
        tipoLabel: LABEL_POR_TIPO[pago.comprobante],
        folio: FOLIO_POR_TIPO[pago.comprobante](pago),
        fecha: pago.fecha,
        ordenServicio: orden.ordenServicio,
        vehiculoId: orden._id,
        pagoId: pago._id,
        cliente: nombreCliente(orden),
        monto: pago.monto || 0,
        registradoPor: pago.registradoPor || '',
      });
    }
  }
  filas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  return filas;
}

module.exports = { listarComprobantesDia };
