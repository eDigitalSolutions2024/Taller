// backend/routes/vehiculos.js
const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');
const { streamVehiculoOperativoPdf } = require('../service/VehiculoOperativoPdf');
const { streamVehiculoOrdenPdf } = require('../service/vehiculoOrdenPdf');

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


// GET /api/vehiculos/ordenes?estado=PENDIENTE_CAPTURA&searchOs=&search=&page=1&limit=10
router.get('/ordenes', async (req, res) => {
  try {
    const {
      estado = 'PENDIENTE_CAPTURA',
      searchOs = '',
      search = '',
      page = 1,
      limit = 10,
    } = req.query;

    const q = {};

    if (estado) {
      q.estadoOrden = estado;
    }

    // Buscar por número de orden exacto o parcial
    if (searchOs) {
      q.ordenServicio = { $regex: searchOs, $options: 'i' };
    }

    // Búsqueda general (cliente, placas, marca/modelo, etc.)
    if (search) {
      q.$or = [
        { nombreGobierno: { $regex: search, $options: 'i' } }, // cliente
        { placas: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } },
        { modelo: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Vehiculo.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('cliente', 'nombre'), // si quieres traer nombre del cliente
      Vehiculo.countDocuments(q),
    ]);

    return res.json({
      ok: true,
      data,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error('Error listando ordenes:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});


// PUT /api/vehiculos/:id/servicio  -> guarda servicio/reparación e inicia la orden
router.put('/:id/servicio', async (req, res) => {
  try {
    const { servicioReparacion } = req.body;

    const vehiculo = await Vehiculo.findByIdAndUpdate(
      req.params.id,
      {
        servicioReparacion,
        ordenIniciada: true,
        estadoOrden: 'PENDIENTE_REFACCIONARIA',  // 👈 mover de CAPTURA a REFACCIONARIA
      },
      { new: true }
    );

    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error actualizando servicio/reparación:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/requisicion-diagnostico
router.put('/:id/requisicion-diagnostico', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      diagnosticoTecnico,
      refacciones,      // viene del frontend
      cargosEnOrden,    // opcional, para después
      estadoOrden,      // opcional, si quieres avanzar el flujo
    } = req.body;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    // Diagnóstico
    if (diagnosticoTecnico !== undefined) {
      vehiculo.diagnosticoTecnico = diagnosticoTecnico;
    }

    // Refacciones solicitadas (las que ves en la tabla)
    if (Array.isArray(refacciones)) {
      vehiculo.refaccionesSolicitadas = refacciones;
    }

    // Cargos en orden (para después, si los mandas)
    if (Array.isArray(cargosEnOrden)) {
      vehiculo.cargosEnOrden = cargosEnOrden;
    }

    // Si quieres ir moviendo la orden de estado
    if (estadoOrden) {
      vehiculo.estadoOrden = estadoOrden;
    }

    await vehiculo.save();

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error guardando requisicion/diagnostico:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});



// GET /api/vehiculos/:id  -> detalle de una orden
router.get('/:id', async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findById(req.params.id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }
    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error obteniendo vehiculo:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});


// GET /api/vehiculos/:id/operativo-pdf
router.get('/:id/operativo-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findById(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: 'Orden no encontrada' });
    }

    await streamVehiculoOperativoPdf(res, vehiculo);
  } catch (err) {
    console.error('Error generando PDF operativo', err);
    res
      .status(500)
      .json({ success: false, message: 'Error al generar PDF operativo' });
  }
});

// PDF para "Imprimir" / contrato
router.get('/:id/orden-pdf', async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findById(req.params.id);
    if (!vehiculo) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }
    await streamVehiculoOrdenPdf(res, vehiculo);
  } catch (err) {
    console.error('Error generando PDF orden', err);
    res.status(500).json({ success: false, message: 'Error al generar PDF orden' });
  }
});



module.exports = router;
