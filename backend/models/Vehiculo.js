// backend/models/Vehiculo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ESTADOS_ORDEN = [
  'INGRESO',
  'PENDIENTE_REFACCIONARIA',
  'PENDIENTE_AUTORIZACION_CLIENTE',
  'PENDIENTE_SURTIR',
  'PENDIENTE_CIERRE',
  'REPARACION_EN_CURSO',
  'PENDIENTE_CERRAR',
  'CERRADA',
  'CANCELADA',
];

// ===== Cajas: catálogos =====
const BANCOS_CAJA = ['BANREGIO', 'AMERICAN EXPRESS', 'BANAMEX', 'BANORTE', 'BBVA BANCOMER', 'DOLARES', 'EFECTIVOS'];
const TIPO_NOTA = ['Contado', 'Credito', 'Cancelada'];

// ===== Solicitud de Garantía =====
// Sub-documento embebido en la orden NUEVA que se abre por garantía.
// default: null → las órdenes normales no llevan garantía.
const garantiaSchema = new Schema(
  {
    estado: {
      type: String,
      enum: ['PENDIENTE', 'APROBADA', 'NEGADA', 'NO_APLICA'],
      default: 'PENDIENTE',
    },
    motivo: { type: String, default: '' },
    ordenAnterior: { type: Schema.Types.ObjectId, ref: 'Vehiculo', default: null },
    ordenAnteriorFolio: { type: String, default: '' },
    fechaSolicitud: { type: Date, default: null },
    fechaResolucion: { type: Date, default: null },
    // Ajuste al total de la orden (SIN IVA); negativo = descuento
    costoDiferencia: { type: Number, default: 0 },
    autorizaCarreon: { type: Boolean, default: false },
    resueltoPor: { type: String, default: '' },
  },
  { _id: false }
);

const vehiculoSchema = new Schema(
  {
    cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },

    // Orden "Sin Vehículo": cliente walk-in que compra refacciones sueltas o
    // recibe un servicio sin registrar vehículo. Inmutable tras la creación
    // (no forma parte del whitelist de PUT /:id/datos).
    sinVehiculo: { type: Boolean, default: false },

    estadoOrden: {
      type: String,
      enum: ESTADOS_ORDEN,
      default: 'INGRESO',
      index: true,
    },

    // Estado en el que se encontraba la orden justo antes de cerrarse o
    // cancelarse. Permite a un admin "restablecerla" a ese estado.
    estadoAnterior: {
      type: String,
      enum: ESTADOS_ORDEN,
      default: null,
    },

    // Solicitud de garantía (null = orden normal)
    garantia: { type: garantiaSchema, default: null },

    fechaSolicitudRefacciones: { type: Date, default: null },
    fechaRespuestaRefaccionaria: { type: Date, default: null },
    refaccionesOmitidas: { type: Boolean, default: false },
    fechaEnvioSurtir: { type: Date, default: null },
    creadoPor: { type: String, default: "" },
    devueltoPor: { type: String, default: "" },
    fechaCierre: { type: Date, default: null },

    // ── Cabecera ─────────────────────────────────────────────────────────────
    ordenServicio:  String,
    fechaRecepcion: Date,
    horaRecepcion:  String,

    // Presupuesto (cotización)
    dirigidoA:        { type: String, default: "" },
    departamento:     { type: String, default: "" },
    observCotizacion: { type: String, default: "" },
    requiereFactura:  { type: Boolean, default: false },

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
    regimenFiscal: String,
    usoCFDI:      String,
    codigoPostal: String,
    ciudad:       String,
    estado:       String,
    formaPago:    String,
    metodoPago:   String,

    // ── Datos de vehículo ─────────────────────────────────────────────────────
    nombreUsuarioDejaVehiculo: String,
    marca:          String,
    modelo:         String,
    anio:           String,
    color:          String,
    serie:          String,
    puertas:        String,
    placas:         String,
    kmsMillas:      String,
    transmision:    String,   // STD / AUT
    cilindros:      String,   // 4 / 6 / 8
    combustion:     String,   // Gasolina / Diesel / Híbrido / Eléctrico
    seguroRines:    String,   // SI / NO
    llavesControl:  String,   // SI / NO
    nacionalidad:   String,
    motor:          String,
    numeroEconomico: String,
    correo:         String,             // campo legacy (por compatibilidad)
    correos:        [{ type: String }], // array de correos
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
    llaveRueda:     Boolean,
    extintor:       Boolean,
    llantaExtra:    Boolean,
    cablesCorrente: Boolean,
    cruceta:        Boolean,

    // Daño y gasolina
    danoVehiculo:  String,   // base64 del canvas (JPEG comprimido)
    nivelGasolina: String,   // "E","1/4","1/2"…"F"

    // Fotos del vehículo
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

      mantenimientoMotor: {
        afinacion:                    { type: Boolean, default: false },
        limpiezaInyectores:           { type: Boolean, default: false },
        limpiezaCuerpoAceleracion:    { type: Boolean, default: false },
        lubricacion:                  { type: Boolean, default: false },
        cambioAceite:                 { type: Boolean, default: false },
        engrase:                      { type: Boolean, default: false },
        revisionNivelesFluidos:       { type: Boolean, default: false },
        lubricacionBisagras:          { type: Boolean, default: false },
        lubricarSuspensionDireccion:  { type: Boolean, default: false },
        revisionCarretera:            { type: Boolean, default: false },
        diagnosticoCompra:            { type: Boolean, default: false },
        otrosServicios:               { type: Boolean, default: false },
        alineacionComputadora:        { type: Boolean, default: false },
        balanceo4Ruedas:              { type: Boolean, default: false },
        reemplazoBalatas4Ruedas:      { type: Boolean, default: false },
        recargaGasAC:                 { type: Boolean, default: false },
        servicioCoolingTermostato:    { type: Boolean, default: false },
      },

      fallasReportadasCliente: { type: String, default: "" },

      sintomas: {
        noEnciende:            { type: Boolean, default: false },
        tardaEncenderFrio:     { type: Boolean, default: false },
        tardaEncenderCaliente: { type: Boolean, default: false },
        cascabelea:            { type: Boolean, default: false },
        motorTembloroso:       { type: Boolean, default: false },
        faltaPotencia:         { type: Boolean, default: false },
        hechaHumo:             { type: Boolean, default: false },
        humoColor:             { type: String, default: "" },
      },

      indicadoresTableroServicio: {
        checkEngine: { type: Boolean, default: false },
        abs:         { type: Boolean, default: false },
        airBag:      { type: Boolean, default: false },
        frenos:      { type: Boolean, default: false },
        aceite:      { type: Boolean, default: false },
        alternador:  { type: Boolean, default: false },
        otros:       { type: String, default: "" },
      },

      fallasMotorOtros:       { type: String, default: "" },
      precioFallasMotorOtros: { type: Number, default: 0 },

      sistemaElectricoAire:       { type: String, default: "" },
      precioSistemaElectricoAire: { type: Number, default: 0 },

      suspensionDireccionFrenos:       { type: String, default: "" },
      precioSuspensionDireccionFrenos: { type: Number, default: 0 },

      sistemaEnfriamiento:       { type: String, default: "" },
      precioSistemaEnfriamiento: { type: Number, default: 0 },
    },

    // Servicios de catálogo (paquetes de refacciones) seleccionados al omitir
    // refaccionaria — snapshot congelado, no referencia viva al catálogo.
    serviciosCatalogoSeleccionados: [
      {
        servicioId: { type: Schema.Types.ObjectId, ref: 'ServicioCatalogo', default: null },
        nombre: { type: String, default: "" },
        refacciones: [
          {
            nombre:      { type: String, default: "" },
            obligatoria: { type: Boolean, default: false },
            incluida:    { type: Boolean, default: true },
            observacion: { type: String, default: "" },
          },
        ],
        fechaSeleccion: { type: Date, default: Date.now },
      },
    ],

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

        // Cotizaciones de refaccionaria para esta refacción (comparación
        // multi-proveedor); opcionSeleccionada indexa dentro de este arreglo.
        opciones: [
          {
            unidad:         { type: String, default: "" },
            tipo:           { type: String, default: "" },
            marca:          { type: String, default: "" },
            proveedor:      { type: String, default: "" },
            codigo:         { type: String, default: "" },
            precioUnitario: { type: Number, default: 0 },
            importeTotal:   { type: Number, default: 0 },
            moneda:         { type: String, default: "MN" },
            tipoCambio:     { type: Number, default: 0 },
            tiempoEntrega:  { type: String, default: "" },
            core:           { type: String, default: "" },
            precioCore:     { type: Number, default: 0 },
            observaciones:  { type: String, default: "" },
            // Espejo de opcionSeleccionada a nivel de opción individual: el
            // frontend lo usa para el resaltado verde y el botón "Elegida ✓"
            // (ver VehiculoRequisicionDiagnostico.jsx). Faltaba en el schema,
            // así que Mongoose lo descartaba en cada guardado — el botón
            // volvía a "Elegir" en el siguiente refresh aunque la selección
            // sí hubiera quedado guardada a nivel de refacción.
            seleccionada:   { type: Boolean, default: false },
          },
        ],
        opcionSeleccionada: { type: Number, default: null },

        estatus: {
          type: String,
          enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
          default: 'PENDIENTE',
        },
        requiereOC:  { type: Boolean, default: false }, // el checkbox del mecánico
        ocGenerada:  { type: Boolean, default: false }, // ya se generó al menos una OC
        numeroOC:    { type: String,  default: null  }, // folio de la OC principal
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

    // ── Historial de cotizaciones ─────────────────────────────────────────────
    historialCotizaciones: [
      {
        folio: String,
        fecha: Date,
        estado: String,
        dirigidoA: String,
        departamento: String,
        observCotizacion: String,
        partidas: [],
      },
    ],

    // ── Historial de venta al cliente ─────────────────────────────────────────
    historialVentaCliente: [
      {
        folio: { type: String, default: "" },
        fecha: { type: Date, default: Date.now },
        estado: {
          type: String,
          enum: [
            "BORRADOR", "ENVIADA", "PARCIALMENTE_AUTORIZADA", "AUTORIZADA",
            "NO_AUTORIZADA", "PENDIENTE", "REACTIVADA", "VENDIDA",
          ],
          default: "BORRADOR",
        },
        dirigidoA: { type: String, default: "" },
        departamento: { type: String, default: "" },
        observCotizacion: { type: String, default: "" },
        partidas: [
          {
            cant: { type: Number, default: 0 },
            concepto: { type: String, default: "" },
            refaccion: { type: String, default: "" },
            tipo: { type: String, default: "" },
            marca: { type: String, default: "" },
            proveedor: { type: String, default: "" },
            codigo: { type: String, default: "" },
            precioCompra: { type: Number, default: 0 },
            precioOriginal: { type: Number, default: 0 },
            moneda: { type: String, default: "MN" },
            tipoCambio: { type: Number, default: 0 },
            tiempoEntrega: { type: String, default: "" },
            horasMO: { type: Number, default: 0 },
            precioVenta: { type: Number, default: 0 },
            observInt: { type: String, default: "" },
            estatusCliente: {
              type: String,
              enum: ["COTIZADA", "AUTORIZADA", "NO_AUTORIZADA", "PENDIENTE", "REACTIVADA", "VENDIDA"],
              default: "COTIZADA",
            },
            origenPresupuestoIndex: { type: Number, default: null },
          },
        ],
      },
    ],

    // ── Presupuesto ───────────────────────────────────────────────────────────
    presupuesto: [
      {
        origenRefId:   { type: String, default: null },
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
        unidad:        { type: String, default: "" },
        moneda:        { type: String, default: "MN" },
        tipoCambio:    { type: Number, default: 0 },
        core:          { type: String, default: "" },
        precioCore:    { type: Number, default: 0 },
        estatusCotizacion: {
          type: String,
          enum: ["COTIZADA", "PENDIENTE_CLIENTE", "AUTORIZADA", "RECHAZADA", "EJECUTADA", "REACTIVADA"],
          default: "COTIZADA",
        },
        estatusCliente: {
          type: String,
          enum: ["COTIZADA", "AUTORIZADA", "NO_AUTORIZADA", "PENDIENTE", "REACTIVADA", "VENDIDA"],
          default: "COTIZADA",
        },
        autorizado: { type: Boolean, default: false }, // asesor marcó ✓
        surtida:    { type: Boolean, default: false }, // refaccionaria surtió
        esServicio: { type: Boolean, default: false }, // partida de servicio/mano de obra
        origenServicioCatalogo: { type: Boolean, default: false },
        servicioGrupoId: { type: Schema.Types.ObjectId, default: null },
      },
    ],

    // ── Venta al cliente ──────────────────────────────────────────────────────
    ventaCliente: [
      {
        cant:          { type: Number, default: 0 },
        concepto:      { type: String, default: "" },
        precioVenta:   { type: Number, default: 0 },
        observaciones: { type: String, default: "" },
        autorizacionCliente: {
          type: String,
          enum: ["SI", "NO", "PENDIENTE"],
          default: "SI",
        },
        codigoServicio:      { type: String, default: "" },
        descripcionServicio: { type: String, default: "" },
        codigoSat:           { type: String, default: "" },
        descripcionSat:      { type: String, default: "" },
        motivoPrecioCero:    { type: String, default: "" },
        esGarantia:          { type: Boolean, default: false },
        esGrua:              { type: Boolean, default: false },
      },
    ],

    // ── Mano de Obra ──────────────────────────────────────────────────────────
    manoObra: [
      {
        concepto:      { type: String, default: "" },
        presupuestoId: { type: Schema.Types.ObjectId, default: null },
        precioServicio:{ type: Number, default: 0 },
        mecanico:      { type: String, default: "" },
        horas:         { type: Number, default: 0 },
        fechaPago:     { type: String, default: "" },
        observaciones: { type: String, default: "" },
        esCarroceria:     { type: Boolean, default: false },
        carrocero:        { type: String, default: "" },
        precioCarroceria: { type: Number, default: 0 },
      },
    ],

    // ── IVA (porcentaje editable, normalmente 8%) ─────────────────────────────
    ivaPresupuesto: { type: Number, default: 8 },
    ivaVenta:       { type: Number, default: 8 },

    // ── Observaciones finales ─────────────────────────────────────────────────
    observacionesExternas: { type: String, default: "" },
    observacionesInternas: { type: String, default: "" },

    // ── Control de cierre ─────────────────────────────────────────────────────
    pendienteCierre: { type: Boolean, default: false },

    // ── Cajas: pagos / abonos ──────────────────────────────────────────────────
    // Cada pago lleva su propio comprobante (Nota de Venta, Remisión o Recibo
    // Provisional), con folio propio asignado al registrarlo.
    pagos: [
      {
        fecha:     { type: Date, default: Date.now },
        tipoPago:  { type: String, enum: ['COMPLETO', 'ABONO', 'ANTICIPO'], default: 'ABONO' },
        comprobante: { type: String, enum: ['NOTA_VENTA', 'REMISION', 'RECIBO_PROVISIONAL'], required: true },
        montoPesos:   { type: Number, default: 0 },
        montoDolares: { type: Number, default: 0 },
        tipoCambio:   { type: Number, default: 0 },
        // monto total ya convertido a MN = montoPesos + montoDolares*tipoCambio
        monto: { type: Number, default: 0 },
        referencia:    { type: String, default: '' },
        observaciones: { type: String, default: '' },
        notas:         { type: String, default: '' },
        registradoPor: { type: String, default: '' },

        cancelado:         { type: Boolean, default: false },
        canceladoEn:       { type: Date, default: null },
        canceladoPor:      { type: String, default: '' },
        motivoCancelacion: { type: String, default: '' },

        // numero sin default: un `null` explícito rompe el índice unique+sparse
        // de abajo, porque sparse solo excluye campos ausentes, no en null.
        notaVenta: {
          numero: { type: Number },
          banco:  { type: String, enum: BANCOS_CAJA },
          tipo:   { type: String, enum: TIPO_NOTA, default: 'Contado' },
        },
        remision: {
          numero: { type: Number },
          tipo:   { type: String, enum: TIPO_NOTA, default: 'Contado' },
          fechaPagada: { type: Date, default: null },
        },
        reciboProvisional: {
          numero:       { type: Number },
          formaPago:    { type: String, enum: ['EFECTIVO', 'CREDITO', 'DEBITO', 'CHEQUE'], default: 'EFECTIVO' },
          chequeNumero: { type: String, default: '' },
          concepto:     { type: String, default: '' },
          razon:        { type: String, default: '' },
          recibio:      { type: String, default: '' },
          autorizo:     { type: String, default: '' },
        },
        reciboDolares: {
          numero: { type: Number },
        },
      },
    ],

    // ── Cajas: Descuentos (globales a la orden o sobre una línea) ─────────────
    descuentos: [
      {
        tipo:        { type: String, enum: ['PORCENTAJE', 'MONTO'], default: 'MONTO' },
        valor:       { type: Number, default: 0 },
        motivo:      { type: String, default: '' },
        activo:      { type: Boolean, default: true },
        aplicadoPor: { type: String, default: '' },
        fecha:       { type: Date, default: null },
        // null = descuento global a toda la orden; si trae valor, referencia
        // el _id de la partida en ventaCliente sobre la que aplica.
        lineaId: { type: Schema.Types.ObjectId, default: null },
      },
    ],

    // ── Imágenes adjuntas a la orden (además de fotosVehiculo, capturado en
    //    la inspección inicial) ────────────────────────────────────────────────
    imagenes: [
      {
        filename:  { type: String, default: "" },
        url:       { type: String, default: "" },
        mimetype:  { type: String, default: "" },
        size:      { type: Number, default: 0 },
        fecha:     { type: Date, default: Date.now },
        subidoPor: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

vehiculoSchema.index({ 'garantia.estado': 1 });
vehiculoSchema.index({ 'pagos.notaVenta.numero': 1 }, { unique: true, sparse: true });
vehiculoSchema.index({ 'pagos.remision.numero': 1 }, { unique: true, sparse: true });
vehiculoSchema.index({ 'pagos.reciboProvisional.numero': 1 }, { unique: true, sparse: true });
vehiculoSchema.index({ 'pagos.reciboDolares.numero': 1 }, { unique: true, sparse: true });

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
module.exports.ESTADOS_ORDEN = ESTADOS_ORDEN;
module.exports.BANCOS_CAJA = BANCOS_CAJA;
module.exports.TIPO_NOTA = TIPO_NOTA;
