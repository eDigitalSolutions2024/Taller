// models/Cliente.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ---------- Subesquemas reutilizables ---------- */

const TelefonoSchema = new Schema(
  {
    lada: { type: String, trim: true },
    numero: { type: String, trim: true },
    extension: { type: String, trim: true },
  },
  { _id: false }
);

const DireccionSchema = new Schema(
  {
    calle: { type: String, trim: true },
    numeroExterior: { type: String, trim: true },
    numeroInterior: { type: String, trim: true },
    colonia: { type: String, trim: true },
    codigoPostal: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    estado: { type: String, trim: true },
  },
  { _id: false }
);

const ContactoSchema = new Schema(
  {
    nombre: { type: String, trim: true },
    correo: { type: String, trim: true, lowercase: true },
    telefonos: { type: [TelefonoSchema], default: [] },
    celulares: { type: [TelefonoSchema], default: [] },
    departamento: { type: String, trim: true },
    puesto: { type: String, trim: true },
  },
  { _id: false }
);

const EmpresaSchema = new Schema(
  {
    razonSocial: { type: String, trim: true },
    contacto: { type: ContactoSchema, default: undefined },
  },
  { _id: false }
);

const DependenciaSchema = new Schema(
  {
    nombre: { type: String, trim: true },
    contacto: { type: ContactoSchema, default: undefined },
  },
  { _id: false }
);

const GobiernoSchema = new Schema(
  {
    nombreGobierno: { type: String, trim: true },
    contactoGobierno: { type: ContactoSchema, default: undefined },
    dependencia: { type: DependenciaSchema, default: undefined },
  },
  { _id: false }
);

const FacturacionSchema = new Schema(
  {
    mismaQueDireccion: { type: Boolean, default: true },
    direccion: { type: DireccionSchema, default: undefined },
    regimenFiscal: { type: String, trim: true },
    usoCFDI: { type: String, trim: true },
  },
  { _id: false }
);

/* ---------- Esquema principal ---------- */

const TIPOS = [
  "Particular",
  "Empresa Privada",
  "Empresa Arrendadora",
  "Empresa Gobierno",
];

const ClienteSchema = new Schema(
  {
    tipoCliente: { type: String, enum: TIPOS, default: "Particular", index: true },

    nombre: { type: String, trim: true },
    apellidoPaterno: { type: String, trim: true },
    apellidoMaterno: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    telefono: { type: TelefonoSchema, default: undefined },
    celular: { type: TelefonoSchema, default: undefined },
    // Listas completas (el primer elemento espeja email/telefono/celular de
    // arriba, para no romper a quien todavía lee el campo singular).
    emails: { type: [String], default: undefined },
    telefonos: { type: [TelefonoSchema], default: undefined },
    celulares: { type: [TelefonoSchema], default: undefined },
    pais: { type: String, trim: true, default: "México" },
    // Controla si se piden/muestran RFC, régimen fiscal, etc. Por defecto
    // true en documentos ya existentes con RFC capturado (ver pre-validate).
    requiereFacturacion: { type: Boolean, default: false },

    // Fiscal/ubicación comunes
    rfc: { type: String, trim: true, uppercase: true },
    // Fiscal CFDI (lo mínimo para timbrar)
    regimenFiscal: {
      type: String,
      trim: true,
      enum: [
        "601","603","605","606","607","608","610","611",
        "612","614","615","616","620","621","622","623",
        "624","625","626"
      ]
    },
    codigoPostalFiscal: { type: String, trim: true, default: "" },
    direccion: { type: DireccionSchema, default: undefined },
    facturacion: { type: FacturacionSchema, default: () => ({ mismaQueDireccion: true }) },

    // Extra
    asesorResponsable: { type: String, trim: true },
    condicionesPago: { type: String, trim: true },
    observaciones: { type: String, trim: true },
    esEmpleado: { type: Boolean, default: false },

    // Ramas por tipo
    empresa: { type: EmpresaSchema, default: undefined },   // Privada / Arrendadora
    gobierno: { type: GobiernoSchema, default: undefined }, // Gobierno
  },
  { timestamps: true }
);

/* ---------- Índices para búsqueda de texto ---------- */
// Permite buscar por nombre/apellidos, email, RFC, razón social, gobierno y dependencia
ClienteSchema.index({
  nombre: "text",
  apellidoPaterno: "text",
  apellidoMaterno: "text",
  email: "text",
  rfc: "text",
  "empresa.razonSocial": "text",
  "gobierno.nombreGobierno": "text",
  "gobierno.dependencia.nombre": "text",
});

/* ---------- Normalización y validaciones ---------- */

// Asegura mayúsculas en RFC y minúsculas en email (por si llegan sin normalizar)
ClienteSchema.pre("save", function (next) {
  if (this.rfc) this.rfc = String(this.rfc).toUpperCase().trim();
  if (this.email) this.email = String(this.email).toLowerCase().trim();

  // El primer elemento de cada lista espeja el campo singular, para que
  // pantallas que todavía leen email/telefono/celular directo (p. ej. al
  // prellenar una orden nueva) sigan viendo el dato principal.
  if (this.emails?.length) this.email = this.emails[0] || this.email;
  if (this.telefonos?.length) this.telefono = this.telefonos[0] || this.telefono;
  if (this.celulares?.length) this.celular = this.celulares[0] || this.celular;

  // Si facturación “mismaQueDireccion” y no hay dirección copiada, duplica
  if (
    this.facturacion &&
    this.facturacion.mismaQueDireccion &&
    !this.facturacion.direccion &&
    this.direccion
  ) {
    this.facturacion.direccion = this.direccion;
  }
  next();
});

/* ---------- Validaciones por tipo ---------- */
ClienteSchema.pre("validate", function (next) {
  const t = this.tipoCliente;

  if (t === "Particular") {
    if (!this.nombre || !this.nombre.trim()) {
      this.invalidate("nombre", "El nombre es obligatorio para clientes particulares.");
    }
    this.empresa = undefined;
    this.gobierno = undefined;
  }

  if (t === "Empresa Gobierno") {
    if (!this.gobierno || !this.gobierno.nombreGobierno || !this.gobierno.nombreGobierno.trim()) {
      this.invalidate("gobierno.nombreGobierno", "El nombre del gobierno es obligatorio.");
    }
    this.empresa = undefined;
  }

  next();
});

/* ---------- Salida JSON limpia ---------- */
ClienteSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/* ---------- Export ---------- */
module.exports = mongoose.model("Cliente", ClienteSchema);
