const Vehiculo = require('../models/Vehiculo');

const COMPROBANTES_INGRESO = ['NOTA_VENTA', 'REMISION', 'RECIBO_PROVISIONAL'];

// Bancos reales de pago.notaVenta.banco (ver BANCOS_CAJA en models/Vehiculo.js)
// que se suman como terminal; EFECTIVOS/DOLARES quedan fuera porque ya se
// reflejan en el conteo físico de billetes/monedas y en Dólares.
const BANCOS_TERMINAL = ['BANREGIO', 'AMERICAN EXPRESS', 'BANAMEX', 'BANORTE', 'BBVA BANCOMER'];

// `fecha` llega como medianoche que etiqueta un día calendario LOCAL. pago.fecha
// en cambio es un instante real, así que el rango desde/hasta debe ser la
// medianoche a medianoche LOCAL de ese día (no UTC) — construir el Date con
// los componentes locales (año/mes/día) da el límite correcto en la zona
// horaria en la que corre el servidor del taller.
function limitesDiaLocal(fecha) {
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth();
  const dia = fecha.getUTCDate();
  const desde = new Date(anio, mes, dia, 0, 0, 0, 0);
  const hasta = new Date(anio, mes, dia + 1, 0, 0, 0, -1);
  return { desde, hasta };
}

function terminalDePago(pago) {
  if (pago.comprobante === 'NOTA_VENTA' && BANCOS_TERMINAL.includes(pago.notaVenta?.banco)) {
    return pago.notaVenta.banco;
  }
  if (pago.comprobante === 'RECIBO_PROVISIONAL') {
    const fp = pago.reciboProvisional?.formaPago;
    if (fp === 'CREDITO' || fp === 'DEBITO') return 'OTRAS_TARJETAS';
    if (fp === 'CHEQUE') return 'CHEQUE';
  }
  return null;
}

// Suma lo efectivamente cobrado en un día (pagos no cancelados de los 3
// comprobantes) y lo desglosa por terminal, para comparar contra el conteo
// físico de Gestión de Caja.
async function calcularTotalesIngresosDia(fecha) {
  const { desde, hasta } = limitesDiaLocal(fecha);

  const ordenes = await Vehiculo.find({
    pagos: {
      $elemMatch: {
        comprobante: { $in: COMPROBANTES_INGRESO },
        fecha: { $gte: desde, $lte: hasta },
      },
    },
  })
    .select('pagos')
    .lean();

  let total = 0;
  const terminales = {};

  for (const orden of ordenes) {
    for (const pago of orden.pagos || []) {
      if (pago.cancelado) continue;
      if (!COMPROBANTES_INGRESO.includes(pago.comprobante)) continue;
      const f = new Date(pago.fecha);
      if (f < desde || f > hasta) continue;

      const monto = Number(pago.monto || 0);
      total += monto;

      const terminal = terminalDePago(pago);
      if (terminal) terminales[terminal] = (terminales[terminal] || 0) + monto;
    }
  }

  return { total, terminales };
}

module.exports = { calcularTotalesIngresosDia, limitesDiaLocal };
