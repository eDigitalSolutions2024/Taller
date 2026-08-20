// backend/routes/vehiculos.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Vehiculo = require('../models/Vehiculo');
const OrdenCompra = require('../models/OrdenCompra');
const EntradaInventario = require('../models/EntradaInventario');
const SalidaInventario = require('../models/SalidaInventario');
const CodigoSeq = require('../models/CodigoSeq');
const { proteger, requiereRol } = require('../middleware/auth');
const { calcularTotalesOrden } = require('../utils/cajaTotales');
const {
  uploadImagenesVehiculo,
  uploadImagenesVehiculoTemp,
  PERM_DIR: IMAGENES_PERM_DIR,
  TEMP_DIR: IMAGENES_TEMP_DIR,
} = require('../middleware/uploadImagenesVehiculo');

const { streamVehiculoOperativoPdf } = require('../service/VehiculoOperativoPdf');
const { streamVehiculoOrdenPdf } = require('../service/vehiculoOrdenPdf');
const { generarPresupuestoPDF } = require('../service/VehiculoPresupuestoPDF');
const { generarVentaClientePDF } = require('../service/VehiculoVentaClientePDF');
const { streamVehiculoContratoClientePdf } = require('../service/VehiculoContratoClientePdf');

// Campos del cliente que necesita Facturación (RFC/régimen/dirección fiscal)
// además de lo que ya usaban los listados existentes (nombre/esEmpleado).
const POPULATE_CLIENTE =
  'nombre apellidoPaterno apellidoMaterno tipoCliente empresa gobierno rfc regimenFiscal codigoPostalFiscal facturacion direccion pais esEmpleado';

// 👇 Helper para generar folio de OC
function generarNumeroOC() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mi = String(ahora.getMinutes() + 1).padStart(2, '0');
  const ss = String(ahora.getSeconds()).padStart(2, '0');
  // Ejemplo: OC-20241208-143015
  return `OC-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

// 👇 Helper para generar número de Orden de Servicio. Usa el contador
// CodigoSeq (key: 'ordenServicio'), visible/editable desde Configuración. La
// primera vez que se usa (aún no existe el contador) se siembra a partir del
// folio más alto ya existente, para no repetir un folio ya emitido por el
// método anterior (buscar el último documento y sumarle 1).
async function generarOrdenServicio() {
  let contador = await CodigoSeq.findOne({ key: 'ordenServicio' });
  if (!contador) {
    const ultimo = await Vehiculo.findOne().sort({ createdAt: -1 }).lean();
    let maxNum = 0;
    if (ultimo?.ordenServicio) {
      const match = String(ultimo.ordenServicio).match(/(\d+)$/);
      if (match) maxNum = Number(match[1]);
    }
    contador = await CodigoSeq.create({ key: 'ordenServicio', seq: maxNum });
  }

  contador = await CodigoSeq.findOneAndUpdate(
    { key: 'ordenServicio' },
    { $inc: { seq: 1 } },
    { new: true }
  );

  // Formato: OS-00001, OS-00002, etc.
  return `OS-${String(contador.seq).padStart(5, '0')}`;
}

// ── Imágenes: validación de tempId y manifest de la sesión temporal ────────
const TEMP_ID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validarTempId(req, res, next) {
  if (!TEMP_ID_RX.test(req.params.tempId)) {
    return res.status(400).json({ ok: false, msg: 'tempId inválido' });
  }
  next();
}

function leerManifest(dir) {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return [];
  }
}

function escribirManifest(dir, manifest) {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
}

// ── Inventario: stock actual por código (Entradas - Salidas) ───────────────
// codigoInterno en EntradaInventario/SalidaInventario ya guarda directamente
// el mismo valor que presupuesto[].codigo / refaccionesSolicitadas[].codigo
// (a diferencia de otros catálogos, aquí no hace falta resolver a ObjectId).
const toObjId = (v) => {
  try { return new mongoose.Types.ObjectId(v); } catch { return null; }
};
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
async function getStockMapLocal(codigos) {
  const ids = expandIds(codigos);

  const [entradas, salidas] = await Promise.all([
    EntradaInventario.aggregate([
      { $unwind: '$captura' },
      { $match: { 'captura.codigoInterno': { $in: ids } } },
      { $group: { _id: '$captura.codigoInterno', cant: { $sum: { $ifNull: ['$captura.cantidad', 0] } } } },
    ]),
    SalidaInventario.aggregate([
      { $unwind: '$partidas' },
      { $match: { 'partidas.codigoInterno': { $in: ids } } },
      { $group: { _id: '$partidas.codigoInterno', cant: { $sum: { $ifNull: ['$partidas.cantidad', 0] } } } },
    ]),
  ]);

  const map = new Map();
  for (const d of entradas) map.set(String(d._id), (map.get(String(d._id)) || 0) + d.cant);
  for (const d of salidas) map.set(String(d._id), (map.get(String(d._id)) || 0) - d.cant);
  return map;
}

// El arreglo `presupuesto` se guarda completo desde dos pantallas distintas
// (Presupuesto y Venta del asesor, y Surtir de refaccionaria) que pueden
// tener abierta cada una su propia copia local desactualizada. Si cualquiera
// de las dos reemplaza el arreglo tal cual, borra silenciosamente lo que la
// otra ya haya guardado mientras tanto. `mergePresupuestoArray` evita esto:
// para las filas que ya existían (mismo _id) conserva del documento actual
// en BD los campos que le pertenecen "al otro lado" del flujo.
function mergePresupuestoArray(existingArr, incomingArr, camposAProteger) {
  const existentesPorId = new Map(
    (existingArr || [])
      .filter((r) => r && r._id)
      .map((r) => [String(r._id), r])
  );

  return (incomingArr || []).map((row) => {
    const existente = row._id ? existentesPorId.get(String(row._id)) : null;
    if (!existente) return row; // fila nueva (sin _id previo): se toma tal cual

    const merged = { ...row };
    for (const campo of camposAProteger) {
      merged[campo] = existente[campo];
    }
    return merged;
  });
}

// Campos que solo captura/edita refaccionaria (cotización + surtido); el
// asesor nunca los edita desde Presupuesto y Venta, solo los muestra.
const CAMPOS_PRESUPUESTO_REFACCIONARIA = [
  'surtida', 'marca', 'proveedor', 'codigo', 'precioCompra',
  'unidad', 'moneda', 'tipoCambio', 'core', 'precioCore',
  'tiempoEntrega', 'cant', 'tipo',
];

// Campos que solo captura/edita el asesor desde Presupuesto y Venta;
// Surtir nunca los edita, solo los lee.
const CAMPOS_PRESUPUESTO_ASESOR = [
  'concepto', 'refaccion', 'precioVenta', 'observInt', 'autorizado', 'esServicio',
];

// POST /api/vehiculos  -> registrar nuevo vehículo para un cliente
router.post('/', async (req, res) => {
  try {
    const { clienteId, ...data } = req.body;

    if (!clienteId) {
      return res
        .status(400)
        .json({ ok: false, msg: 'clienteId es obligatorio' });
    }

    // armamos el payload base
    const payload = {
      cliente: clienteId,
      ...data,
    };

    // ===== Solicitud de Garantía =====
    // El sub-objeto garantia nunca se acepta crudo del cliente; se arma aquí
    // a partir de garantiaSolicitud { ordenAnteriorId, motivo }.
    delete payload.garantia;
    delete payload.garantiaSolicitud;
    if (data.garantiaSolicitud?.ordenAnteriorId) {
      const ordenAnterior = await Vehiculo.findById(data.garantiaSolicitud.ordenAnteriorId).select('ordenServicio estadoOrden');
      if (!ordenAnterior) {
        return res.status(400).json({ ok: false, msg: 'La orden anterior indicada para la garantía no existe.' });
      }
      if (ordenAnterior.estadoOrden !== 'CERRADA') {
        return res.status(400).json({
          ok: false,
          msg: `La orden ${ordenAnterior.ordenServicio} aún no está cerrada; solo se puede solicitar garantía sobre órdenes cerradas.`,
        });
      }

      const motivoGarantia = String(data.garantiaSolicitud.motivo || '').trim();
      if (!motivoGarantia) {
        return res.status(400).json({ ok: false, msg: 'El motivo de la solicitud de garantía es obligatorio.' });
      }

      // Una orden solo puede ser origen de una garantía (pendiente o autorizada)
      const solicitudExistente = await Vehiculo.findOne({
        'garantia.ordenAnterior': ordenAnterior._id,
        'garantia.estado': { $in: ['PENDIENTE', 'APROBADA'] },
      }).select('ordenServicio');
      if (solicitudExistente) {
        return res.status(409).json({
          ok: false,
          msg: `La orden ${ordenAnterior.ordenServicio} ya fue utilizada en una garantía (orden ${solicitudExistente.ordenServicio}).`,
        });
      }

      payload.garantia = {
        estado: 'PENDIENTE',
        motivo: motivoGarantia,
        ordenAnterior: ordenAnterior._id,
        ordenAnteriorFolio: ordenAnterior.ordenServicio || '',
        fechaSolicitud: new Date(),
      };
    }

    // 👇 Si no viene ordenServicio desde el frontend, la generamos aquí
    if (!payload.ordenServicio) {
      payload.ordenServicio = await generarOrdenServicio();
    }

    // Las imágenes nunca se aceptan crudas del cliente: si venían de una
    // sesión temporal (subidas antes de guardar la orden), se migran desde
    // disco más abajo usando el tempId.
    delete payload.imagenes;
    const tempIdImagenes = TEMP_ID_RX.test(data.tempId || '') ? data.tempId : null;
    delete payload.tempId;

    const vehiculo = new Vehiculo(payload);

    await vehiculo.save();

    // Migrar imágenes subidas temporalmente (antes de guardar la orden) a la
    // carpeta definitiva, ahora que ya existe el folio real.
    if (tempIdImagenes) {
      try {
        const tempDir = path.join(IMAGENES_TEMP_DIR, tempIdImagenes);
        const manifest = leerManifest(tempDir);

        if (manifest.length > 0) {
          const imagenesFinal = [];
          for (const item of manifest) {
            const origen = path.join(tempDir, item.filename);
            const destino = path.join(IMAGENES_PERM_DIR, item.filename);
            if (fs.existsSync(origen)) {
              fs.renameSync(origen, destino);
              imagenesFinal.push({
                filename: item.filename,
                mimetype: item.mimetype,
                size: item.size,
                url: `/uploads/vehiculos/${item.filename}`,
                fecha: item.fecha ? new Date(item.fecha) : new Date(),
                subidoPor: payload.creadoPor || '',
              });
            }
          }
          vehiculo.imagenes = imagenesFinal;
          await vehiculo.save();
        }

        fs.rm(tempDir, { recursive: true, force: true }, () => {});
      } catch (imgErr) {
        console.error('Error migrando imágenes temporales a la orden:', imgErr);
      }
    }

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

// GET /api/vehiculos/ordenes?estado=INGRESO&searchOs=&search=&page=1&limit=10
// cobranza=pendientes|liquidadas -> órdenes CERRADAS según su saldo (pestañas
// "Pendiente de Pago"/"Liquidadas"; el saldo no se persiste, se calcula aquí
// y se pagina en memoria).
router.get('/ordenes', async (req, res) => {
  try {
    const {
      estado = 'INGRESO',
      pendienteCierre,
      incluirGarantias,
      cobranza = '',
      conPendientesSurtir,
      searchOs = '',
      search = '',
      page = 1,
      limit = 10,
    } = req.query;

    const filtroCobranza = ['pendientes', 'liquidadas'].includes(cobranza) ? cobranza : '';

    const q = {};
    if (filtroCobranza) {
      q.estadoOrden = 'CERRADA';
    } else if (pendienteCierre === 'true') {
      q.pendienteCierre = true;
    } else if (estado === 'PENDIENTE_REFACCIONARIA') {
      // Incluye órdenes en estado PENDIENTE_REFACCIONARIA
      // Y también órdenes en cualquier estado activo que tengan
      // refacciones sin cotizar (opciones vacías)
      q.$or = [
        { estadoOrden: 'PENDIENTE_REFACCIONARIA' },
        {
          estadoOrden: { $nin: ['CERRADA', 'INGRESO'] },
          refaccionesSolicitadas: { $elemMatch: { opciones: { $size: 0 } } },
        },
      ];
    } else if (estado && incluirGarantias === 'true') {
      // Además del estado pedido, se incluyen todas las órdenes de garantía
      // sin importar en qué estado se encuentren.
      q.$or = [{ estadoOrden: estado }, { garantia: { $ne: null } }];
    } else if (estado) {
      q.estadoOrden = estado;
    }

    // Solo órdenes con al menos una refacción autorizada que sigue sin surtirse
    // (las partidas de servicio no requieren surtido)
    if (conPendientesSurtir === 'true') {
      q.presupuesto = { $elemMatch: { autorizado: true, surtida: { $ne: true }, esServicio: { $ne: true } } };
    }

    // Buscar por número de orden exacto o parcial
    if (searchOs) {
      q.ordenServicio = { $regex: searchOs, $options: 'i' };
    }

    // Búsqueda general (folio, cliente, placas, marca/modelo, etc.)
    if (search) {
      const rxSearch = { $regex: search, $options: 'i' };
      const condicionesSearch = [
        { ordenServicio: rxSearch },
        { nombreCliente: rxSearch },
        { apellidoPaterno: rxSearch },
        { nombreGobierno: rxSearch },
        { serie: rxSearch },
        { placas: rxSearch },
        { marca: rxSearch },
        { modelo: rxSearch },
      ];
      // Si ya hay un $or (PENDIENTE_REFACCIONARIA / incluirGarantias), combinar
      // con $and para no perder ninguna de las dos condiciones.
      if (q.$or) {
        q.$and = [{ $or: q.$or }, { $or: condicionesSearch }];
        delete q.$or;
      } else {
        q.$or = condicionesSearch;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Con filtro de cobranza el saldo se calcula por orden (no está en la BD),
    // así que se traen todas las CERRADAS que matchean y se pagina en memoria.
    if (filtroCobranza) {
      const ordenes = await Vehiculo.find(q).sort({ createdAt: -1 });

      const filtradas = ordenes.filter((orden) => {
        const liquidada = calcularTotalesOrden(orden).saldoPendiente <= 0;
        return filtroCobranza === 'liquidadas' ? liquidada : !liquidada;
      });

      return res.json({
        ok: true,
        data: filtradas.slice(skip, skip + limitNum),
        total: filtradas.length,
        page: pageNum,
        limit: limitNum,
      });
    }

    const [data, total] = await Promise.all([
      Vehiculo.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('cliente', POPULATE_CLIENTE),
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

// GET /api/vehiculos/mis-ordenes -> OS activas del usuario logueado (excluye CERRADA/CANCELADA)
router.get('/mis-ordenes', proteger, async (req, res) => {
  try {
    const nombreUsuario = req.user?.name || '';

    const ordenes = await Vehiculo.find({
      estadoOrden: { $nin: ['CERRADA', 'CANCELADA'] },
      creadoPor: nombreUsuario,
    })
      .select('ordenServicio estadoOrden marca modelo anio color placas createdAt nombreCliente apellidoPaterno apellidoMaterno nombreGobierno cliente')
      .populate('cliente', 'esEmpleado')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, data: ordenes });
  } catch (err) {
    console.error('Error listando mis-ordenes:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/vehiculos/stats/dashboard?periodo=hoy|mes|todas
// Roles con acceso restringido solo al módulo Vehículo (ver
// frontend/src/utils/roles.js -> ROLE_MODULES.mecanico) ven sus propias
// órdenes (creadoPor === su nombre), no los totales del taller completo.
// "En proceso" es un conteo del estado actual, no se acota por periodo.
router.get('/stats/dashboard', proteger, async (req, res) => {
  try {
    const periodo = ['hoy', 'mes', 'todas'].includes(req.query.periodo) ? req.query.periodo : 'hoy';

    let rangoFecha = null;
    if (periodo === 'hoy') {
      const ahora = new Date();
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      rangoFecha = { $gte: inicio, $lt: fin };
    } else if (periodo === 'mes') {
      const ahora = new Date();
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
      rangoFecha = { $gte: inicio, $lt: fin };
    }
    // periodo === 'todas' -> rangoFecha queda null, sin acotar por fecha

    const soloPropias = req.user?.role === 'mecanico';
    const filtroPropio = soloPropias ? { creadoPor: req.user?.name || '' } : {};

    const filtroOrdenes = { ...filtroPropio };
    if (rangoFecha) filtroOrdenes.createdAt = rangoFecha;

    const filtroEntregadas = { ...filtroPropio, estadoOrden: 'CERRADA' };
    if (rangoFecha) filtroEntregadas.updatedAt = rangoFecha;

    const [ordenes, enProceso, entregadas] = await Promise.all([
      Vehiculo.countDocuments(filtroOrdenes),
      Vehiculo.countDocuments({
        ...filtroPropio,
        estadoOrden: {
          $in: [
            'INGRESO',
            'PENDIENTE_REFACCIONARIA',
            'PENDIENTE_AUTORIZACION_CLIENTE',
            'PENDIENTE_SURTIR',
            'PENDIENTE_CIERRE',
            'REPARACION_EN_CURSO',
            'PENDIENTE_CERRAR',
          ],
        },
      }),
      Vehiculo.countDocuments(filtroEntregadas),
    ]);

    res.json({ ok: true, data: { ordenes, enProceso, entregadas, personal: soloPropias, periodo } });
  } catch (err) {
    console.error('Error obteniendo stats:', err);
    res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/servicio  -> guarda servicio/reparación e inicia la orden
router.put('/:id/servicio', async (req, res) => {
  try {
    const { servicioReparacion } = req.body;

    // 1. Buscamos el vehículo/orden primero
    const vehiculo = await Vehiculo.findById(req.params.id);

    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    // 2. Actualizamos los datos básicos del diagnóstico
    vehiculo.servicioReparacion = servicioReparacion;
    vehiculo.ordenIniciada = true;
    vehiculo.estadoOrden = 'PENDIENTE_REFACCIONARIA';

    // 3. 💡 SINCRONIZACIÓN CON MANO DE OBRA
    // Si desde el frontend mandamos 'manoObraGenerada'
    if (servicioReparacion.manoObraGenerada && servicioReparacion.manoObraGenerada.length > 0) {

      servicioReparacion.manoObraGenerada.forEach(nuevoItem => {
        // Evitamos duplicar: solo agregamos si el concepto no existe en la tabla de mano de obra
        const existe = vehiculo.manoObra.some(
          item => item.concepto.toLowerCase() === nuevoItem.concepto.toLowerCase()
        );

        if (!existe) {
          // Si no existe, lo agregamos al arreglo que lee la tabla de presupuesto
          vehiculo.manoObra.push({
            concepto: nuevoItem.concepto,
            mecanico: "", // Se queda vacío para asignar en presupuesto
            horas: 1,
            fechaPago: new Date(),
            observaciones: "Generado desde diagnóstico"
          });
        }
      });
    }

    // 4. Guardamos los cambios
    await vehiculo.save();

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
      manoObra,         // opcional
      estadoOrden,      // opcional, si quieres avanzar el flujo
      devueltoPor,
      guardarEnHistorial, // true solo cuando el técnico pulsa "Guardar en historial"
    } = req.body;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    // Diagnóstico
    if (diagnosticoTecnico !== undefined) {
      const textoNuevo = String(diagnosticoTecnico || '').trim();

      // Solo se agrega una entrada al historial cuando el técnico lo pide
      // explícitamente; el resto de los guardados (elegir refacción, "Guardar
      // selección", etc.) también mandan diagnosticoTecnico pero no deben
      // duplicar el historial cada vez que se llama a este endpoint.
      if (guardarEnHistorial === true && textoNuevo) {
        if (!Array.isArray(vehiculo.historialDiagnosticos)) {
          vehiculo.historialDiagnosticos = [];
        }

        const ultimo =
          vehiculo.historialDiagnosticos[vehiculo.historialDiagnosticos.length - 1];

        const ultimoTexto = String(ultimo?.texto || '').trim();

        if (textoNuevo !== ultimoTexto) {
          vehiculo.historialDiagnosticos.push({
            texto: textoNuevo,
            fecha: new Date(),
          });
        }
      }

      vehiculo.diagnosticoTecnico = diagnosticoTecnico;
    }

    // Refacciones solicitadas (las que ves en la tabla)
    if (Array.isArray(refacciones)) {
      // Aquí ya pueden venir requiereOC, ocGenerada, numeroOC, etc.
      vehiculo.refaccionesSolicitadas = refacciones;
    }

    // Cargos en orden (para después, si los mandas)
    if (Array.isArray(cargosEnOrden)) {
      vehiculo.cargosEnOrden = cargosEnOrden;
    }

    if (Array.isArray(manoObra)) {
      vehiculo.manoObra = manoObra;
    }

    // Si quieres ir moviendo la orden de estado
    if (estadoOrden) {
      vehiculo.estadoOrden = estadoOrden;

      if (estadoOrden === 'PENDIENTE_REFACCIONARIA') {
        vehiculo.fechaSolicitudRefacciones = new Date();
        vehiculo.fechaRespuestaRefaccionaria = null;
        vehiculo.ordenIniciada = true;
      }

      if (estadoOrden === 'PENDIENTE_AUTORIZACION_CLIENTE') {
        vehiculo.fechaRespuestaRefaccionaria = new Date();
        if (devueltoPor) vehiculo.devueltoPor = devueltoPor;
      }

      if (estadoOrden === 'PENDIENTE_CERRAR') {
        vehiculo.pendienteCierre = true;
      }
    }

    await vehiculo.save();

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error guardando requisicion/diagnostico:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/historial-diagnostico/:entryId
// Corrige el texto de una entrada ya guardada en el historial (por ejemplo,
// una captura con errores de dedo); la fecha original no cambia.
router.put('/:id/historial-diagnostico/:entryId', async (req, res) => {
  try {
    const { id, entryId } = req.params;
    const texto = String(req.body?.texto || '').trim();

    if (!texto) {
      return res.status(400).json({ ok: false, msg: 'El texto del diagnóstico no puede quedar vacío.' });
    }

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    const entrada = vehiculo.historialDiagnosticos.id(entryId);
    if (!entrada) {
      return res.status(404).json({ ok: false, msg: 'Entrada de historial no encontrada' });
    }

    entrada.texto = texto;
    await vehiculo.save();

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error editando entrada del historial de diagnóstico:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/omitir-refacciones
// El asesor continúa sin pedir refacciones: los servicios capturados entran
// al presupuesto como partidas esServicio y la orden brinca directo a
// PENDIENTE_AUTORIZACION_CLIENTE sin pasar por refaccionaria.
router.put('/:id/omitir-refacciones', async (req, res) => {
  try {
    const { servicios, serviciosCatalogo } = req.body;

    const validos = (Array.isArray(servicios) ? servicios : [])
      .map((s) => ({
        concepto: String(s.concepto || '').trim(),
        cant: Number(s.cant) || 1,
        esCarroceria: !!s.esCarroceria,
        mecanico: String(s.mecanico || ''),
        carrocero: String(s.carrocero || ''),
        horas: Number(s.horas) || 0,
        fechaPago: String(s.fechaPago || ''),
      }))
      .filter((s) => s.concepto);

    // Servicios de catálogo: cada uno trae su propio bundle de refacciones
    // (obligatorias/opcionales), ya resuelto/editado por el asesor en la orden.
    const catalogoValidos = (Array.isArray(serviciosCatalogo) ? serviciosCatalogo : [])
      .map((s) => ({
        servicioId: s.servicioId || null,
        nombre: String(s.nombre || '').trim(),
        refacciones: (Array.isArray(s.refacciones) ? s.refacciones : [])
          .map((r) => {
            const obligatoria = !!r.obligatoria;
            return {
              nombre: String(r.nombre || '').trim(),
              obligatoria,
              // una refacción obligatoria nunca puede llegar excluida, sin
              // confiar únicamente en lo que mande el frontend
              incluida: obligatoria ? true : !!r.incluida,
              observacion: String(r.observacion || '').trim(),
            };
          })
          .filter((r) => r.nombre),
      }))
      .filter((s) => s.nombre);

    if (validos.length === 0 && catalogoValidos.length === 0) {
      return res.status(400).json({
        ok: false,
        msg: 'Captura al menos un servicio a realizar o selecciona un servicio del catálogo.',
      });
    }

    const vehiculo = await Vehiculo.findById(req.params.id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    for (const s of validos) {
      vehiculo.presupuesto.push({
        cant: s.cant,
        concepto: s.concepto,
        esServicio: true,
        precioCompra: 0,
        precioVenta: 0,
        autorizado: false,
      });

      // Si el asesor ya asignó mecánico/carrocero a este servicio, se liga
      // directamente con el _id de la partida recién creada.
      const asignado = s.esCarroceria ? s.carrocero : s.mecanico;
      if (asignado) {
        const presupuestoRow = vehiculo.presupuesto[vehiculo.presupuesto.length - 1];
        vehiculo.manoObra.push({
          concepto: s.concepto,
          presupuestoId: presupuestoRow._id,
          mecanico: s.esCarroceria ? '' : s.mecanico,
          carrocero: s.esCarroceria ? s.carrocero : '',
          esCarroceria: s.esCarroceria,
          horas: s.horas,
          fechaPago: s.fechaPago,
          observaciones: '',
          precioCarroceria: 0,
        });
      }
    }

    // Servicios de catálogo: 1 renglón esServicio (mano de obra) + 1 renglón
    // por cada refacción incluida (necesita surtido normal), más el snapshot
    // para trazabilidad/PDF operativo.
    for (const bundle of catalogoValidos) {
      vehiculo.presupuesto.push({
        cant: 1,
        concepto: bundle.nombre,
        esServicio: true,
        precioCompra: 0,
        precioVenta: 0,
        autorizado: false,
      });
      // La fila esServicio agrupa sus refacciones: se referencia a sí misma
      // para que el frontend pueda encontrar el grupo a partir de cualquiera
      // de sus filas (padre o hijas) con el mismo servicioGrupoId.
      const servicioRow = vehiculo.presupuesto[vehiculo.presupuesto.length - 1];
      servicioRow.servicioGrupoId = servicioRow._id;

      const refaccionesSnapshot = [];
      for (const r of bundle.refacciones) {
        if (!r.incluida) {
          refaccionesSnapshot.push({
            nombre: r.nombre,
            obligatoria: r.obligatoria,
            incluida: false,
            observacion: r.observacion,
          });
          continue;
        }

        vehiculo.presupuesto.push({
          cant: 1,
          concepto: r.nombre,
          refaccion: r.nombre,
          esServicio: false,
          origenServicioCatalogo: true,
          servicioGrupoId: servicioRow._id,
          observInt: r.observacion,
          precioCompra: 0,
          precioVenta: 0,
          autorizado: false,
        });

        refaccionesSnapshot.push({
          nombre: r.nombre,
          obligatoria: r.obligatoria,
          incluida: true,
          observacion: r.observacion,
        });
      }

      vehiculo.serviciosCatalogoSeleccionados.push({
        servicioId: bundle.servicioId,
        nombre: bundle.nombre,
        refacciones: refaccionesSnapshot,
        fechaSeleccion: new Date(),
      });
    }

    vehiculo.refaccionesOmitidas = true;
    vehiculo.ordenIniciada = true;
    vehiculo.estadoOrden = 'PENDIENTE_AUTORIZACION_CLIENTE';

    await vehiculo.save();

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error omitiendo refacciones:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/presupuesto-venta
router.put('/:id/presupuesto-venta', proteger, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      presupuesto,
      ventaCliente,
      manoObra,
      observacionesExternas,
      observacionesInternas,
      estadoOrden,
      dirigidoA,
      departamento,
      observCotizacion,
      ivaPresupuesto,
      ivaVenta,
      accionCotizacion,
      crearNuevaVersionCotizacion,
      accionVentaCliente,
      crearNuevaVersionVentaCliente,
    } = req.body;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    if (Array.isArray(presupuesto)) {
      // No pisar surtida/marca/proveedor/código/etc. si refaccionaria ya los
      // guardó desde Surtir mientras el asesor tenía esta pestaña abierta.
      vehiculo.presupuesto = mergePresupuestoArray(
        vehiculo.presupuesto,
        presupuesto,
        CAMPOS_PRESUPUESTO_REFACCIONARIA
      );
    }

    if (Array.isArray(ventaCliente)) {
      // La garantía ya no agrega un concepto GARANTÍA en Venta al Cliente;
      // se descartan filas heredadas de la lógica anterior.
      vehiculo.ventaCliente = ventaCliente.filter((r) => !r.esGarantia);
    }

    if (Array.isArray(manoObra)) {
      vehiculo.manoObra = manoObra;
    }

    if (typeof observacionesExternas === 'string') {
      vehiculo.observacionesExternas = observacionesExternas;
    }

    if (typeof observacionesInternas === 'string') {
      vehiculo.observacionesInternas = observacionesInternas;
    }

    if (typeof dirigidoA === 'string') vehiculo.dirigidoA = dirigidoA;
    if (typeof departamento === 'string') vehiculo.departamento = departamento;
    if (typeof observCotizacion === 'string') vehiculo.observCotizacion = observCotizacion;

    if (ivaPresupuesto !== undefined && ivaPresupuesto !== null && ivaPresupuesto !== '') {
      vehiculo.ivaPresupuesto = Number(ivaPresupuesto) || 0;
    }
    if (ivaVenta !== undefined && ivaVenta !== null && ivaVenta !== '') {
      vehiculo.ivaVenta = Number(ivaVenta) || 0;
    }

    let inventarioResult = null;

    if (estadoOrden === 'REPARACION_EN_CURSO') {
      const hayAutorizada = (vehiculo.presupuesto || []).some((p) => p.autorizado);
      const hayEnviadaAVenta = (vehiculo.ventaCliente || []).length > 0;
      if (!hayAutorizada || !hayEnviadaAVenta) {
        return res.status(400).json({
          ok: false,
          msg: 'No se puede guardar la orden de servicio: debes autorizar al menos una partida del presupuesto y enviarla a Venta al Cliente.',
        });
      }

      const faltaMotivoPrecioCero = (vehiculo.ventaCliente || []).some(
        (v) => !v.esGarantia && Number(v.precioVenta) <= 0 && !String(v.motivoPrecioCero || '').trim()
      );
      if (faltaMotivoPrecioCero) {
        return res.status(400).json({
          ok: false,
          msg: 'No se puede guardar la orden de servicio: hay partidas de Venta al Cliente con precio en $0 sin motivo capturado.',
        });
      }
    }

    if (estadoOrden) {
      if (estadoOrden === 'PENDIENTE_SURTIR') {
        // Las partidas de servicio no pasan por refaccionaria: quedan surtidas
        for (const p of vehiculo.presupuesto) {
          if (p.autorizado && p.esServicio && !p.surtida) {
            p.surtida = true;
          }
        }

        // Verificar inventario por cada partida autorizada que tenga código
        const autorizadas = (vehiculo.presupuesto || []).filter((p) => p.autorizado && !p.esServicio && p.codigo);
        let autoSurtidas = 0;

        if (autorizadas.length > 0) {
          const codigos = [...new Set(autorizadas.map((p) => String(p.codigo)))];
          const stockMap = await getStockMapLocal(codigos);
          const partidasSalida = [];

          for (const p of vehiculo.presupuesto) {
            if (!p.autorizado || !p.codigo || p.esServicio) continue;
            const stock = stockMap.get(String(p.codigo)) || 0;
            const qty = Number(p.cant) || 1;
            if (stock >= qty) {
              p.surtida = true;
              autoSurtidas++;
              partidasSalida.push({
                codigoInterno: String(p.codigo),
                descripcion: (p.refaccion || p.concepto || '').trim(),
                marca: (p.marca || '').trim(),
                unidad: 'Pieza',
                cantidad: qty,
              });
            }
          }

          if (partidasSalida.length > 0) {
            await SalidaInventario.create({
              fechaSalida: new Date(),
              ordenServicio: vehiculo.ordenServicio || '',
              partidas: partidasSalida,
              estatus: 'cerrada',
            });
          }
        }

        // Solo las refacciones (no servicios) cuentan como pendientes de surtir.
        const hayAutorizadas = (vehiculo.presupuesto || []).some((p) => p.autorizado);
        const pendientesSurtir = (vehiculo.presupuesto || [])
          .filter((p) => p.autorizado && !p.esServicio && !p.surtida).length;

        if (hayAutorizadas && pendientesSurtir === 0) {
          vehiculo.estadoOrden = 'REPARACION_EN_CURSO';
        } else {
          vehiculo.estadoOrden = 'PENDIENTE_SURTIR';
          vehiculo.fechaEnvioSurtir = new Date();
        }

        inventarioResult = { autoSurtidas, pendientesSurtir };
      } else {
        if (estadoOrden === 'CANCELADA' && vehiculo.estadoOrden !== 'CANCELADA') {
          vehiculo.estadoAnterior = vehiculo.estadoOrden;
        }
        vehiculo.estadoOrden = estadoOrden;
      }
    }

    if (accionCotizacion === 'ENVIAR_COTIZACION' && Array.isArray(presupuesto) && presupuesto.length > 0) {
      const ultimaCotizacion = vehiculo.historialCotizaciones?.[vehiculo.historialCotizaciones.length - 1];
      const hayCotizacionActiva =
        ultimaCotizacion && ['ENVIADA', 'PARCIALMENTE_AUTORIZADA'].includes(ultimaCotizacion.estado);

      if (hayCotizacionActiva && !crearNuevaVersionCotizacion) {
        return res.status(409).json({
          ok: false,
          code: 'COTIZACION_ACTIVA_EXISTENTE',
          msg: `Ya existe una cotización activa (${ultimaCotizacion.folio}).`,
          cotizacion: ultimaCotizacion,
        });
      }

      const siguienteNumero = (vehiculo.historialCotizaciones?.length || 0) + 1;
      const partidas = presupuesto.map((p, index) => ({
        ...p,
        estatusCotizacion: p.estatusCotizacion || 'PENDIENTE_CLIENTE',
        origenPresupuestoIndex: index,
      }));

      const todasAutorizadas = partidas.every((p) => p.estatusCotizacion === 'AUTORIZADA');
      const todasRechazadas = partidas.every((p) => p.estatusCotizacion === 'RECHAZADA');
      const algunaAutorizada = partidas.some((p) => p.estatusCotizacion === 'AUTORIZADA');

      const estadoCotizacion = todasAutorizadas
        ? 'AUTORIZADA'
        : todasRechazadas
          ? 'RECHAZADA'
          : algunaAutorizada
            ? 'PARCIALMENTE_AUTORIZADA'
            : 'ENVIADA';

      vehiculo.historialCotizaciones.push({
        folio: `COT-${String(siguienteNumero).padStart(4, '0')}`,
        fecha: new Date(),
        estado: estadoCotizacion,
        dirigidoA: dirigidoA || vehiculo.dirigidoA || '',
        departamento: departamento || vehiculo.departamento || '',
        observCotizacion: observCotizacion || vehiculo.observCotizacion || '',
        partidas,
      });

      if (accionVentaCliente === 'GUARDAR_HISTORIAL_VENTA' && Array.isArray(presupuesto) && presupuesto.length > 0) {
        const ultimaVenta = vehiculo.historialVentaCliente?.[vehiculo.historialVentaCliente.length - 1];
        const hayVentaActiva =
          ultimaVenta && ['ENVIADA', 'PARCIALMENTE_AUTORIZADA', 'PENDIENTE'].includes(ultimaVenta.estado);

        if (hayVentaActiva && !crearNuevaVersionVentaCliente) {
          return res.status(409).json({
            ok: false,
            code: 'VENTA_CLIENTE_ACTIVA_EXISTENTE',
            msg: `Ya existe un historial de venta activo (${ultimaVenta.folio}).`,
            ventaCliente: ultimaVenta,
          });
        }

        const siguienteNumeroVenta = (vehiculo.historialVentaCliente?.length || 0) + 1;
        const partidasVenta = presupuesto.map((p, index) => ({
          ...p,
          estatusCliente: p.estatusCliente || 'COTIZADA',
          origenPresupuestoIndex: index,
        }));

        const todasVendidas = partidasVenta.every((p) => p.estatusCliente === 'VENDIDA');
        const todasAutorizadasVenta = partidasVenta.every((p) => ['AUTORIZADA', 'VENDIDA'].includes(p.estatusCliente));
        const todasNoAutorizadas = partidasVenta.every((p) => p.estatusCliente === 'NO_AUTORIZADA');
        const algunaAutorizadaVenta = partidasVenta.some((p) => ['AUTORIZADA', 'VENDIDA'].includes(p.estatusCliente));
        const algunaPendiente = partidasVenta.some((p) => p.estatusCliente === 'PENDIENTE');

        const estadoVenta = todasVendidas
          ? 'VENDIDA'
          : todasAutorizadasVenta
            ? 'AUTORIZADA'
            : todasNoAutorizadas
              ? 'NO_AUTORIZADA'
              : algunaAutorizadaVenta
                ? 'PARCIALMENTE_AUTORIZADA'
                : algunaPendiente
                  ? 'PENDIENTE'
                  : 'ENVIADA';

        vehiculo.historialVentaCliente.push({
          folio: `VENTA-${String(siguienteNumeroVenta).padStart(4, '0')}`,
          fecha: new Date(),
          estado: estadoVenta,
          dirigidoA: dirigidoA || vehiculo.dirigidoA || '',
          departamento: departamento || vehiculo.departamento || '',
          observCotizacion: observCotizacion || vehiculo.observCotizacion || '',
          partidas: partidasVenta,
        });
      }
    }

    await vehiculo.save();

    return res.json({ ok: true, vehiculo, inventario: inventarioResult });
  } catch (err) {
    console.error('Error guardando presupuesto/venta/manoObra:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// 💥 Generar Orden de Compra para una refacción
// POST /api/vehiculos/:id/orden-compra
router.post(
  '/:id/orden-compra',
  proteger,
  requiereRol('jefe', 'admin', 'contabilidad'),   // ajusta si quieres
  async (req, res) => {
    try {
      const { id } = req.params;
      const { refaccion } = req.body; // la fila que manda el front

      if (!refaccion) {
        return res
          .status(400)
          .json({ ok: false, mensaje: 'Falta la refacción en el body.' });
      }

      const vehiculo = await Vehiculo.findById(id);
      if (!vehiculo) {
        return res
          .status(404)
          .json({ ok: false, mensaje: 'Orden / vehículo no encontrado.' });
      }

      // Buscar una línea compatible dentro de refaccionesSolicitadas
      const idx = (vehiculo.refaccionesSolicitadas || []).findIndex((r) => {
        return (
          String(r.refaccion || '') === String(refaccion.refaccion || '') &&
          String(r.codigo || '') === String(refaccion.codigo || '') &&
          Number(r.cant || 0) === Number(refaccion.cant || 0) &&
          Number(r.precioUnitario || 0) ===
            Number(refaccion.precioUnitario || 0)
        );
      });

      if (idx === -1) {
        return res.status(404).json({
          ok: false,
          mensaje:
            'No se encontró la refacción en la orden. Revisa que coincidan cantidad/código.',
        });
      }

      const linea = vehiculo.refaccionesSolicitadas[idx];

      if (linea.ocGenerada) {
        return res.status(400).json({
          ok: false,
          mensaje: 'Esta refacción ya tiene una orden de compra.',
        });
      }

      if (linea.estatus !== 'APROBADA') {
        return res.status(400).json({
          ok: false,
          mensaje:
            'Solo se puede generar orden de compra para refacciones APROBADAS.',
        });
      }

      // Crear número de OC
      const numeroOC = generarNumeroOC();

      // Crear OrdenCompra
      const oc = await OrdenCompra.create({
        numero: numeroOC,
        orden: vehiculo._id,
        proveedor: linea.proveedor || refaccion.proveedor || '',
        lineas: [
          {
            cant: linea.cant,
            unidad: linea.unidad,
            refaccion: linea.refaccion,
            tipo: linea.tipo,
            marca: linea.marca,
            proveedor: linea.proveedor,
            codigo: linea.codigo,
            precioUnitario: linea.precioUnitario,
            importeTotal: linea.importeTotal,
            moneda: linea.moneda || 'MN',
            observaciones: linea.observaciones,
          },
        ],
        estatus: 'PENDIENTE',
        creadoPor: req.user?._id,
      });

      // Actualizar línea dentro de la orden de servicio
      linea.requiereOC = true;
      linea.ocGenerada = true;
      linea.numeroOC = numeroOC;
      linea.ordenCompra = oc._id;

      await vehiculo.save();

      return res.json({
        ok: true,
        numeroOC: oc.numero,
        ordenCompraId: oc._id,
      });
    } catch (err) {
      console.error('Error generando orden de compra:', err);
      return res.status(500).json({
        ok: false,
        mensaje: 'Error al generar la orden de compra',
      });
    }
  }
);

// GET /api/vehiculos/:id  -> detalle de una orden
router.get('/:id', async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findById(req.params.id).populate('cliente', POPULATE_CLIENTE);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }
    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error obteniendo vehiculo:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/vehiculos/:id/operativo-pdf?papel=a4|carta|oficio
router.get('/:id/operativo-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findById(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: 'Orden no encontrada' });
    }

    const papel = ['a4', 'carta', 'oficio'].includes(req.query.papel) ? req.query.papel : 'a4';
    await streamVehiculoOperativoPdf(res, vehiculo, { papel });
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

// PUT /api/vehiculos/:id/cerrar  -> cerrar orden de servicio
router.put('/:id/cerrar', async (req, res) => {
  try {
    const { id } = req.params;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    if (vehiculo.estadoOrden !== 'PENDIENTE_CERRAR') {
      return res.status(400).json({ ok: false, msg: 'La orden debe estar en estado PENDIENTE_CERRAR para poder cerrarse.' });
    }

    vehiculo.estadoAnterior = vehiculo.estadoOrden;
    vehiculo.estadoOrden = 'CERRADA';
    vehiculo.pendienteCierre = false;
    vehiculo.fechaCierre = new Date();

    await vehiculo.save();

    // Incrementar contador de usos en el garaje si el vehículo tiene serie
    if (vehiculo.serie) {
      const GarageVehiculo = require('../models/GarageVehiculo');
      await GarageVehiculo.findOneAndUpdate(
        { serie: vehiculo.serie },
        { $inc: { vecesUsado: 1 } }
      ).catch(() => {});
    }

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error cerrando orden:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/restablecer -> (solo admin) reabre una orden
// cerrada o cancelada, regresándola al estado en que estaba antes.
router.put('/:id/restablecer', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    if (vehiculo.estadoOrden !== 'CERRADA' && vehiculo.estadoOrden !== 'CANCELADA') {
      return res.status(400).json({ ok: false, msg: 'Solo se pueden restablecer órdenes cerradas o canceladas.' });
    }

    const estadoPrevio = vehiculo.estadoOrden;

    // Órdenes cerradas/canceladas antes de que existiera este campo no
    // tienen estadoAnterior guardado; se usa un estado por defecto razonable.
    const ESTADO_ANTERIOR_FALLBACK = {
      CERRADA: 'PENDIENTE_CERRAR',
      CANCELADA: 'PENDIENTE_AUTORIZACION_CLIENTE',
    };

    vehiculo.estadoOrden = vehiculo.estadoAnterior || ESTADO_ANTERIOR_FALLBACK[estadoPrevio];
    vehiculo.estadoAnterior = null;

    if (estadoPrevio === 'CERRADA') {
      vehiculo.fechaCierre = null;
      if (vehiculo.estadoOrden === 'PENDIENTE_CERRAR') {
        vehiculo.pendienteCierre = true;
      }
    }

    await vehiculo.save();

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error restableciendo orden:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/vehiculos/:id/presupuesto-pdf
router.get('/:id/presupuesto-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findById(id);

    if (!vehiculo) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    // Llamamos al nuevo servicio
    await generarPresupuestoPDF(res, vehiculo);
  } catch (err) {
    console.error('Error generando PDF de presupuesto:', err);
    res.status(500).json({ success: false, message: 'Error al generar PDF' });
  }
});

// PUT /api/vehiculos/:id/surtir -> refaccionaria marca partidas de presupuesto[] como surtidas
router.put('/:id/surtir', proteger, async (req, res) => {
  try {
    const { id } = req.params;
    const { presupuesto } = req.body;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    // Detectar qué índices ya estaban surtidos ANTES de la actualización
    const prevSurtidasIds = new Set(
      (vehiculo.presupuesto || []).reduce((acc, p, i) => {
        if (p.surtida) acc.push(i);
        return acc;
      }, [])
    );

    if (Array.isArray(presupuesto)) {
      // No pisar autorizado/precioVenta/concepto/etc. si el asesor los cambió
      // en Presupuesto y Venta mientras refaccionaria tenía Surtir abierto.
      vehiculo.presupuesto = mergePresupuestoArray(
        vehiculo.presupuesto,
        presupuesto,
        CAMPOS_PRESUPUESTO_ASESOR
      );
    }

    // Las refacciones que vinieran de un Servicio de catálogo (fuera de
    // alcance por ahora) no tendrían marca/proveedor/precio capturados de
    // antemano; este resguardo queda listo para cuando exista ese flujo.
    const faltaDetalle = (vehiculo.presupuesto || []).find(
      (p) =>
        p.surtida &&
        p.origenServicioCatalogo &&
        (!p.marca || !p.proveedor || !(Number(p.precioCompra) > 0))
    );
    if (faltaDetalle) {
      return res.status(400).json({
        ok: false,
        msg: 'Completa marca, proveedor y precio unitario antes de marcar esa partida como surtida.',
      });
    }

    // Líneas recién surtidas que tienen código → crear SalidaInventario
    // (las partidas de servicio no tocan inventario)
    const nuevamenteSurtidas = (vehiculo.presupuesto || []).filter(
      (p, i) => p.surtida && p.codigo && !p.esServicio && !prevSurtidasIds.has(i)
    );

    if (nuevamenteSurtidas.length > 0) {
      const partidas = nuevamenteSurtidas.map((p) => ({
        codigoInterno: String(p.codigo),
        descripcion: (p.refaccion || p.concepto || '').trim(),
        marca: (p.marca || '').trim(),
        unidad: 'Pieza',
        cantidad: Number(p.cant) || 1,
      }));
      await SalidaInventario.create({
        fechaSalida: new Date(),
        ordenServicio: vehiculo.ordenServicio || '',
        partidas,
        estatus: 'cerrada',
      });
    }

    // Si todas las refacciones autorizadas ya están surtidas → Reparación en curso
    // (los servicios no cuentan: no requieren surtido)
    const autorizadas = vehiculo.presupuesto.filter((p) => p.autorizado && !p.esServicio);
    const todasSurtidas = autorizadas.length > 0 && autorizadas.every((p) => p.surtida);

    if (todasSurtidas) {
      vehiculo.estadoOrden = 'REPARACION_EN_CURSO';
    }

    await vehiculo.save();
    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error marcando surtidas:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// GET /api/vehiculos/:id/venta-cliente-pdf
router.get('/:id/venta-cliente-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findById(id);

    if (!vehiculo) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    await generarVentaClientePDF(res, vehiculo);
  } catch (err) {
    console.error('Error generando PDF de venta al cliente:', err);
    res.status(500).json({ success: false, message: 'Error al generar PDF de venta al cliente' });
  }
});

// ── Pagos y descuentos (versión mínima; no reemplaza un módulo de caja) ────

// POST /api/vehiculos/:id/pagos -> registra un pago/abono contra la orden
router.post('/:id/pagos', proteger, async (req, res) => {
  try {
    const {
      tipoPago = 'ABONO',
      comprobante,
      montoPesos = 0,
      montoDolares = 0,
      tipoCambio = 0,
      referencia = '',
      observaciones = '',
      notas = '',
      banco = '',
      tipoNota = 'Contado',
      tipoRemision = 'Contado',
      formaPago = 'EFECTIVO',
      chequeNumero = '',
      reciboConcepto = '',
      reciboRazon = '',
      reciboRecibio = '',
      reciboAutorizo = '',
    } = req.body || {};

    if (!['COMPLETO', 'ABONO', 'ANTICIPO'].includes(tipoPago)) {
      return res.status(400).json({ ok: false, msg: 'Tipo de pago inválido.' });
    }
    if (!['NOTA_VENTA', 'REMISION', 'RECIBO_PROVISIONAL'].includes(comprobante)) {
      return res.status(400).json({ ok: false, msg: 'Debes elegir un comprobante.' });
    }
    // Un abono/anticipo siempre se documenta con Recibo Provisional; Nota de
    // Venta y Remisión son exclusivas de un pago Liquida (COMPLETO).
    if (['ABONO', 'ANTICIPO'].includes(tipoPago) && comprobante !== 'RECIBO_PROVISIONAL') {
      return res.status(400).json({ ok: false, msg: 'Un Abono o Anticipo se documenta con Recibo Provisional.' });
    }
    if (tipoPago === 'COMPLETO' && comprobante === 'RECIBO_PROVISIONAL') {
      return res.status(400).json({ ok: false, msg: 'Un pago de Remisión o Nota de Venta requiere ese comprobante.' });
    }

    const ordenExistente = await Vehiculo.findById(req.params.id).select('garantia pagos.comprobante pagos.cancelado');
    if (!ordenExistente) return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    if (ordenExistente.garantia) {
      return res.status(400).json({ ok: false, msg: 'No se puede registrar un pago para una orden de garantía.' });
    }

    // Una vez que la orden tiene una Remisión, ya no se puede generar otra
    // Remisión ni una Nota de Venta (evita duplicar/mezclar comprobantes).
    const yaTieneRemision = (ordenExistente.pagos || []).some((p) => p.comprobante === 'REMISION' && !p.cancelado);
    if (yaTieneRemision && ['NOTA_VENTA', 'REMISION'].includes(comprobante)) {
      return res.status(400).json({
        ok: false,
        msg: 'Esta orden ya tiene una Remisión registrada; no se puede generar otra Remisión ni una Nota de Venta.',
      });
    }

    // Una Remisión a Crédito documenta la venta sin recibir dinero: es el
    // único pago que puede registrarse en 0.
    const esRemisionCredito = comprobante === 'REMISION' && tipoRemision === 'Credito';
    const monto = esRemisionCredito
      ? 0
      : Number(montoPesos || 0) + Number(montoDolares || 0) * Number(tipoCambio || 0);
    if (monto <= 0 && !esRemisionCredito) {
      return res.status(400).json({ ok: false, msg: 'El monto del pago debe ser mayor a 0.' });
    }

    const pago = {
      fecha: new Date(),
      tipoPago,
      comprobante,
      montoPesos: esRemisionCredito ? 0 : Number(montoPesos) || 0,
      montoDolares: esRemisionCredito ? 0 : Number(montoDolares) || 0,
      tipoCambio: Number(tipoCambio) || 0,
      monto,
      referencia: esRemisionCredito ? '' : referencia,
      observaciones,
      notas,
      registradoPor: req.user?.name || '',
    };

    if (comprobante === 'NOTA_VENTA') {
      const contador = await CodigoSeq.findOneAndUpdate({ key: 'pago_notaVenta' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
      pago.notaVenta = { numero: contador.seq, banco, tipo: tipoNota };
    } else if (comprobante === 'REMISION') {
      const contador = await CodigoSeq.findOneAndUpdate({ key: 'pago_remision' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
      pago.remision = { numero: contador.seq, tipo: tipoRemision, fechaPagada: null };
    }

    // Recibo Provisional: automático en cada abono/anticipo.
    if (['ABONO', 'ANTICIPO'].includes(tipoPago)) {
      const contadorProvisional = await CodigoSeq.findOneAndUpdate({ key: 'pago_reciboProvisional' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
      pago.reciboProvisional = {
        numero: contadorProvisional.seq,
        formaPago,
        chequeNumero: formaPago === 'CHEQUE' ? chequeNumero : '',
        concepto: reciboConcepto,
        razon: reciboRazon,
        recibio: reciboRecibio,
        autorizo: reciboAutorizo,
      };
    }

    // Recibo de Dólares: automático siempre que el pago incluya dólares.
    if (Number(montoDolares) > 0) {
      const contadorDolares = await CodigoSeq.findOneAndUpdate({ key: 'pago_reciboDolares' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
      pago.reciboDolares = { numero: contadorDolares.seq };
    }

    const vehiculo = await Vehiculo.findByIdAndUpdate(req.params.id, { $push: { pagos: pago } }, { new: true });
    if (!vehiculo) return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });

    return res.status(201).json({ ok: true, vehiculo, totales: calcularTotalesOrden(vehiculo) });
  } catch (err) {
    console.error('Error registrando pago:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// POST /api/vehiculos/:id/descuentos -> agrega un descuento (global o por línea vía lineaId)
router.post('/:id/descuentos', proteger, async (req, res) => {
  try {
    const { tipo, valor = 0, motivo = '', lineaId = null } = req.body || {};
    if (!['PORCENTAJE', 'MONTO'].includes(tipo)) {
      return res.status(400).json({ ok: false, msg: 'Tipo de descuento inválido.' });
    }

    const descuento = {
      tipo,
      valor: Number(valor) || 0,
      motivo,
      activo: true,
      lineaId: lineaId || null,
      aplicadoPor: req.user?.name || '',
      fecha: new Date(),
    };

    const vehiculo = await Vehiculo.findByIdAndUpdate(req.params.id, { $push: { descuentos: descuento } }, { new: true });
    if (!vehiculo) return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });

    return res.status(201).json({ ok: true, vehiculo, totales: calcularTotalesOrden(vehiculo) });
  } catch (err) {
    console.error('Error agregando descuento:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// PUT /api/vehiculos/:id/descuentos/:descuentoId -> edita o activa/desactiva un descuento
router.put('/:id/descuentos/:descuentoId', proteger, async (req, res) => {
  try {
    const { tipo, valor, motivo, activo, lineaId } = req.body || {};
    if (tipo !== undefined && !['PORCENTAJE', 'MONTO'].includes(tipo)) {
      return res.status(400).json({ ok: false, msg: 'Tipo de descuento inválido.' });
    }

    const sets = {};
    if (tipo !== undefined) sets['descuentos.$.tipo'] = tipo;
    if (valor !== undefined) sets['descuentos.$.valor'] = Number(valor) || 0;
    if (motivo !== undefined) sets['descuentos.$.motivo'] = motivo;
    if (activo !== undefined) sets['descuentos.$.activo'] = !!activo;
    if (lineaId !== undefined) sets['descuentos.$.lineaId'] = lineaId || null;

    const vehiculo = await Vehiculo.findOneAndUpdate(
      { _id: req.params.id, 'descuentos._id': req.params.descuentoId },
      { $set: sets },
      { new: true }
    );
    if (!vehiculo) return res.status(404).json({ ok: false, msg: 'Orden o descuento no encontrado' });

    return res.json({ ok: true, vehiculo, totales: calcularTotalesOrden(vehiculo) });
  } catch (err) {
    console.error('Error actualizando descuento:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// DELETE /api/vehiculos/:id/descuentos/:descuentoId -> elimina un descuento
router.delete('/:id/descuentos/:descuentoId', proteger, async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findByIdAndUpdate(
      req.params.id,
      { $pull: { descuentos: { _id: req.params.descuentoId } } },
      { new: true }
    );
    if (!vehiculo) return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });

    return res.json({ ok: true, vehiculo, totales: calcularTotalesOrden(vehiculo) });
  } catch (err) {
    console.error('Error eliminando descuento:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

router.put('/:id/datos', async (req, res) => {
  try {
    const { id } = req.params;

    const vehiculo = await Vehiculo.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    // Campos permitidos para actualizar (todo lo del formulario de entrada).
    // "sinVehiculo" queda fuera a propósito: es inmutable tras la creación.
    const camposPermitidos = [
      // Cabecera
      'ordenServicio', 'fechaRecepcion', 'horaRecepcion', 'requiereFactura',
      'dirigidoA', 'departamento', 'observCotizacion',
      // Cliente particular
      'nombreCliente', 'apellidoPaterno', 'apellidoMaterno',
      // Cliente empresa/gobierno
      'nombreGobierno', 'nombreContactoGobierno',
      'nombreDependencia', 'nombreContactoDependencia',
      // Contacto
      'telefonoFijoLada', 'telefonoFijo', 'celularLada', 'celular',
      // Dirección
      'direccion', 'numeroExt', 'numeroInt', 'colonia',
      'codigoPostal', 'ciudad', 'estado',
      // Facturación
      'rfc', 'regimenFiscal', 'usoCFDI', 'formaPago', 'metodoPago',
      // Correos
      'correos',
      // Vehículo
      'nombreUsuarioDejaVehiculo',
      'marca', 'modelo', 'anio', 'color', 'serie', 'puertas',
      'placas', 'kmsMillas',
      'transmision', 'cilindros', 'combustion',
      'seguroRines', 'llavesControl',
      'nacionalidad', 'motor', 'numeroEconomico', 'traccion',
      // Grúa
      'grua', 'precioGrua',
      // Accesorios
      'espejoLateralIzq', 'espejoLateralDer',
      'copasDelanterasIzq', 'copasDelanterasDer',
      'parabrisas', 'focosDel', 'focosTras', 'espejoInt',
      'tapetesDelanterosIzq', 'tapetesDelanterosDer',
      'estereo', 'extra',
      'cristalesExt', 'limpiadoresExt', 'cristalesInt', 'limpiadoresInt',
      'copasTraserasIzq', 'copasTraserasDer',
      'micas', 'antena', 'encendedor',
      'tapetesTraserosIzq', 'tapetesTraserosDer',
      'gato', 'bateria',
      'llaveRueda', 'extintor', 'llantaExtra', 'cablesCorrente', 'cruceta',
      // Daño y gasolina
      'danoVehiculo', 'nivelGasolina',
      // Fotos
      'fotosVehiculo',
      // Indicadores tablero
      'checkEngine', 'abs', 'airBag', 'frenos', 'aceite', 'alternador',
      'otros', 'observaciones',
    ];

    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        vehiculo[campo] = req.body[campo];
      }
    });

    await vehiculo.save();

    return res.json({ ok: true, vehiculo });
  } catch (err) {
    console.error('Error actualizando datos de la orden:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// ── Imágenes adjuntas a la orden ────────────────────────────────────────────

// POST /api/vehiculos/:id/imagenes -> subir una o más imágenes a una orden ya creada
router.post('/:id/imagenes', uploadImagenesVehiculo.array('imagenes', 10), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, msg: 'No se recibieron imágenes.' });
    }

    const nuevas = req.files.map((f) => ({
      filename: f.filename,
      mimetype: f.mimetype,
      size: f.size,
      url: `/uploads/vehiculos/${f.filename}`,
      fecha: new Date(),
      subidoPor: req.body.subidoPor || '',
    }));

    const vehiculo = await Vehiculo.findByIdAndUpdate(
      id,
      { $push: { imagenes: { $each: nuevas } } },
      { new: true }
    ).select('imagenes');

    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    return res.json({ ok: true, imagenes: vehiculo.imagenes });
  } catch (err) {
    console.error('Error subiendo imágenes:', err);
    return res.status(500).json({ ok: false, msg: err.message || 'Error en el servidor' });
  }
});

// DELETE /api/vehiculos/:id/imagenes/:imagenId -> eliminar una imagen adjunta
router.delete('/:id/imagenes/:imagenId', async (req, res) => {
  try {
    const { id, imagenId } = req.params;

    const vehiculo = await Vehiculo.findById(id).select('imagenes');
    if (!vehiculo) {
      return res.status(404).json({ ok: false, msg: 'Orden no encontrada' });
    }

    const imagen = vehiculo.imagenes.id(imagenId);
    if (!imagen) {
      return res.status(404).json({ ok: false, msg: 'Imagen no encontrada' });
    }

    const filePath = path.join(IMAGENES_PERM_DIR, imagen.filename);
    fs.unlink(filePath, () => {}); // si ya no existe el archivo, no bloquear la respuesta

    const actualizado = await Vehiculo.findByIdAndUpdate(
      id,
      { $pull: { imagenes: { _id: imagenId } } },
      { new: true }
    ).select('imagenes');

    return res.json({ ok: true, imagenes: actualizado.imagenes });
  } catch (err) {
    console.error('Error eliminando imagen:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// ===== Imágenes temporales (orden aún no creada) =====
// Se suben antes de guardar la orden nueva; viven en uploads/vehiculos/temp/:tempId
// hasta que la orden se crea o hasta que el job de limpieza las purga por
// abandono (ver utils/limpiarImagenesTemp.js).

// POST /api/vehiculos/imagenes/temp/:tempId -> subir imágenes temporales
router.post('/imagenes/temp/:tempId', validarTempId, uploadImagenesVehiculoTemp.array('imagenes', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, msg: 'No se recibieron imágenes.' });
    }

    const dir = path.join(IMAGENES_TEMP_DIR, req.params.tempId);
    const manifest = leerManifest(dir);

    const nuevas = req.files.map((f) => ({
      filename: f.filename,
      mimetype: f.mimetype,
      size: f.size,
      url: `/uploads/vehiculos/temp/${req.params.tempId}/${f.filename}`,
      fecha: new Date().toISOString(),
    }));

    const manifestActualizado = manifest.concat(nuevas);
    escribirManifest(dir, manifestActualizado);

    return res.json({ ok: true, imagenes: manifestActualizado });
  } catch (err) {
    console.error('Error subiendo imágenes temporales:', err);
    return res.status(500).json({ ok: false, msg: err.message || 'Error en el servidor' });
  }
});

// DELETE /api/vehiculos/imagenes/temp/:tempId/:filename -> eliminar una imagen temporal
router.delete('/imagenes/temp/:tempId/:filename', validarTempId, (req, res) => {
  try {
    const { filename } = req.params;
    if (path.basename(filename) !== filename) {
      return res.status(400).json({ ok: false, msg: 'Nombre de archivo inválido' });
    }

    const dir = path.join(IMAGENES_TEMP_DIR, req.params.tempId);
    fs.unlink(path.join(dir, filename), () => {});

    const manifestActualizado = leerManifest(dir).filter((m) => m.filename !== filename);
    escribirManifest(dir, manifestActualizado);

    return res.json({ ok: true, imagenes: manifestActualizado });
  } catch (err) {
    console.error('Error eliminando imagen temporal:', err);
    return res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
});

// DELETE /api/vehiculos/imagenes/temp/:tempId -> descartar toda la sesión temporal
router.delete('/imagenes/temp/:tempId', validarTempId, (req, res) => {
  const dir = path.join(IMAGENES_TEMP_DIR, req.params.tempId);
  fs.rm(dir, { recursive: true, force: true }, () => {});
  return res.json({ ok: true });
});

// GET /api/vehiculos/:id/contrato-cliente-pdf
router.get('/:id/contrato-cliente-pdf', async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findById(req.params.id).populate('cliente', POPULATE_CLIENTE);
    if (!vehiculo) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }
    await streamVehiculoContratoClientePdf(res, vehiculo);
  } catch (err) {
    console.error('Error generando contrato cliente:', err);
    res.status(500).json({ success: false, message: 'Error al generar contrato' });
  }
});

module.exports = router;
