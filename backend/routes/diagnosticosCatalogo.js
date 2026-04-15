const express = require('express');
const router = express.Router();

const DiagnosticoCatalogo = require('../models/DiagnosticoCatalogo');

// 👉 Obtener todos los diagnósticos
router.get('/', async (req, res) => {
  try {
    const data = await DiagnosticoCatalogo.find()
      .sort({ vecesUsado: -1, texto: 1 });

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('GET diagnosticos-catalogo error:', err);
    return res.status(500).json({
      ok: false,
      msg: 'Error al obtener diagnósticos',
      error: err.message,
    });
  }
});

// 👉 Crear nuevo diagnóstico (evitando duplicados)
router.post('/', async (req, res) => {
  try {
    console.log('POST /diagnosticos-catalogo body:', req.body);

    const textoRaw = req.body?.texto;

    if (typeof textoRaw !== 'string') {
      return res.status(400).json({
        ok: false,
        msg: 'Texto requerido y debe ser string',
      });
    }

    const textoLimpio = textoRaw.trim();

    if (!textoLimpio) {
      return res.status(400).json({
        ok: false,
        msg: 'Texto requerido',
      });
    }

    const existente = await DiagnosticoCatalogo.findOne({ texto: textoLimpio });

    if (existente) {
      return res.json({ ok: true, diagnostico: existente, repetido: true });
    }

    const nuevo = await DiagnosticoCatalogo.create({
      texto: textoLimpio,
      vecesUsado: 0,
    });

    return res.json({ ok: true, diagnostico: nuevo });
  } catch (err) {
    console.error('POST diagnosticos-catalogo error:', err);
    return res.status(500).json({
      ok: false,
      msg: 'Error al guardar diagnóstico',
      error: err.message,
    });
  }
});

// 👉 Incrementar uso
router.patch('/:id/usar', async (req, res) => {
  try {
    const { id } = req.params;

    const diag = await DiagnosticoCatalogo.findByIdAndUpdate(
      id,
      { $inc: { vecesUsado: 1 } },
      { new: true }
    );

    if (!diag) {
      return res.status(404).json({
        ok: false,
        msg: 'Diagnóstico no encontrado',
      });
    }

    return res.json({ ok: true, diagnostico: diag });
  } catch (err) {
    console.error('PATCH diagnosticos-catalogo error:', err);
    return res.status(500).json({
      ok: false,
      msg: 'Error al actualizar uso',
      error: err.message,
    });
  }
});

module.exports = router;