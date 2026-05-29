require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
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

const empleadosRoutes          = require('./routes/empleados');
const ordenesCompraRoutes      = require('./routes/ordenesCompra');
const facturacionRoutes        = require("./routes/facturacion");
const diagnosticosCatalogoRoutes = require('./routes/diagnosticosCatalogo');

app.use("/api/facturacion", facturacionRoutes);

app.get('/', (_req, res) => res.send('API Taller OK'));
app.use('/api/auth',               require('./routes/authRoutes'));
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
console.log('✅ Ruta /api/diagnosticos-catalogo montada');

app.use("/api/generar-xml",        require("./routes/generar_xml"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server en http://localhost:${PORT}`));