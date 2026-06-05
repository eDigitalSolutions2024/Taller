const express = require('express');
const router = express.Router();
const {
  obtenerPiezas,
  obtenerPieza,
  crearPieza,
  actualizarPieza,
  eliminarPieza,
  generarCodigoPreview,
  obtenerEstadisticas,
} = require('../controllers/piezasCodigosController');

// Importa tu middleware de autenticación si ya lo tienes
// const { verificarToken } = require('../middleware/auth');

// ─── Rutas ────────────────────────────────────────────────────────────────
router.get('/generar-codigo', generarCodigoPreview);   // GET preview de código auto
router.get('/estadisticas', obtenerEstadisticas);       // GET stats del inventario
router.get('/', obtenerPiezas);                          // GET listado con filtros
router.get('/:id', obtenerPieza);                        // GET una pieza
router.post('/', crearPieza);                            // POST crear pieza
router.put('/:id', actualizarPieza);                     // PUT actualizar pieza
router.delete('/:id', eliminarPieza);                    // DELETE eliminar pieza

module.exports = router;