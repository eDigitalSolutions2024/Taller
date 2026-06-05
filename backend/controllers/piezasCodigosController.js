const PiezaCodigo = require('../models/PiezaCodigo');

// ─── Generar código automático ─────────────────────────────────────────────
const generarCodigo = async (nombrePieza, marca) => {
  const prefijoPieza = nombrePieza
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase();
  const prefijoMarca = marca
    ? marca.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase()
    : 'XX';

  const fecha = new Date();
  const anio = fecha.getFullYear().toString().slice(-2);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');

  // Obtener siguiente consecutivo del día
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const count = await PiezaCodigo.countDocuments({ createdAt: { $gte: hoy } });
  const consecutivo = String(count + 1).padStart(4, '0');

  return `${prefijoPieza}${prefijoMarca}-${anio}${mes}-${consecutivo}`;
};

// ─── GET /api/piezas-codigos/generar-codigo ────────────────────────────────
exports.generarCodigoPreview = async (req, res) => {
  try {
    const { nombrePieza = 'PIE', marca = '' } = req.query;
    const codigo = await generarCodigo(nombrePieza, marca);
    res.json({ codigo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar código', error: error.message });
  }
};

// ─── GET /api/piezas-codigos ───────────────────────────────────────────────
exports.obtenerPiezas = async (req, res) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      busqueda = '',
      estatus,
      proveedor,
      marca,
      ordenar = 'createdAt',
      direccion = 'desc',
    } = req.query;

    const filtro = {};

    if (busqueda) {
      filtro.$or = [
        { codigo: { $regex: busqueda, $options: 'i' } },
        { nombrePieza: { $regex: busqueda, $options: 'i' } },
        { numeroPieza: { $regex: busqueda, $options: 'i' } },
        { proveedor: { $regex: busqueda, $options: 'i' } },
        { marca: { $regex: busqueda, $options: 'i' } },
      ];
    }

    if (estatus) filtro.estatus = estatus;
    if (proveedor) filtro.proveedor = { $regex: proveedor, $options: 'i' };
    if (marca) filtro.marca = { $regex: marca, $options: 'i' };

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const sortObj = { [ordenar]: direccion === 'asc' ? 1 : -1 };

    const [piezas, total] = await Promise.all([
      PiezaCodigo.find(filtro).sort(sortObj).skip(skip).limit(parseInt(limite)),
      PiezaCodigo.countDocuments(filtro),
    ]);

    res.json({
      piezas,
      total,
      pagina: parseInt(pagina),
      totalPaginas: Math.ceil(total / parseInt(limite)),
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener piezas', error: error.message });
  }
};

// ─── GET /api/piezas-codigos/:id ──────────────────────────────────────────
exports.obtenerPieza = async (req, res) => {
  try {
    const pieza = await PiezaCodigo.findById(req.params.id);
    if (!pieza) return res.status(404).json({ mensaje: 'Pieza no encontrada' });
    res.json(pieza);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener pieza', error: error.message });
  }
};

// ─── POST /api/piezas-codigos ──────────────────────────────────────────────
exports.crearPieza = async (req, res) => {
  try {
    const {
      codigo,
      nombrePieza,
      numeroPieza,
      proveedor,
      marca,
      unidadMedida,
      cantidad,
      cantidadMinima,
      cantidadMaxima,
      precioUnitario,
      estatus,
      notas,
    } = req.body;

    // Si no viene código, lo generamos automáticamente
    const codigoFinal = codigo
      ? codigo.toUpperCase().trim()
      : await generarCodigo(nombrePieza, marca);

    // Verificar que el código no exista
    const existente = await PiezaCodigo.findOne({ codigo: codigoFinal });
    if (existente) {
      return res.status(400).json({ mensaje: `El código ${codigoFinal} ya existe` });
    }

    const nuevaPieza = new PiezaCodigo({
      codigo: codigoFinal,
      nombrePieza,
      numeroPieza,
      proveedor,
      marca,
      unidadMedida,
      cantidad,
      cantidadMinima,
      cantidadMaxima,
      precioUnitario,
      estatus,
      notas,
    });

    await nuevaPieza.save();
    res.status(201).json({ mensaje: 'Pieza creada exitosamente', pieza: nuevaPieza });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ mensaje: 'El código de pieza ya existe' });
    }
    res.status(500).json({ mensaje: 'Error al crear pieza', error: error.message });
  }
};

// ─── PUT /api/piezas-codigos/:id ──────────────────────────────────────────
exports.actualizarPieza = async (req, res) => {
  try {
    const {
      codigo,
      nombrePieza,
      numeroPieza,
      proveedor,
      marca,
      unidadMedida,
      cantidad,
      cantidadMinima,
      cantidadMaxima,
      precioUnitario,
      estatus,
      notas,
    } = req.body;

    const pieza = await PiezaCodigo.findById(req.params.id);
    if (!pieza) return res.status(404).json({ mensaje: 'Pieza no encontrada' });

    // Si cambió el código, verificar que no exista
    if (codigo && codigo.toUpperCase().trim() !== pieza.codigo) {
      const existente = await PiezaCodigo.findOne({
        codigo: codigo.toUpperCase().trim(),
        _id: { $ne: req.params.id },
      });
      if (existente) {
        return res.status(400).json({ mensaje: `El código ${codigo} ya existe` });
      }
      pieza.codigo = codigo.toUpperCase().trim();
    }

    if (nombrePieza !== undefined) pieza.nombrePieza = nombrePieza;
    if (numeroPieza !== undefined) pieza.numeroPieza = numeroPieza;
    if (proveedor !== undefined) pieza.proveedor = proveedor;
    if (marca !== undefined) pieza.marca = marca;
    if (unidadMedida !== undefined) pieza.unidadMedida = unidadMedida;
    if (cantidad !== undefined) pieza.cantidad = cantidad;
    if (cantidadMinima !== undefined) pieza.cantidadMinima = cantidadMinima;
    if (cantidadMaxima !== undefined) pieza.cantidadMaxima = cantidadMaxima;
    if (precioUnitario !== undefined) pieza.precioUnitario = precioUnitario;
    if (estatus !== undefined) pieza.estatus = estatus;
    if (notas !== undefined) pieza.notas = notas;

    await pieza.save();
    res.json({ mensaje: 'Pieza actualizada exitosamente', pieza });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ mensaje: 'El código de pieza ya existe' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar pieza', error: error.message });
  }
};

// ─── DELETE /api/piezas-codigos/:id ───────────────────────────────────────
exports.eliminarPieza = async (req, res) => {
  try {
    const pieza = await PiezaCodigo.findByIdAndDelete(req.params.id);
    if (!pieza) return res.status(404).json({ mensaje: 'Pieza no encontrada' });
    res.json({ mensaje: 'Pieza eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar pieza', error: error.message });
  }
};

// ─── GET /api/piezas-codigos/estadisticas ────────────────────────────────
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const stats = await PiezaCodigo.aggregate([
      {
        $group: {
          _id: '$estatus',
          total: { $sum: 1 },
          cantidadTotal: { $sum: '$cantidad' },
          valorTotal: { $sum: { $multiply: ['$cantidad', '$precioUnitario'] } },
        },
      },
    ]);

    const totalPiezas = await PiezaCodigo.countDocuments();

    res.json({ estadisticas: stats, totalPiezas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener estadísticas', error: error.message });
  }
};