require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const limpiarImagenesTemp = require('./utils/limpiarImagenesTemp');
console.log('JWT_SECRET cargado:', !!process.env.JWT_SECRET);

const app = express();
connectDB();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true
}));

// ✅ Límite ANTES de las rutas para que aplique a todas
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
console.log('✅ Body limit: 20mb activo');

// Imágenes adjuntas a órdenes de vehículo (backend/uploads/vehiculos/...)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
limpiarImagenesTemp();
setInterval(limpiarImagenesTemp, 6 * 60 * 60 * 1000);

const empleadosRoutes          = require('./routes/empleados');
const ordenesCompraRoutes      = require('./routes/ordenesCompra');
const facturacionRoutes        = require("./routes/facturacion");
const diagnosticosCatalogoRoutes = require('./routes/diagnosticosCatalogo');

const piezasCodigosRoutes = require('./routes/piezasCodigosRoutes');

app.use("/api/facturacion", facturacionRoutes);

app.get('/', (_req, res) => res.send('API Taller OK'));
app.use('/api/auth',               require('./routes/authRoutes'));
app.use('/api/users',              require('./routes/users'));
app.use("/api/clientes",           require("./routes/clientes"));
app.use('/api/proveedores',        require('./routes/proveedores'));
app.use('/api/vehiculos',          require('./routes/vehiculos'));
app.use('/api/entradas',           require('./routes/entradas'));
app.use('/api/inventario',         require('./routes/inventario'));
app.use('/api/codigos',            require('./routes/codigos'));
app.use('/api/salidas',            require('./routes/salidas'));
app.use('/api/empleados',          empleadosRoutes);
app.use('/api/devoluciones',       require('./routes/devoluciones'));
app.use("/api",                    require("./routes/facturacion"));
app.use('/api/ordenes-compra',     ordenesCompraRoutes);
app.use('/api',                    require('./routes/facturas'));
app.use("/api/fiscal-config",      require("./routes/fiscal_config"));
app.use('/api/diagnosticos-catalogo', diagnosticosCatalogoRoutes);

app.use('/api/piezas-codigos', piezasCodigosRoutes);

console.log('✅ Ruta /api/diagnosticos-catalogo montada');

app.use("/api/generar-xml",        require("./routes/generar_xml"));
app.use('/api/facturas-cfdi',      require('./routes/facturas_cfdi'));
app.use('/api/conceptos-preset',   require('./routes/conceptos_preset'));
app.use('/api/claves-unidad',      require('./routes/claves_unidad'));
app.use('/api/garantias',          require('./routes/garantias'));
app.use('/api/servicios-catalogo', require('./routes/serviciosCatalogo'));
app.use('/api/cajas',              require('./routes/cajas'));
app.use('/api/garage',             require('./routes/garage'));
app.use('/api/configuracion',      require('./routes/configuracion'));
app.use('/api/cierre-caja',        require('./routes/cierreCaja'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server en http://localhost:${PORT}`));