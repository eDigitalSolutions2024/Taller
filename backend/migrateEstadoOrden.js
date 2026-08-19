// migrateEstadoOrden.js  (en la carpeta backend)
//
// Migra los documentos existentes de Vehiculo al nuevo esquema:
//   1) estadoOrden: PENDIENTE_CAPTURA -> INGRESO, PENDIENTE_AUTORIZACION -> PENDIENTE_REFACCIONARIA
//   2) presupuesto[].estatus (PENDIENTE/AUTORIZADO/RECHAZADO) -> presupuesto[].autorizado (bool)
//
// Uso:
//   node backend/migrateEstadoOrden.js --dry-run   // solo cuenta, no escribe
//   node backend/migrateEstadoOrden.js              // aplica los cambios

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Vehiculo = require('./models/Vehiculo');

const DRY_RUN = process.argv.includes('--dry-run');

const MAPA_ESTADOS = {
  PENDIENTE_CAPTURA: 'INGRESO',
  PENDIENTE_AUTORIZACION: 'PENDIENTE_REFACCIONARIA',
  // CALIDAD se retiró del flujo (no tenía ninguna pantalla que lo usara);
  // las órdenes que quedaron ahí se pliegan de vuelta a reparación en curso.
  CALIDAD: 'REPARACION_EN_CURSO',
};

const run = async () => {
  try {
    console.log(`✅ Iniciando migración de estadoOrden${DRY_RUN ? ' (--dry-run, no se escribirá nada)' : ''}...`);

    await connectDB();
    console.log('✅ Conectado a MongoDB desde migrateEstadoOrden.js');

    let totalActualizados = 0;

    // 1) estadoOrden
    for (const [viejo, nuevo] of Object.entries(MAPA_ESTADOS)) {
      if (DRY_RUN) {
        const count = await Vehiculo.countDocuments({ estadoOrden: viejo });
        console.log(`  [dry-run] ${viejo} -> ${nuevo}: ${count} documento(s) a actualizar`);
        continue;
      }
      const res = await Vehiculo.updateMany(
        { estadoOrden: viejo },
        { $set: { estadoOrden: nuevo } }
      );
      console.log(`  ${viejo} -> ${nuevo}: ${res.modifiedCount} documento(s) actualizados`);
      totalActualizados += res.modifiedCount;
    }

    // 2) presupuesto[].estatus -> presupuesto[].autorizado
    const ordenesConPresupuestoViejo = await Vehiculo.find({ 'presupuesto.estatus': { $exists: true } });

    if (DRY_RUN) {
      console.log(`  [dry-run] presupuesto[].estatus -> autorizado: ${ordenesConPresupuestoViejo.length} orden(es) con campo viejo`);
    } else {
      for (const orden of ordenesConPresupuestoViejo) {
        let cambiado = false;
        for (const p of orden.presupuesto) {
          if (p.estatus !== undefined) {
            p.autorizado = p.estatus === 'AUTORIZADO';
            p.estatus = undefined;
            cambiado = true;
          }
        }
        if (cambiado) {
          await orden.save();
          totalActualizados += 1;
        }
      }
      console.log(`  presupuesto[].estatus -> autorizado: ${ordenesConPresupuestoViejo.length} orden(es) migradas`);
    }

    if (DRY_RUN) {
      console.log('🎉 Dry-run completo. No se escribió nada.');
    } else {
      console.log(`🎉 Migración completa. ${totalActualizados} documento(s) actualizados en total.`);
    }

    await mongoose.disconnect();
    console.log('🔌 Conexión a Mongo cerrada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migrateEstadoOrden:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

run();
