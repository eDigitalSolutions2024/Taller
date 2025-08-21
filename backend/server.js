require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
console.log('JWT_SECRET cargado:', !!process.env.JWT_SECRET);

const app = express();
connectDB();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => res.send('API Taller OK'));
app.use('/api/auth', require('./routes/authRoutes'));


app.use("/api/clientes", require("./routes/clientes"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server en http://localhost:${PORT}`));
