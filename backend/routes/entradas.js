const router = require('express').Router();
const EntradaInventario = require('../models/EntradaInventario');
const uploadFactura = require('../middleware/uploadFactura');
const { proteger, requiereRol } = require('../middleware/auth');

// 1) Crear SOLO el encabezado (con los campos del formulario)
router.post('/', uploadFactura.single('fotoFactura'), async (req, res) => {
  try {
    const { tipoComprobante, numero, moneda, formaPago, proveedorId, fechaFactura } = req.body;

    let fotoFactura;
    if (req.file) {
      fotoFactura = {
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/facturas/${req.file.filename}`,
      };
    }

    const entrada = await EntradaInventario.create({
      tipoComprobante, numero, moneda, formaPago,
      proveedorId, fechaFactura, fotoFactura
    });

    // Devuelves el _id para usarlo como entradaId en la tabla
    res.status(201).json({ success: true, entradaId: entrada._id });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// 1b) Obtener una entrada por _id (para el modal "Ver info" y para continuar
// la captura de un borrador)
router.get('/:entradaId', async (req, res) => {
  try {
    const entrada = await EntradaInventario.findById(req.params.entradaId)
      .populate('proveedorId', 'nombreProveedor nombre aliasProveedor rfc')
      .lean();

    if (!entrada) return res.status(404).json({ success: false, message: 'Entrada no encontrada' });

    res.json({ success: true, data: entrada });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// 2) Agregar renglón a `captura` (la tabla) usando el id de la entrada
router.post('/:entradaId/captura', async (req, res) => {
  try {
    const { entradaId } = req.params;
    const renglon = req.body; // {codigoInterno, descripcion, tipo, unidad, cantidad, costoUnitario, ...}

    const entrada = await EntradaInventario.findById(entradaId);
    if (!entrada) return res.status(404).json({ success:false, message:'Entrada no encontrada' });

    entrada.captura.push(renglon);
    await entrada.save();

    res.status(201).json({ success:true, captura: entrada.captura });
  } catch (e) {
    res.status(400).json({ success:false, message: e.message });
  }
});

// 3) Finalizar entrada (cierra el borrador; ya no admite más renglones)
router.patch('/:entradaId/finalizar', async (req, res) => {
  try {
    const entrada = await EntradaInventario.findById(req.params.entradaId);
    if (!entrada) return res.status(404).json({ success: false, message: 'Entrada no encontrada' });

    entrada.estado = 'finalizada';
    await entrada.save();

    res.json({ success: true, message: 'Entrada finalizada' });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// 4) Subir o reemplazar la foto/PDF de factura de una entrada existente
router.patch('/:entradaId/foto', uploadFactura.single('fotoFactura'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });

    const entrada = await EntradaInventario.findById(req.params.entradaId);
    if (!entrada) return res.status(404).json({ success: false, message: 'Entrada no encontrada' });

    entrada.fotoFactura = {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/facturas/${req.file.filename}`,
    };
    await entrada.save();

    res.json({ success: true, fotoFactura: entrada.fotoFactura });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// 5) Editar entrada completa — solo admin
router.put('/:entradaId', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const entrada = await EntradaInventario.findById(req.params.entradaId);
    if (!entrada) return res.status(404).json({ success: false, message: 'Entrada no encontrada' });

    const { tipoComprobante, numero, fechaFactura, proveedorId, moneda, formaPago, captura } = req.body;

    if (tipoComprobante !== undefined) entrada.tipoComprobante = tipoComprobante;
    if (numero          !== undefined) entrada.numero          = numero;
    if (fechaFactura    !== undefined) entrada.fechaFactura    = fechaFactura;
    if (proveedorId     !== undefined) entrada.proveedorId     = proveedorId || null;
    if (moneda          !== undefined) entrada.moneda          = moneda;
    if (formaPago       !== undefined) entrada.formaPago       = formaPago;
    if (Array.isArray(captura))        entrada.captura         = captura;

    await entrada.save();

    const actualizada = await EntradaInventario.findById(entrada._id)
      .populate('proveedorId', 'nombreProveedor nombre aliasProveedor')
      .lean();

    res.json({ success: true, data: actualizada });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// 6) Eliminar borrador (una entrada ya finalizada no se puede borrar)
router.delete('/:entradaId', async (req, res) => {
  try {
    const entrada = await EntradaInventario.findById(req.params.entradaId);
    if (!entrada) return res.status(404).json({ success: false, message: 'Entrada no encontrada' });
    if (entrada.estado !== 'borrador') {
      return res.status(400).json({ success: false, message: 'Solo se pueden eliminar borradores' });
    }
    await entrada.deleteOne();
    res.json({ success: true, message: 'Borrador eliminado correctamente' });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

module.exports = router;
