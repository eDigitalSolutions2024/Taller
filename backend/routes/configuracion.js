// backend/routes/configuracion.js
// Versión mínima: solo el tipo de cambio que necesita Presupuesto y Venta
// para refacciones cotizadas en dólares. No es un puerto del módulo
// "configuracion" completo (unidades de medida, contadores, etc.).
const express = require('express');
const router = express.Router();

const TipoCambio = require('../models/TipoCambio');
const TipoCambioSie = require('../models/TipoCambioSie');
const CodigoSeq = require('../models/CodigoSeq');
const banxicoService = require('../service/banxicoService');
const { proteger, requiereRol } = require('../middleware/auth');

const FONDO_CAJA_KEY = 'fondoCaja';
const FONDO_CAJA_DEFAULT = 2000;
const FOLIO_OS_KEY = 'ordenServicio';

// Normaliza a medianoche UTC. TipoCambio.fecha viene de un <input type="date">
// (string "yyyy-MM-dd", que JS parsea como UTC) y TipoCambioSie.fecha viene
// de banxicoService ya normalizado a UTC — usar getters/setters UTC aquí es
// obligatorio para que ambas fechas se comparen igual sin importar la zona
// horaria del servidor.
function medianoche(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// GET /api/configuracion/tipo-cambio — historial (más reciente primero)
router.get('/tipo-cambio', proteger, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const data = await TipoCambio.find().sort({ fecha: -1, createdAt: -1 }).limit(limit);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Error listando tipo de cambio:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/configuracion/tipo-cambio/ultimo — la tasa vigente
router.get('/tipo-cambio/ultimo', proteger, async (req, res) => {
  try {
    const data = await TipoCambio.findOne().sort({ fecha: -1, createdAt: -1 });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Error obteniendo último tipo de cambio:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// POST /api/configuracion/tipo-cambio — captura una nueva tasa (solo admin)
router.post('/tipo-cambio', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const { valor, fecha } = req.body;
    const valorNum = Number(valor);
    if (!(valorNum > 0)) {
      return res.status(400).json({ ok: false, msg: 'El valor del tipo de cambio debe ser mayor a 0.' });
    }

    const data = await TipoCambio.create({
      valor: valorNum,
      fecha: fecha ? new Date(fecha) : new Date(),
      capturadoPor: req.user?.name || req.user?.email || '',
    });

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error('Error creando tipo de cambio:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/configuracion/tipo-cambio/sie — referencia SIE de Banxico (serie
// FIX). Es solo informativo: nunca se usa en cálculos, esos siguen tomando
// /tipo-cambio/ultimo. Guarda un snapshot por día en TipoCambioSie para no
// golpear la API de Banxico más de una vez al día; si Banxico falla, se
// degrada al último snapshot en BD.
router.get('/tipo-cambio/sie', proteger, async (req, res) => {
  try {
    const hoy = medianoche(new Date());
    let snapshot = await TipoCambioSie.findOne({ fecha: hoy });

    if (!snapshot) {
      try {
        const dato = await banxicoService.obtenerDatoOportuno();
        if (dato) {
          snapshot = await TipoCambioSie.findOneAndUpdate(
            { fecha: medianoche(dato.fecha) },
            { $set: { valor: dato.valor, serie: banxicoService.SERIE_FIX } },
            { new: true, upsert: true }
          );
        }
      } catch (errorBanxico) {
        // Sin conexión/token inválido: se sigue con el fallback de abajo
      }
    }

    if (!snapshot) {
      snapshot = await TipoCambioSie.findOne().sort({ fecha: -1 });
    }

    return res.json({ ok: true, data: snapshot || null });
  } catch (err) {
    console.error('Error obteniendo el tipo de cambio de referencia (SIE):', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/configuracion/tipo-cambio/historial-comparado — compara, fecha
// por fecha, el tipo de cambio usado en el sistema (TipoCambio) contra el
// que publicó Banxico ese mismo día (TipoCambioSie). Hace backfill contra el
// histórico de Banxico para fechas que aún no tengan snapshot en BD.
router.get('/tipo-cambio/historial-comparado', proteger, async (req, res) => {
  try {
    const historialManual = await TipoCambio.find().sort({ fecha: -1, createdAt: -1 });

    if (historialManual.length === 0) {
      return res.json({ ok: true, data: [] });
    }

    const fechas = historialManual.map((t) => medianoche(new Date(t.fecha)));
    const fechaMin = new Date(Math.min(...fechas));
    const fechaMax = medianoche(new Date());

    let snapshotsSie = await TipoCambioSie.find({ fecha: { $gte: fechaMin, $lte: fechaMax } });
    const fechasConSnapshot = new Set(snapshotsSie.map((s) => s.fecha.getTime()));
    const faltanSnapshots = fechas.some((f) => !fechasConSnapshot.has(f.getTime()));

    if (faltanSnapshots) {
      try {
        const toISO = (d) => d.toISOString().slice(0, 10);
        const datosHistoricos = await banxicoService.obtenerRangoHistorico(toISO(fechaMin), toISO(fechaMax));

        if (datosHistoricos.length > 0) {
          await TipoCambioSie.bulkWrite(
            datosHistoricos.map(({ fecha, valor }) => ({
              updateOne: {
                filter: { fecha: medianoche(fecha) },
                update: { $set: { valor, serie: banxicoService.SERIE_FIX } },
                upsert: true,
              },
            }))
          );
          snapshotsSie = await TipoCambioSie.find({ fecha: { $gte: fechaMin, $lte: fechaMax } });
        }
      } catch (errorBanxico) {
        // Sin conexión/token inválido: se muestra el historial con lo que ya haya en BD
      }
    }

    const sieByFecha = new Map(snapshotsSie.map((s) => [s.fecha.getTime(), s.valor]));

    const historial = historialManual.map((t) => {
      const key = medianoche(new Date(t.fecha)).getTime();
      return {
        fecha: t.fecha,
        valorSistema: t.valor,
        valorSie: sieByFecha.has(key) ? sieByFecha.get(key) : null,
      };
    });

    return res.json({ ok: true, data: historial });
  } catch (err) {
    console.error('Error obteniendo el historial comparado de tipo de cambio:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/configuracion/fondo-caja — monto fijo vigente (default si no se ha capturado)
router.get('/fondo-caja', proteger, async (req, res) => {
  try {
    const doc = await CodigoSeq.findOne({ key: FONDO_CAJA_KEY });
    return res.json({ ok: true, data: { valor: doc?.seq ?? FONDO_CAJA_DEFAULT } });
  } catch (err) {
    console.error('Error obteniendo fondo de caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/configuracion/fondo-caja — actualiza el monto (solo admin)
router.put('/fondo-caja', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const valorNum = Number(req.body?.valor);
    if (!(valorNum >= 0)) {
      return res.status(400).json({ ok: false, msg: 'El fondo de caja debe ser un número mayor o igual a 0.' });
    }

    const doc = await CodigoSeq.findOneAndUpdate(
      { key: FONDO_CAJA_KEY },
      { $set: { seq: valorNum } },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, data: { valor: doc.seq } });
  } catch (err) {
    console.error('Error actualizando fondo de caja:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/configuracion/folio-orden-servicio — último folio emitido y el
// próximo que se asignará (misma clave que usa POST /vehiculos al crear).
router.get('/folio-orden-servicio', proteger, async (req, res) => {
  try {
    const doc = await CodigoSeq.findOne({ key: FOLIO_OS_KEY });
    const ultimo = doc?.seq ?? 0;
    return res.json({
      ok: true,
      data: {
        ultimo,
        ultimoFolio: ultimo > 0 ? `OS-${String(ultimo).padStart(5, '0')}` : null,
        proximoFolio: `OS-${String(ultimo + 1).padStart(5, '0')}`,
      },
    });
  } catch (err) {
    console.error('Error obteniendo folio de orden de servicio:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/configuracion/folio-orden-servicio — ajusta el contador (solo
// admin). `ultimo` es el último folio ya usado; el siguiente que se genere
// será ultimo + 1. Útil para corregir el consecutivo si hace falta saltarlo.
router.put('/folio-orden-servicio', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const ultimo = Number(req.body?.ultimo);
    if (!Number.isFinite(ultimo) || ultimo < 0) {
      return res.status(400).json({ ok: false, msg: 'El folio debe ser un número mayor o igual a 0.' });
    }

    const doc = await CodigoSeq.findOneAndUpdate(
      { key: FOLIO_OS_KEY },
      { $set: { seq: ultimo } },
      { new: true, upsert: true }
    );

    return res.json({
      ok: true,
      data: {
        ultimo: doc.seq,
        ultimoFolio: doc.seq > 0 ? `OS-${String(doc.seq).padStart(5, '0')}` : null,
        proximoFolio: `OS-${String(doc.seq + 1).padStart(5, '0')}`,
      },
    });
  } catch (err) {
    console.error('Error actualizando folio de orden de servicio:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

module.exports = router;
