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
    // Permite requests sin origin (Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true
}));

app.use(express.json());


const empleadosRoutes = require('./routes/empleados');
const ordenesCompraRoutes = require('./routes/ordenesCompra');
const facturacionRoutes = require("./routes/facturacion");
app.use("/api/facturacion", facturacionRoutes);


app.get('/', (_req, res) => res.send('API Taller OK'));
app.use('/api/auth', require('./routes/authRoutes'));


app.use("/api/clientes", require("./routes/clientes"));


app.use('/api/proveedores', require('./routes/proveedores'));

app.use('/api/vehiculos', require('./routes/vehiculos')); // 👈 NUEVA

app.use('/api/entradas', require('./routes/entradas'));

app.use('/api/inventario', require('./routes/inventario'));

// MONTA LAS RUTAS
app.use('/api/codigos', require('./routes/codigos'));  // <— IMPORTANTE

app.use('/api/salidas', require('./routes/salidas'));

app.use('/api/empleados', empleadosRoutes);

app.use('/api/devoluciones', require('./routes/devoluciones')); 

app.use("/api", require("./routes/facturacion"));

app.use('/api/ordenes-compra', ordenesCompraRoutes);

// index.js / app.js del backend
app.use('/api', require('./routes/facturas')); // ahora existe GET /api/facturas-proveedor
 
app.use("/api/fiscal-config", require("./routes/fiscal_config"));

const generarXmlRoutes = require("./routes/generar_xml");
app.use("/api/generar-xml", require("./routes/generar_xml"));



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server en http://localhost:${PORT}`));

