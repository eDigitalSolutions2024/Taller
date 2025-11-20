const router = require('express').Router();
const mongoose = require('mongoose');
const Codigo = require('../models/CodigoRefaccion');

// Listado + búsqueda + paginación
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 100)));
    const q = String(req.query.q || '').trim();

    const filter = q ? {
      $or: [
        { numeroParte:  new RegExp(q, 'i') },
        { descripcion:  new RegExp(q, 'i') },
        { marca:        new RegExp(q, 'i') },
      ],
    } : {};

    const total = await Codigo.countDocuments(filter);
    const data  = await Codigo.find(filter)
      .sort({ numeroParte: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ success: true, data, total, page, limit });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Options para el select
router.get('/options', async (_req, res) => {
  const list = await Codigo.find({}, { numeroParte:1, marca:1, descripcion:1 }).sort({ numeroParte:1 }).lean();
  const data = list.map(x => ({
    _id: x._id,
    label: `${x.numeroParte}${x.marca ? ' - ' + x.marca : ''}`,
    descripcion: x.descripcion || '',
  }));
  res.json({ success: true, data });
});

// Obtener uno
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ success:false, message:'ID inválido' });
  const doc = await Codigo.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ success:false, message:'No encontrado' });
  res.json({ success:true, data:doc });
});

// Crear
router.post('/', async (req, res) => {
  try {
    const payload = {
      numeroParte: (req.body.numeroParte || '').trim(),
      descripcion: (req.body.descripcion || '').trim(),
      marca: (req.body.marca || '').trim(),
    };
    if (!payload.numeroParte) throw new Error('Número de parte es obligatorio');
    const created = await Codigo.create(payload);
    res.status(201).json({ success:true, data:created });
  } catch (e) {
    res.status(400).json({ success:false, message:e.message });
  }
});

// Actualizar
router.put('/:id', async (req, res) => {
  try {
    const payload = {
      numeroParte: (req.body.numeroParte || '').trim(),
      descripcion: (req.body.descripcion || '').trim(),
      marca: (req.body.marca || '').trim(),
    };
    const updated = await Codigo.findByIdAndUpdate(
      req.params.id, payload, { new:true, runValidators:true }
    );
    if (!updated) return res.status(404).json({ success:false, message:'No encontrado' });
    res.json({ success:true, data:updated });
  } catch (e) {
    res.status(400).json({ success:false, message:e.message });
  }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  const del = await Codigo.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ success:false, message:'No encontrado' });
  res.json({ success:true });
});

module.exports = router;

