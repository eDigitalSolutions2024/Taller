// backend/models/Vehiculo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ESTADOS_ORDEN = [
  'PENDIENTE_CAPTURA',
  'PENDIENTE_REFACCIONARIA',
  'PENDIENTE_AUTORIZACION',
  'REPARACION_EN_CURSO',
  'CALIDAD',
  'PENDIENTE_CERRAR',
  'CERRADA',
];

const vehiculoSchema = new Schema(
  {
    cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },

    estadoOrden: {
      type: String,
      enum: ESTADOS_ORDEN,
      default: 'PENDIENTE_CAPTURA',
      index: true,
    },

    // ── Cabecera ─────────────────────────────────────────────────────────────
    ordenServicio:  String,
    fechaRecepcion: Date,
    horaRecepcion:  String,

    // Presupuesto (cotización)
    dirigidoA:        { type: String, default: "" },
    departamento:     { type: String, default: "" },
    observCotizacion: { type: String, default: "" },

    // ── Datos de cliente (snapshot) ───────────────────────────────────────────
    nombreCliente:             String,
    apellidoPaterno:           String,
    apellidoMaterno:           String,
    nombreGobierno:            String,
    nombreContactoGobierno:    String,
    nombreDependencia:         String,
    nombreContactoDependencia: String,

    telefonoFijoLada: String,
    telefonoFijo:     String,
    celularLada:      String,
    celular:          String,

    direccion:    String,
    numeroExt:    String,
    numeroInt:    String,
    colonia:      String,
    rfc:          String,
    regimenFiscal: String,   // ← NUEVO
    usoCFDI:      String,    // ← NUEVO
    codigoPostal: String,
    ciudad:       String,
    estado:       String,
    formaPago:    String,    // ← NUEVO
    metodoPago:   String,    // ← NUEVO

    // ── Datos de vehículo ─────────────────────────────────────────────────────
    nombreUsuarioDejaVehiculo: String,
    marca:          String,
    modelo:         String,
    anio:           String,
    color:          String,
    serie:          String,
    puertas:        String,   // ← NUEVO
    placas:         String,
    kmsMillas:      String,
    transmision:    String,   // ← NUEVO  STD / AUT
    cilindros:      String,   // ← NUEVO  4 / 6 / 8
    combustion:     String,   // ← NUEVO  Gasolina / Diesel / Híbrido / Eléctrico
    seguroRines:    String,   // ← NUEVO  SI / NO
    llavesControl:  String,   // ← NUEVO  SI / NO
    nacionalidad:   String,
    motor:          String,
    numeroEconomico: String,
    correo:         String,           // campo legacy (por compatibilidad)
    correos:        [{ type: String }], // ← NUEVO (array de correos)
    traccion:       String,

    // ── Accesorios / checkboxes ───────────────────────────────────────────────
    grua:      String,
    precioGrua: { type: Number, default: 0 },

    // Espejo / Copas / Focos / Interior
    espejoLateralIzq:     Boolean,
    espejoLateralDer:     Boolean,
    copasDelanterasIzq:   Boolean,
    copasDelanterasDer:   Boolean,
    parabrisas:           String,
    focosDel:             Boolean,
    focosTras:            Boolean,
    espejoInt:            Boolean,
    tapetesDelanterosIzq: Boolean,
    tapetesDelanterosDer: Boolean,
    estereo:              Boolean,
    extra:                Boolean,
    // Inventario faltante del PDF ── NUEVOS ────────────────────────────────
    cristalesExt:   Boolean,
    limpiadoresExt: Boolean,
    cristalesInt:   Boolean,
    limpiadoresInt: Boolean,

    // Copas Traseras / Tapetes / Otros
    copasTraserasIzq:   Boolean,
    copasTraserasDer:   Boolean,
    micas:              Boolean,
    antena:             Boolean,
    encendedor:         Boolean,
    tapetesTraserosIzq: Boolean,
    tapetesTraserosDer: Boolean,
    gato:               Boolean,
    bateria:            Boolean,
    // Accesorios faltantes del PDF ── NUEVOS ───────────────────────────────
    llaveRueda:     Boolean,
    extintor:       Boolean,
    llantaExtra:    Boolean,
    cablesCorrente: Boolean,
    cruceta:        Boolean,

    // Daño y gasolina
    danoVehiculo:  String,   // ← NUEVO  base64 del canvas (JPEG comprimido)
    nivelGasolina: String,   // ← corregido de Boolean → String ("E","1/4","1/2"…"F")

    // Fotos del vehículo ── NUEVO ──────────────────────────────────────────
    fotosVehiculo: [
      {
        id:   { type: String },
        name: { type: String },
        src:  { type: String }, // base64 comprimido
      },
    ],

    // ── Indicadores tablero ───────────────────────────────────────────────────
    checkEngine: String,
    abs:         String,
    airBag:      String,
    frenos:      String,
    aceite:      String,
    alternador:  String,

    indicadoresTablero: String,
    otros:              String,
    observaciones:      String,

    // ── Servicio o Reparación ─────────────────────────────────────────────────
    servicioReparacion: {
      serviciosSeleccionados: [{ type: String }],
      infoLlantas:    { type: String, default: "" },
      revisionFallas: { type: String, default: "" },
    },

    ordenIniciada: { type: Boolean, default: false },

    // ── Requisición y Diagnóstico ─────────────────────────────────────────────
    diagnosticoTecnico: { type: String, default: "" },

    historialDiagnosticos: [
      {
        texto:   { type: String, default: "" },
        fecha:   { type: Date,   default: Date.now },
        usuario: { type: String, default: "" },
      },
    ],

    refaccionesSolicitadas: [
      {
        cant:           { type: Number, default: 0 },
        unidad:         { type: String, default: "" },
        refaccion:      { type: String, default: "" },
        tipo:           { type: String, default: "" },
        marca:          { type: String, default: "" },
        proveedor:      { type: String, default: "" },
        codigo:         { type: String, default: "" },
        precioUnitario: { type: Number, default: 0 },
        importeTotal:   { type: Number, default: 0 },
        moneda:         { type: String, default: "MN" },
        tiempoEntrega:  { type: String, default: "" },
        core:           { type: String, default: "" },
        observaciones:  { type: String, default: "" },
        estatus: {
          type: String,
          enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
          default: 'PENDIENTE',
        },
        requiereOC: { type: Boolean, default: false },
        ocGenerada:  { type: Boolean, default: false },
        numeroOC:    { type: String,  default: null  },
        ordenCompra: { type: Schema.Types.ObjectId, ref: 'OrdenCompra', default: null },
      },
    ],

    // ── Cargos en orden ───────────────────────────────────────────────────────
    cargosEnOrden: [
      {
        cant:           { type: Number, default: 0 },
        unidad:         { type: String, default: "" },
        concepto:       { type: String, default: "" },
        marca:          { type: String, default: "" },
        proveedor:      { type: String, default: "" },
        codigo:         { type: String, default: "" },
        precioUnitario: { type: Number, default: 0 },
        importeTotal:   { type: Number, default: 0 },
        moneda:         { type: String, default: "MN" },
        observaciones:  { type: String, default: "" },
        documento:      { type: String, default: "" },
      },
    ],

    // ── Presupuesto ───────────────────────────────────────────────────────────
    presupuesto: [
      {
        cant:          { type: Number, default: 0 },
        concepto:      { type: String, default: "" },
        refaccion:     { type: String, default: "" },
        tipo:          { type: String, default: "" },
        marca:         { type: String, default: "" },
        proveedor:     { type: String, default: "" },
        codigo:        { type: String, default: "" },
        precioCompra:  { type: Number, default: 0 },
        tiempoEntrega: { type: String, default: "" },
        horasMO:       { type: Number, default: 0 },
        precioVenta:   { type: Number, default: 0 },
        observInt:     { type: String, default: "" },
        estatus: {
          type: String,
          enum: ["PENDIENTE", "AUTORIZADO", "RECHAZADO"],
          default: "PENDIENTE",
        },
      },
    ],

    // ── Venta al cliente ──────────────────────────────────────────────────────
    ventaCliente: [
      {
        cant:          { type: Number, default: 0 },
        concepto:      { type: String, default: "" },
        precioVenta:   { type: Number, default: 0 },
        observaciones: { type: String, default: "" },
      },
    ],

    // ── Mano de Obra ──────────────────────────────────────────────────────────
    manoObra: [
      {
        concepto:      { type: String, default: "" },
        mecanico:      { type: String, default: "" },
        horas:         { type: Number, default: 0 },
        fechaPago:     { type: String, default: "" },
        observaciones: { type: String, default: "" },
      },
    ],

    // ── Observaciones finales ─────────────────────────────────────────────────
    observacionesExternas: { type: String, default: "" },
    observacionesInternas: { type: String, default: "" },
  },
  { timestamps: true }
);

// Generar número de Orden de Servicio automáticamente si no viene
vehiculoSchema.pre('save', function (next) {
  if (!this.ordenServicio || this.ordenServicio === "") {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mi = String(ahora.getMinutes()).padStart(2, '0');
    const ss = String(ahora.getSeconds()).padStart(2, '0');
    this.ordenServicio = `OS-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  }
  next();
});

module.exports = mongoose.model('Vehiculo', vehiculoSchema);