const express = require('express');
const router = express.Router();

const CierreCaja = require('../models/CierreCaja');
const { DENOMINACIONES_BILLETES, DENOMINACIONES_MONEDAS } = CierreCaja;
const CodigoSeq = require('../models/CodigoSeq');
const { proteger, requiereRol } = require('../middleware/auth');
const { calcularTotalesCierre } = require('../utils/cierreCajaTotales');
const { calcularTotalesIngresosDia } = require('../utils/totalIngresosDia');
const { listarComprobantesDia } = require('../utils/comprobantesDia');
const { streamCierreCajaPdf } = require('../service/cierreCajaPdf');

const FONDO_CAJA_KEY = 'fondoCaja';
const FONDO_CAJA_DEFAULT = 2000;

async function obtenerFondoCajaConfig() {
  const doc = await CodigoSeq.findOne({ key: FONDO_CAJA_KEY });
  return doc?.seq ?? FONDO_CAJA_DEFAULT;
}

// El día se identifica por su medianoche local, igual que el resto de la app.
function normalizarFecha(fecha) {
  if (!fecha) return null;
  const soloFecha = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) return null;
  const [y, m, d] = soloFecha.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function conteoVacio(denominaciones) {
  return denominaciones.map((denominacion) => ({ denominacion, cantidad: 0 }));
}

function normalizarConteo(denominaciones, capturado) {
  const porDenominacion = new Map((capturado || []).map((c) => [Number(c.denominacion), Number(c.cantidad) || 0]));
  return denominaciones.map((denominacion) => ({
    denominacion,
    cantidad: porDenominacion.get(denominacion) || 0,
  }));
}

// Captura acumulativa: cada "Guardar" SUMA lo recién contado al total ya
// guardado (no lo reemplaza) — el formulario se limpia a 0 después de cada
// guardado, así que lo que llega en `capturado` es solo el incremento.
function sumarConteo(denominaciones, existente, capturado) {
  const previo = new Map((existente || []).map((c) => [Number(c.denominacion), Number(c.cantidad) || 0]));
  const nuevo = new Map((capturado || []).map((c) => [Number(c.denominacion), Number(c.cantidad) || 0]));
  return denominaciones.map((denominacion) => ({
    denominacion,
    cantidad: (previo.get(denominacion) || 0) + (nuevo.get(denominacion) || 0),
  }));
}

function cierreVacio(fecha) {
  return {
    fecha,
    billetes: conteoVacio(DENOMINACIONES_BILLETES),
    monedas: conteoVacio(DENOMINACIONES_MONEDAS),
    terminales: {},
    dolares: { cantidad: 0, tipoCambio: 0 },
    totalReportes: 0,
    fondoCaja: 0,
    capturadoPor: '',
    estado: 'ABIERTA',
    cerradoEn: null,
    cerradoPor: '',
  };
}

// GET /api/cierre-caja?fecha=YYYY-MM-DD
router.get('/', proteger, async (req, res) => {
  try {
    const fecha = normalizarFecha(req.query.fecha);
    if (!fecha) return res.status(400).json({ ok: false, msg: 'Parámetro fecha requerido (YYYY-MM-DD).' });

    const cierre = await CierreCaja.findOne({ fecha }).lean();
    const base = cierre || cierreVacio(fecha);

    const data = {
      ...base,
      billetes: normalizarConteo(DENOMINACIONES_BILLETES, base.billetes),
      monedas: normalizarConteo(DENOMINACIONES_MONEDAS, base.monedas),
      estado: base.estado || 'ABIERTA',
    };

    // Mientras el día siga abierto, terminales/totalReportes/fondoCaja no se
    // capturan a mano: se calculan en vivo. Un día ya CERRADA conserva los
    // valores congelados al momento del cierre.
    if (data.estado !== 'CERRADA') {
      const [ingresos, fondoCaja] = await Promise.all([
        calcularTotalesIngresosDia(fecha),
        obtenerFondoCajaConfig(),
      ]);
      data.totalReportes = ingresos.total;
      data.terminales = ingresos.terminales;
      data.fondoCaja = fondoCaja;
    }

    data.comprobantes = await listarComprobantesDia(fecha);

    return res.json({ ok: true, data, totales: calcularTotalesCierre(data), guardado: !!cierre });
  } catch (err) {
    console.error('Error obteniendo cierre de caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/cierre-caja/historial?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/historial', proteger, async (req, res) => {
  try {
    const desde = normalizarFecha(req.query.desde);
    const hasta = normalizarFecha(req.query.hasta);
    if (!desde || !hasta) {
      return res.status(400).json({ ok: false, msg: 'Parámetros desde y hasta requeridos (YYYY-MM-DD).' });
    }

    const cierres = await CierreCaja.find({ fecha: { $gte: desde, $lte: hasta }, estado: 'CERRADA' })
      .sort({ fecha: -1 })
      .lean();

    const data = cierres.map((c) => ({
      fecha: c.fecha,
      capturadoPor: c.capturadoPor,
      cerradoPor: c.cerradoPor,
      totalReportes: Number(c.totalReportes || 0),
      ...calcularTotalesCierre(c),
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Error obteniendo historial de cierres de caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// POST /api/cierre-caja -> crea o actualiza (upsert) el cierre de una fecha
router.post('/', proteger, async (req, res) => {
  try {
    const fecha = normalizarFecha(req.body?.fecha);
    if (!fecha) return res.status(400).json({ ok: false, msg: 'Parámetro fecha requerido (YYYY-MM-DD).' });

    const existente = await CierreCaja.findOne({ fecha }).select('estado billetes monedas dolares');
    if (existente?.estado === 'CERRADA') {
      return res.status(400).json({ ok: false, msg: 'La caja de este día ya está cerrada.' });
    }

    const body = req.body || {};
    const [ingresos, fondoCaja] = await Promise.all([
      calcularTotalesIngresosDia(fecha),
      obtenerFondoCajaConfig(),
    ]);

    const update = {
      fecha,
      billetes: sumarConteo(DENOMINACIONES_BILLETES, existente?.billetes, body.billetes),
      monedas: sumarConteo(DENOMINACIONES_MONEDAS, existente?.monedas, body.monedas),
      terminales: ingresos.terminales,
      dolares: {
        cantidad: (Number(existente?.dolares?.cantidad) || 0) + (Number(body.dolares?.cantidad) || 0),
        tipoCambio: Number(body.dolares?.tipoCambio) || Number(existente?.dolares?.tipoCambio) || 0,
      },
      totalReportes: ingresos.total,
      fondoCaja,
      capturadoPor: req.user?.name || req.user?.email || '',
    };

    const cierre = await CierreCaja.findOneAndUpdate(
      { fecha },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ ok: true, data: cierre, totales: calcularTotalesCierre(cierre) });
  } catch (err) {
    console.error('Error guardando cierre de caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// POST /api/cierre-caja/cerrar -> congela el cierre del día
router.post('/cerrar', proteger, async (req, res) => {
  try {
    const fecha = normalizarFecha(req.body?.fecha);
    if (!fecha) return res.status(400).json({ ok: false, msg: 'Parámetro fecha requerido (YYYY-MM-DD).' });

    const existente = await CierreCaja.findOne({ fecha });
    if (existente?.estado === 'CERRADA') {
      return res.status(400).json({ ok: false, msg: 'La caja de este día ya está cerrada.' });
    }

    const [ingresos, fondoCaja] = await Promise.all([
      calcularTotalesIngresosDia(fecha),
      obtenerFondoCajaConfig(),
    ]);
    const base = existente ? existente.toObject() : cierreVacio(fecha);

    const cierre = await CierreCaja.findOneAndUpdate(
      { fecha },
      {
        $set: {
          fecha,
          billetes: normalizarConteo(DENOMINACIONES_BILLETES, base.billetes),
          monedas: normalizarConteo(DENOMINACIONES_MONEDAS, base.monedas),
          terminales: ingresos.terminales,
          dolares: {
            cantidad: Number(base.dolares?.cantidad) || 0,
            tipoCambio: Number(base.dolares?.tipoCambio) || 0,
          },
          totalReportes: ingresos.total,
          fondoCaja,
          estado: 'CERRADA',
          cerradoEn: new Date(),
          cerradoPor: req.user?.name || req.user?.email || '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ ok: true, data: cierre, totales: calcularTotalesCierre(cierre) });
  } catch (err) {
    console.error('Error cerrando caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// POST /api/cierre-caja/restablecer -> reabre un día ya cerrado (solo admin)
router.post('/restablecer', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const fecha = normalizarFecha(req.body?.fecha);
    if (!fecha) return res.status(400).json({ ok: false, msg: 'Parámetro fecha requerido (YYYY-MM-DD).' });

    const cierre = await CierreCaja.findOne({ fecha });
    if (!cierre) return res.status(404).json({ ok: false, msg: 'No hay un cierre de caja guardado para esta fecha.' });
    if (cierre.estado !== 'CERRADA') {
      return res.status(400).json({ ok: false, msg: 'La caja de este día no está cerrada.' });
    }

    cierre.estado = 'ABIERTA';
    cierre.restablecidoEn = new Date();
    cierre.restablecidoPor = req.user?.name || req.user?.email || '';
    await cierre.save();

    return res.json({ ok: true, data: cierre.toObject(), totales: calcularTotalesCierre(cierre) });
  } catch (err) {
    console.error('Error restableciendo cierre de caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/cierre-caja/pdf?fecha=YYYY-MM-DD
// Sin `proteger`: se abre vía window.open() y ese request no lleva header
// Authorization, igual que el resto de los PDFs de Cajas.
router.get('/pdf', async (req, res) => {
  try {
    const fecha = normalizarFecha(req.query.fecha);
    if (!fecha) return res.status(400).json({ ok: false, msg: 'Parámetro fecha requerido (YYYY-MM-DD).' });

    const cierre = await CierreCaja.findOne({ fecha }).lean();
    if (!cierre) {
      return res.status(404).json({ ok: false, msg: 'No hay un cierre de caja guardado para esta fecha.' });
    }
    cierre.comprobantes = await listarComprobantesDia(fecha);

    await streamCierreCajaPdf(res, cierre);
  } catch (err) {
    console.error('Error generando PDF de cierre de caja:', err);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: 'Error generando PDF' });
  }
});

module.exports = router;
