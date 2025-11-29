// backend/models/Vehiculo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// al inicio, antes del schema:
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
    // Referencia al cliente dueño del vehículo
    cliente: {
      type: Schema.Types.ObjectId,
      ref: 'Cliente', // usa el nombre real de tu modelo de clientes
      required: true,
    },

    // NUEVO: estado de la orden
    estadoOrden: {
      type: String,
      enum: ESTADOS_ORDEN,
      default: 'PENDIENTE_CAPTURA',
      index: true,
    },

    // ----- Datos de Orden / cabecera -----
    ordenServicio: String,
    fechaRecepcion: Date,
    horaRecepcion: String,

    // ----- Datos de cliente / gobierno (snapshot en la orden) -----
    nombreGobierno: String,
    nombreContactoGobierno: String,
    nombreDependencia: String,
    nombreContactoDependencia: String,

    telefonoFijoLada: String,
    telefonoFijo: String,
    celularLada: String,
    celular: String,

    direccion: String,
    numeroExt: String,
    numeroInt: String,
    colonia: String,
    rfc: String,
    codigoPostal: String,
    ciudad: String,
    estado: String,

    // ----- Datos de vehículo -----
    nombreUsuarioDejaVehiculo: String,
    marca: String,
    modelo: String,
    anio: String,
    color: String,
    serie: String,
    placas: String,
    kmsMillas: String,
    nacionalidad: String,
    motor: String,
    numeroEconomico: String,
    correo: String,
    traccion: String,

    // ----- Accesorios / checkboxes -----
    grua: String,
    espejoLateralIzq: Boolean,
    espejoLateralDer: Boolean,
    copasDelanterasIzq: Boolean,
    copasDelanterasDer: Boolean,
    parabrisas: String,
    focosDel: Boolean,
    focosTras: Boolean,
    espejoInt: Boolean,
    tapetesDelanterosIzq: Boolean,
    tapetesDelanterosDer: Boolean,
    estereo: Boolean,
    extra: Boolean,
    copasTraserasIzq: Boolean,
    copasTraserasDer: Boolean,
    micas: Boolean,
    antena: Boolean,
    encendedor: Boolean,
    tapetesTraserosIzq: Boolean,
    tapetesTraserosDer: Boolean,
    gato: Boolean,
    bateria: Boolean,

    // ----- Indicadores tablero / mecánicos -----
    checkEngine: String,
    abs: String,
    airBag: String,
    frenos: String,
    aceite: String,
    alternador: String,

    indicadoresTablero: String,
    otros: String,
    observaciones: String,

    // ===== Servicio o Reparación =====
    servicioReparacion: {
      alineacionComputadora: { type: Boolean, default: false },
      balanceoPorRueda: { type: Boolean, default: false },
      rotacion: { type: Boolean, default: false },

      instalacionAmortiguadorNormal: { type: Boolean, default: false },
      instalacionAmortiguadorEspecial: { type: Boolean, default: false },

      montajeLlantaAutocamioneta: { type: Boolean, default: false },
      limpiezaAjusteFrenosAutocamioneta: { type: Boolean, default: false },
      frenos2RuedasAutocamioneta: { type: Boolean, default: false },

      cambioBrazo: { type: Boolean, default: false },
      cambioTerminalDireccion: { type: Boolean, default: false },
      cambioRotula: { type: Boolean, default: false },

      infoLlantas: { type: String, default: "" },
      revisionFallas: { type: String, default: "" },
    },

    // indica si la orden ya fue “iniciada” desde Servicio/Reparación
    ordenIniciada: {
      type: Boolean,
      default: false,
    },

    // ===== Requisición y diagnóstico =====
    diagnosticoTecnico: { type: String, default: "" },

    refaccionesSolicitadas: [
      {
        cant: { type: Number, default: 0 },
        unidad: { type: String, default: "" },
        refaccion: { type: String, default: "" },
        tipo: { type: String, default: "" }, // ej. SERVICIO / REFACCIÓN
        marca: { type: String, default: "" },
        proveedor: { type: String, default: "" },
        codigo: { type: String, default: "" },
        precioUnitario: { type: Number, default: 0 },
        importeTotal: { type: Number, default: 0 },
        moneda: { type: String, default: "MN" },
        tiempoEntrega: { type: String, default: "" },
        core: { type: String, default: "" },
        observaciones: { type: String, default: "" },
        // si quieres manejar estatus luego, aquí se podría agregar:
        // estatus: { type: String, default: 'PENDIENTE' },
         estatus: {
      type: String,
      enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
      default: 'PENDIENTE',
    },
      
      },
    ],

    // ===== Cargos en orden =====
    cargosEnOrden: [
      {
        cant: { type: Number, default: 0 },
        unidad: { type: String, default: "" },
        concepto: { type: String, default: "" }, // “Refacción y/o Servicio”
        marca: { type: String, default: "" },
        proveedor: { type: String, default: "" },
        codigo: { type: String, default: "" },
        precioUnitario: { type: Number, default: 0 },
        importeTotal: { type: Number, default: 0 },
        moneda: { type: String, default: "MN" },
        observaciones: { type: String, default: "" },
        documento: { type: String, default: "" }, // p.ej. factura ligada
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model('Vehiculo', vehiculoSchema);
