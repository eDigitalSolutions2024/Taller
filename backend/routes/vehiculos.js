// backend/routes/vehiculos.js
const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');

// POST /api/vehiculos  -> registrar nuevo vehículo para un cliente
router.post('/', async (req, res) => {
  try {
    const { clienteId, ...data } = req.body;

    if (!clienteId) {
      return res
        .status(400)
        .json({ ok: false, msg: 'clienteId es obligatorio' });
    }

    const vehiculo = new Vehiculo({
      cliente: clienteId,
      ...data,
    });

    await vehiculo.save();

    return res.status(201).json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error creando vehiculo:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// (Opcional) GET /api/vehiculos/cliente/:clienteId -> listar vehículos del cliente
router.get('/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const vehiculos = await Vehiculo.find({ cliente: clienteId }).sort({
      createdAt: -1,
    });
    return res.json({ ok: true, data: vehiculos });
  } catch (err) {
    console.error('Error listando vehiculos:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

module.exports = router;
