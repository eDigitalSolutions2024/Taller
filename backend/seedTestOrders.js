// seedTestOrders.js  (en la carpeta backend)
// Crea clientes y órdenes de prueba para probar el módulo Vehículo/Cajas
// de punta a punta (Entrada, Consulta Órdenes, Presupuesto y Venta, Cajas).
// Idempotente: si ya existen los clientes/órdenes de prueba (marcados con
// notas: 'SEED_TEST'), no los vuelve a crear.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Cliente = require('./models/Cliente');
const Vehiculo = require('./models/Vehiculo');
const CodigoSeq = require('./models/CodigoSeq');

const CREADO_POR = 'Admin Taller';

async function siguienteFolio(key) {
  const contador = await CodigoSeq.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return contador.seq;
}

async function siguienteOrdenServicio() {
  const ultimo = await Vehiculo.findOne().sort({ createdAt: -1 }).lean();
  let nextNum = 1;
  if (ultimo?.ordenServicio) {
    const match = String(ultimo.ordenServicio).match(/(\d+)$/);
    if (match) nextNum = Number(match[1]) + 1;
  }
  return `OS-${String(nextNum).padStart(5, '0')}`;
}

async function upsertCliente(datos) {
  let cliente = await Cliente.findOne({ nombre: datos.nombre, apellidoPaterno: datos.apellidoPaterno });
  if (cliente) return cliente;
  cliente = new Cliente({ ...datos, observaciones: 'SEED_TEST' });
  await cliente.save();
  return cliente;
}

const run = async () => {
  try {
    console.log('✅ Iniciando seed de órdenes de prueba...');
    await connectDB();
    console.log('✅ Conectado a MongoDB desde seedTestOrders.js');

    const yaSembrado = await Vehiculo.findOne({ observacionesInternas: 'SEED_TEST' }).lean();
    if (yaSembrado) {
      console.log('⚠️  Ya existen órdenes de prueba (observacionesInternas: SEED_TEST). No se crea nada nuevo.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ===== Clientes de prueba =====
    const clienteMaria = await upsertCliente({
      tipoCliente: 'Particular',
      nombre: 'María',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Hernández',
      email: 'maria.lopez@example.com',
      telefono: { lada: '656', numero: '1112233' },
      celular: { lada: '656', numero: '2223344' },
    });

    const clienteRoberto = await upsertCliente({
      tipoCliente: 'Particular',
      nombre: 'Roberto',
      apellidoPaterno: 'Salazar',
      apellidoMaterno: 'Nuñez',
      email: 'roberto.salazar@example.com',
      telefono: { lada: '656', numero: '3334455' },
      celular: { lada: '656', numero: '4445566' },
    });

    const clienteAna = await upsertCliente({
      tipoCliente: 'Particular',
      nombre: 'Ana',
      apellidoPaterno: 'Ramírez',
      apellidoMaterno: 'Ortiz',
      email: 'ana.ramirez@example.com',
      telefono: { lada: '656', numero: '5556677' },
      celular: { lada: '656', numero: '6667788' },
    });

    console.log('✅ Clientes de prueba listos:', [clienteMaria, clienteRoberto, clienteAna].map((c) => c.nombre).join(', '));

    const hoy = new Date();
    const haceTresDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ===== Orden 1: INGRESO (recién ingresada, sin presupuesto todavía) =====
    const orden1 = new Vehiculo({
      cliente: clienteMaria._id,
      estadoOrden: 'INGRESO',
      creadoPor: CREADO_POR,
      ordenServicio: await siguienteOrdenServicio(),
      fechaRecepcion: hoy,
      horaRecepcion: '09:15',
      nombreCliente: 'María',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Hernández',
      telefonoFijoLada: '656',
      telefonoFijo: '1112233',
      celularLada: '656',
      celular: '2223344',
      correos: ['maria.lopez@example.com'],
      marca: 'Nissan',
      modelo: 'Versa',
      anio: '2022',
      color: 'Blanco',
      serie: '3N1CN7AP0NL123456',
      placas: 'ABC-123-A',
      kmsMillas: '45000',
      transmision: 'AUT',
      combustion: 'Gasolina',
      nivelGasolina: '1/2',
      observacionesInternas: 'SEED_TEST',
    });
    await orden1.save();

    // ===== Orden 2: PENDIENTE_REFACCIONARIA con presupuesto listo para
    // autorizar y enviar a venta (prueba la pantalla Presupuesto y Venta) =====
    const orden2 = new Vehiculo({
      cliente: clienteRoberto._id,
      estadoOrden: 'PENDIENTE_REFACCIONARIA',
      creadoPor: CREADO_POR,
      ordenServicio: await siguienteOrdenServicio(),
      fechaRecepcion: haceTresDias,
      horaRecepcion: '11:30',
      nombreCliente: 'Roberto',
      apellidoPaterno: 'Salazar',
      apellidoMaterno: 'Nuñez',
      telefonoFijoLada: '656',
      telefonoFijo: '3334455',
      celularLada: '656',
      celular: '4445566',
      correos: ['roberto.salazar@example.com'],
      marca: 'Chevrolet',
      modelo: 'Aveo',
      anio: '2021',
      color: 'Gris',
      serie: '9GAEC69W0MB123789',
      placas: 'XYZ-456-B',
      kmsMillas: '62000',
      transmision: 'STD',
      combustion: 'Gasolina',
      nivelGasolina: '1/4',
      presupuesto: [
        {
          cant: 1,
          concepto: 'Balatas delanteras',
          refaccion: 'Balatas delanteras',
          tipo: 'Alterna',
          marca: 'Brembo',
          proveedor: 'Refaccionaria Central',
          codigo: 'BAL-DEL-001',
          precioCompra: 450,
          precioVenta: 650,
          moneda: 'MN',
          horasMO: 1,
          autorizado: true,
        },
        {
          cant: 1,
          concepto: 'Cambio de aceite y filtro',
          refaccion: '',
          esServicio: true,
          precioCompra: 300,
          precioVenta: 500,
          moneda: 'MN',
          horasMO: 0.5,
          autorizado: true,
        },
        {
          cant: 2,
          concepto: 'Amortiguadores traseros',
          refaccion: 'Amortiguadores traseros',
          tipo: 'Original',
          marca: 'KYB',
          proveedor: 'Refaccionaria Central',
          codigo: 'AMO-TRAS-002',
          precioCompra: 900,
          precioVenta: 1300,
          moneda: 'MN',
          horasMO: 1.5,
          autorizado: false,
        },
      ],
      observacionesInternas: 'SEED_TEST',
    });
    await orden2.save();

    // ===== Orden 3: REPARACION_EN_CURSO con venta al cliente y mano de obra
    // ya capturadas (prueba Cajas: registrar pago, ver totales) =====
    const orden3 = new Vehiculo({
      cliente: clienteAna._id,
      estadoOrden: 'REPARACION_EN_CURSO',
      creadoPor: CREADO_POR,
      ordenServicio: await siguienteOrdenServicio(),
      fechaRecepcion: haceUnaSemana,
      horaRecepcion: '08:45',
      nombreCliente: 'Ana',
      apellidoPaterno: 'Ramírez',
      apellidoMaterno: 'Ortiz',
      telefonoFijoLada: '656',
      telefonoFijo: '5556677',
      celularLada: '656',
      celular: '6667788',
      correos: ['ana.ramirez@example.com'],
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: '2020',
      color: 'Rojo',
      serie: '5YFB4MDE0LP654321',
      placas: 'JLR-789-C',
      kmsMillas: '78000',
      transmision: 'AUT',
      combustion: 'Gasolina',
      nivelGasolina: 'F',
      requiereFactura: false,
      ventaCliente: [
        { cant: 1, concepto: 'Balatas delanteras', precioVenta: 650, observaciones: '' },
        { cant: 1, concepto: 'Cambio de aceite y filtro', precioVenta: 500, observaciones: '' },
      ],
      manoObra: [
        { concepto: 'Balatas delanteras', mecanico: 'Juan Pérez', horas: 1, fechaPago: '', observaciones: '' },
        { concepto: 'Cambio de aceite y filtro', mecanico: 'Juan Pérez', horas: 0.5, fechaPago: '', observaciones: '' },
      ],
      ivaVenta: 8,
      observacionesInternas: 'SEED_TEST',
    });
    await orden3.save();

    // ===== Orden 4: CERRADA con pago de contado ya registrado (prueba Cajas:
    // historial de pagos, impresión de Nota de Venta, tab Liquidadas) =====
    const orden4 = new Vehiculo({
      cliente: clienteMaria._id,
      estadoOrden: 'CERRADA',
      creadoPor: CREADO_POR,
      ordenServicio: await siguienteOrdenServicio(),
      fechaRecepcion: haceUnaSemana,
      horaRecepcion: '10:00',
      fechaCierre: haceTresDias,
      nombreCliente: 'María',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Hernández',
      telefonoFijoLada: '656',
      telefonoFijo: '1112233',
      celularLada: '656',
      celular: '2223344',
      correos: ['maria.lopez@example.com'],
      marca: 'Nissan',
      modelo: 'Sentra',
      anio: '2019',
      color: 'Negro',
      serie: '3N1AB7AP0KY111222',
      placas: 'DEF-321-D',
      kmsMillas: '95000',
      transmision: 'AUT',
      combustion: 'Gasolina',
      nivelGasolina: '3/4',
      requiereFactura: false,
      ventaCliente: [
        { cant: 1, concepto: 'Afinación mayor', precioVenta: 1800, observaciones: '' },
        { cant: 4, concepto: 'Bujías', precioVenta: 150, observaciones: '' },
      ],
      manoObra: [
        { concepto: 'Afinación mayor', mecanico: 'Luis García', horas: 2, fechaPago: '', observaciones: '' },
      ],
      ivaVenta: 8,
      pagos: [
        {
          fecha: haceTresDias,
          tipoPago: 'COMPLETO',
          comprobante: 'NOTA_VENTA',
          // Subtotal (1800 + 4*150 = 2400) + IVA 8% (192) = 2592
          montoPesos: 2592,
          montoDolares: 0,
          tipoCambio: 0,
          monto: 2592,
          referencia: '',
          observaciones: '',
          notas: 'Liquida',
          registradoPor: CREADO_POR,
          notaVenta: { numero: await siguienteFolio('pago_notaVenta'), banco: 'EFECTIVOS', tipo: 'Contado' },
        },
      ],
      observacionesInternas: 'SEED_TEST',
    });
    await orden4.save();

    // ===== Orden 5: CANCELADA (prueba Consulta Órdenes Canceladas) =====
    const orden5 = new Vehiculo({
      cliente: clienteRoberto._id,
      estadoOrden: 'CANCELADA',
      estadoAnterior: 'INGRESO',
      creadoPor: CREADO_POR,
      ordenServicio: await siguienteOrdenServicio(),
      fechaRecepcion: haceUnaSemana,
      horaRecepcion: '16:20',
      nombreCliente: 'Roberto',
      apellidoPaterno: 'Salazar',
      apellidoMaterno: 'Nuñez',
      telefonoFijoLada: '656',
      telefonoFijo: '3334455',
      celularLada: '656',
      celular: '4445566',
      correos: ['roberto.salazar@example.com'],
      marca: 'Ford',
      modelo: 'Fiesta',
      anio: '2018',
      color: 'Azul',
      serie: '3FADP4EJ0JM999888',
      placas: 'GHI-654-E',
      kmsMillas: '110000',
      transmision: 'STD',
      combustion: 'Gasolina',
      nivelGasolina: 'E',
      observacionesInternas: 'SEED_TEST',
      observacionesExternas: 'Cliente decidió no proceder con el servicio.',
    });
    await orden5.save();

    console.log('🎉 Órdenes de prueba creadas:');
    console.log(`   ${orden1.ordenServicio} — INGRESO — ${orden1.marca} ${orden1.modelo} (María López)`);
    console.log(`   ${orden2.ordenServicio} — PENDIENTE_REFACCIONARIA — ${orden2.marca} ${orden2.modelo} (Roberto Salazar) [presupuesto listo para autorizar/enviar a venta]`);
    console.log(`   ${orden3.ordenServicio} — REPARACION_EN_CURSO — ${orden3.marca} ${orden3.modelo} (Ana Ramírez) [venta al cliente + mano de obra capturadas, listo para registrar pago en Cajas]`);
    console.log(`   ${orden4.ordenServicio} — CERRADA — ${orden4.marca} ${orden4.modelo} (María López) [pago de contado ya registrado, Nota de Venta folio ${orden4.pagos[0].notaVenta.numero}]`);
    console.log(`   ${orden5.ordenServicio} — CANCELADA — ${orden5.marca} ${orden5.modelo} (Roberto Salazar)`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en seedTestOrders.js:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();
