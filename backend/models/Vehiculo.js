// backend/models/Vehiculo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const vehiculoSchema = new Schema(
  {
    // Referencia al cliente dueño del vehículo
    cliente: {
      type: Schema.Types.ObjectId,
      ref: 'Cliente', // usa el nombre real de tu modelo de clientes
      required: true,
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
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model('Vehiculo', vehiculoSchema);
