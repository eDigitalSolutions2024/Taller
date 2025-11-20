const router = require('express').Router();
const mongoose = require('mongoose');
const EntradaInventario = require('../models/EntradaInventario');
const SalidaInventario  = require('../models/SalidaInventario');

/* ===== Helpers ===== */
const toObjId = (v) => {
  try { return new mongoose.Types.ObjectId(v); } catch { return null; }
};

/** Devuelve un arreglo que contiene:
 *  - cada id como string
 *  - y si es 24-hex, también su ObjectId
 *  Así los $match con $in funcionan sin importar cómo se guardó (string u ObjectId).
 */
function expandIds(codigos) {
  const out = [];
  for (const c of codigos) {
    const s = String(c);
    out.push(s);
    const oid = toObjId(s);
    if (oid) out.push(oid);
  }
  return out;
}

/** Obtiene stock actual de una lista de códigos (entradas - salidas) */
async function getStockMap(codigos) {
  const ids = expandIds(codigos);

  // 1) Entradas (positivas)
  const entradas = await EntradaInventario.aggregate([
    { $unwind: '$captura' },
    { $match: { 'captura.codigoInterno': { $in: ids } } },
    { $group: {
        _id: '$captura.codigoInterno',
        cant: { $sum: { $ifNull: ['$captura.cantidad', 0] } }
    } },
  ]);

  // 2) Salidas (negativas)
  const salidas = await SalidaInventario.aggregate([
    { $unwind: '$partidas' },
    { $match: { 'partidas.codigoInterno': { $in: ids } } },
    { $group: {
        _id: '$partidas.codigoInterno',
        cant: { $sum: { $multiply: [ { $ifNull: ['$partidas.cantidad', 0] }, -1 ] } }
    } },
  ]);

  // 3) Merge
  const map = new Map();
  for (const d of [...entradas, ...salidas]) {
    const k = String(d._id);
    map.set(k, (map.get(k) || 0) + (d.cant || 0));
  }
  return map; // Map<string, number>
}

/** Obtiene la última "unidad" usada por código en las ENTRADAS */
async function getUnidadMap(codigos) {
  const ids = expandIds(codigos);
  const rows = await EntradaInventario.aggregate([
    { $unwind: '$captura' },
    { $match: { 'captura.codigoInterno': { $in: ids } } },
    { $sort: { fechaFactura: 1 } },
    { $group: { _id: '$captura.codigoInterno', unidad: { $last: '$captura.unidad' } } }
  ]);
  const map = new Map();
  rows.forEach(r => map.set(String(r._id), r.unidad || 'Pieza'));
  return map;
}

/* ===== Routes ===== */

/** POST /api/salidas  (crear una salida completa) */
router.post('/', async (req, res) => {
  try {
    const { fechaSalida, ordenServicio, partidas = [] } = req.body || {};

    if (!fechaSalida) return res.status(400).json({ success:false, message:'fechaSalida requerida' });
    if (!Array.isArray(partidas) || partidas.length === 0)
      return res.status(400).json({ success:false, message:'Agrega al menos una partida' });

    // Normaliza y valida
    const limpias = partidas.map(p => ({
      codigoInterno: p.codigoInterno,
      descripcion: (p.descripcion || '').trim(),
      marca: (p.marca || '').trim(),
      // unidad la rellenaremos más abajo con la última conocida; fallback "Pieza"
      unidad: (p.unidad || '').trim(),
      cantidad: Number(p.cantidad || 0),
    })).filter(p => p.codigoInterno && p.cantidad > 0);

    if (limpias.length === 0)
      return res.status(400).json({ success:false, message:'Partidas inválidas' });

    const cods = [...new Set(limpias.map(p => String(p.codigoInterno)))];

    // 1) Completar UNIDAD desde últimas entradas
    const unidadMap = await getUnidadMap(cods);
    for (const p of limpias) {
      if (!p.unidad) p.unidad = unidadMap.get(String(p.codigoInterno)) || 'Pieza';
    }

    // 2) Verificar stock disponible (entradas - salidas)
    const stockMap = await getStockMap(cods);
    const faltantes = [];
    for (const p of limpias) {
      const disp = stockMap.get(String(p.codigoInterno)) || 0;
      if (disp < p.cantidad) {
        faltantes.push({ codigoInterno: p.codigoInterno, disponible: disp, solicitado: p.cantidad });
      }
    }
    if (faltantes.length) {
      return res.status(409).json({
        success:false,
        message:'Stock insuficiente para uno o más códigos',
        data: faltantes
      });
    }

    // 3) Crear salida
    const salida = await SalidaInventario.create({
      fechaSalida: new Date(fechaSalida),
      ordenServicio: (ordenServicio || '').trim(),
      partidas: limpias,
      estatus: 'cerrada',
    });

    res.status(201).json({ success:true, data: salida });
  } catch (e) {
    console.error('POST /salidas error', e);
    res.status(500).json({ success:false, message: e?.message || 'Error al crear salida' });
  }
});

module.exports = router;
