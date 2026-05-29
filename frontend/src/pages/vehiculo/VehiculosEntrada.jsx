// src/pages/vehiculo/VehiculoEntrada.jsx
import React, { useState, useEffect, useRef } from "react";
import { getClientes, createCustomer } from "../../api/customers";
import { listarEmpleados } from "../../api/empleados";
import VehiculoNuevoForm from "./VehiculoNuevoForm";
import { listVehiculosByCliente } from "../../api/vehiculos";
import { useNavigate } from "react-router-dom";

// ─── Helpers (igual que AltaCliente) ────────────────────────────────────────
const deepClone = (o) => JSON.parse(JSON.stringify(o));

function setIn(obj, path, value) {
  const keys = path.split(".");
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] =
      next && typeof next === "object"
        ? Array.isArray(next) ? [...next] : { ...next }
        : {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}

const CLIENT_TYPES = [
  "Particular",
  "Empresa Privada",
  "Empresa Arrendadora",
  "Empresa Gobierno",
];

const initialCliente = {
  tipoCliente: "Particular",
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  email: "",
  telefono: { lada: "", numero: "", extension: "" },
  celular: { lada: "", numero: "" },
  rfc: "",
  regimenFiscal: "",
  codigoPostalFiscal: "",
  direccion: {
    calle: "", numeroExterior: "", numeroInterior: "",
    colonia: "", codigoPostal: "", ciudad: "", estado: "",
  },
  facturacion: {
    direccion: {
      calle: "", numeroExterior: "", numeroInterior: "",
      colonia: "", codigoPostal: "", ciudad: "", estado: "",
    },
  },
  asesorResponsable: "",
  condicionesPago: "",
  observaciones: "",
  empresa: {
    contacto: {
      nombre: "", correo: "",
      telefono: { lada: "", numero: "", extension: "" },
      celular: { lada: "", numero: "" },
      departamento: "", puesto: "",
    },
  },
  gobierno: {
    nombreGobierno: "",
    contactoGobierno: {
      nombre: "", correo: "",
      telefono: { lada: "", numero: "", extension: "" },
      celular: { lada: "", numero: "" },
      departamento: "", puesto: "",
    },
    dependencia: {
      nombre: "",
      contacto: {
        nombre: "", correo: "",
        telefono: { lada: "", numero: "", extension: "" },
        celular: { lada: "", numero: "" },
        departamento: "", puesto: "",
      },
    },
  },
};

// ─── Modal: Alta de Cliente ──────────────────────────────────────────────────
function ModalNuevoCliente({ onClose, onClienteCreado }) {
  const [form, setForm] = useState(initialCliente);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [empleados, setEmpleados] = useState([]);

  const upd = (path, v) => setForm((prev) => setIn(prev, path, v));



  // Cambio de tipo de cliente (igual que AltaCliente)
  const onTipoChange = (e) => {
    const tipo = e.target.value;
    setForm((prev) => {
      const next = { ...prev, tipoCliente: tipo };
      if (tipo === "Particular") { delete next.empresa; delete next.gobierno; }
      if (tipo === "Empresa Privada" || tipo === "Empresa Arrendadora") {
        next.empresa = next.empresa || deepClone(initialCliente.empresa);
        delete next.gobierno;
      }
      if (tipo === "Empresa Gobierno") {
        next.gobierno = next.gobierno || deepClone(initialCliente.gobierno);
        delete next.empresa;
      }
      return next;
    });
  };

  // Cargar empleados para el combo de Asesor
  useEffect(() => {
    listarEmpleados({ activo: true })
      .then((data) => setEmpleados(Array.isArray(data) ? data : []))
      .catch(() => setEmpleados([]));
  }, []);

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setMsg("❌ El nombre del cliente es obligatorio."); return; }

    setSaving(true);
    setMsg("");
    try {
      let payload = deepClone(form);

      // Mismo procesamiento que AltaCliente.onSubmit
      if (!payload.codigoPostalFiscal && payload.facturacion?.direccion?.codigoPostal) {
        payload.codigoPostalFiscal = payload.facturacion.direccion.codigoPostal;
      }
      if (payload.facturacion?.direccion) {
        payload.direccion = deepClone(payload.facturacion.direccion);
      }
      delete payload.facturacion;

      if (payload.tipoCliente === "Particular") { delete payload.empresa; delete payload.gobierno; }
      if (payload.tipoCliente === "Empresa Privada" || payload.tipoCliente === "Empresa Arrendadora") delete payload.gobierno;
      if (payload.tipoCliente === "Empresa Gobierno") delete payload.empresa;

      const res = await createCustomer(payload);
      onClienteCreado(res.data.data);   // agrega a la lista y cierra
    } catch (err) {
      setMsg("❌ " + (err?.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1050,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto", padding: "24px 12px",
      }}
    >
      <div
        className="card shadow-lg"
        style={{ width: "100%", maxWidth: "780px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="card-header d-flex justify-content-between align-items-center"
          style={{ background: "#c0392b", color: "#fff" }}
        >
          <h5 className="mb-0 fw-bold">Alta de Clientes</h5>
          <button type="button" className="btn-close btn-close-white" onClick={onClose} />
        </div>

        {/* Body */}
        <form className="card-body" onSubmit={handleGuardar}>
          {msg && <div className="alert alert-danger py-2 mb-3">{msg}</div>}

          {/* Tipo de Cliente */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Tipo de Cliente</label>
            <select className="form-select" value={form.tipoCliente} onChange={onTipoChange}>
              {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* ── PARTICULAR ── */}
          {form.tipoCliente === "Particular" && (
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Nombre *</label>
                <input className="form-control" value={form.nombre} onChange={(e) => upd("nombre", e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Apellido Paterno</label>
                <input className="form-control" value={form.apellidoPaterno} onChange={(e) => upd("apellidoPaterno", e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Apellido Materno</label>
                <input className="form-control" value={form.apellidoMaterno} onChange={(e) => upd("apellidoMaterno", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Correo Electrónico</label>
                <input type="email" className="form-control" value={form.email} onChange={(e) => upd("email", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Teléfono Fijo</label>
                <div className="input-group">
                  <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.telefono.lada} onChange={(e) => upd("telefono.lada", e.target.value)} />
                  <input className="form-control" placeholder="Número" value={form.telefono.numero} onChange={(e) => upd("telefono.numero", e.target.value)} />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Celular</label>
                <div className="input-group">
                  <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.celular.lada} onChange={(e) => upd("celular.lada", e.target.value)} />
                  <input className="form-control" placeholder="Número" value={form.celular.numero} onChange={(e) => upd("celular.numero", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── EMPRESA PRIVADA ── */}
          {form.tipoCliente === "Empresa Privada" && (
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nombre Empresa *</label>
                <input className="form-control" value={form.nombre} onChange={(e) => upd("nombre", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nombre Contacto Empresa</label>
                <input className="form-control" value={form.apellidoPaterno} onChange={(e) => upd("apellidoPaterno", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Correo Electrónico</label>
                <input type="email" className="form-control" value={form.email} onChange={(e) => upd("email", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Teléfono Fijo</label>
                <div className="input-group">
                  <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.telefono.lada} onChange={(e) => upd("telefono.lada", e.target.value)} />
                  <input className="form-control" placeholder="Número" value={form.telefono.numero} onChange={(e) => upd("telefono.numero", e.target.value)} />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Celular</label>
                <div className="input-group">
                  <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.celular.lada} onChange={(e) => upd("celular.lada", e.target.value)} />
                  <input className="form-control" placeholder="Número" value={form.celular.numero} onChange={(e) => upd("celular.numero", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── EMPRESA ARRENDADORA ── */}
          {form.tipoCliente === "Empresa Arrendadora" && (
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nombre Arrendadora *</label>
                <input className="form-control" value={form.nombre} onChange={(e) => upd("nombre", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nombre Contacto Arrendadora</label>
                <input className="form-control" value={form.apellidoPaterno} onChange={(e) => upd("apellidoPaterno", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Correo Electrónico</label>
                <input type="email" className="form-control" value={form.email} onChange={(e) => upd("email", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Teléfono Fijo</label>
                <div className="input-group">
                  <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.telefono.lada} onChange={(e) => upd("telefono.lada", e.target.value)} />
                  <input className="form-control" placeholder="Número" value={form.telefono.numero} onChange={(e) => upd("telefono.numero", e.target.value)} />
                  <input className="form-control" style={{maxWidth:100}} placeholder="Ext." value={form.empresa?.contacto?.telefono?.extension ?? ""} onChange={(e) => upd("empresa.contacto.telefono.extension", e.target.value)} />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Celular</label>
                <div className="input-group">
                  <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.celular.lada} onChange={(e) => upd("celular.lada", e.target.value)} />
                  <input className="form-control" placeholder="Número" value={form.celular.numero} onChange={(e) => upd("celular.numero", e.target.value)} />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Departamento</label>
                <input className="form-control" value={form.empresa?.contacto?.departamento ?? ""} onChange={(e) => upd("empresa.contacto.departamento", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Puesto</label>
                <input className="form-control" value={form.empresa?.contacto?.puesto ?? ""} onChange={(e) => upd("empresa.contacto.puesto", e.target.value)} />
              </div>
            </div>
          )}

          {/* ── GOBIERNO ── */}
          {form.tipoCliente === "Empresa Gobierno" && (
            <>
              <h6 className="fw-bold border-bottom pb-1 mb-3">Gobierno</h6>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Nombre Gobierno *</label>
                  <input className="form-control" value={form.gobierno?.nombreGobierno ?? ""} onChange={(e) => upd("gobierno.nombreGobierno", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Contacto Gobierno (Nombre)</label>
                  <input className="form-control" value={form.gobierno?.contactoGobierno?.nombre ?? ""} onChange={(e) => upd("gobierno.contactoGobierno.nombre", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Correo Electrónico</label>
                  <input type="email" className="form-control" value={form.email} onChange={(e) => upd("email", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Celular</label>
                  <div className="input-group">
                    <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.celular.lada} onChange={(e) => upd("celular.lada", e.target.value)} />
                    <input className="form-control" placeholder="Número" value={form.celular.numero} onChange={(e) => upd("celular.numero", e.target.value)} />
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Teléfono Gobierno</label>
                  <div className="input-group">
                    <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.gobierno?.contactoGobierno?.telefono?.lada ?? ""} onChange={(e) => upd("gobierno.contactoGobierno.telefono.lada", e.target.value)} />
                    <input className="form-control" placeholder="Número" value={form.gobierno?.contactoGobierno?.telefono?.numero ?? ""} onChange={(e) => upd("gobierno.contactoGobierno.telefono.numero", e.target.value)} />
                    <input className="form-control" style={{maxWidth:100}} placeholder="Ext." value={form.gobierno?.contactoGobierno?.telefono?.extension ?? ""} onChange={(e) => upd("gobierno.contactoGobierno.telefono.extension", e.target.value)} />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Departamento</label>
                  <input className="form-control" value={form.gobierno?.contactoGobierno?.departamento ?? ""} onChange={(e) => upd("gobierno.contactoGobierno.departamento", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Puesto</label>
                  <input className="form-control" value={form.gobierno?.contactoGobierno?.puesto ?? ""} onChange={(e) => upd("gobierno.contactoGobierno.puesto", e.target.value)} />
                </div>
              </div>

              <h6 className="fw-bold border-bottom pb-1 mb-3">Dependencia</h6>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Nombre Dependencia</label>
                  <input className="form-control" value={form.gobierno?.dependencia?.nombre ?? ""} onChange={(e) => upd("gobierno.dependencia.nombre", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Contacto Dependencia (Nombre)</label>
                  <input className="form-control" value={form.gobierno?.dependencia?.contacto?.nombre ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.nombre", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Correo Electrónico</label>
                  <input type="email" className="form-control" value={form.gobierno?.dependencia?.contacto?.correo ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.correo", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Teléfono Dependencia</label>
                  <div className="input-group">
                    <input className="form-control" style={{maxWidth:80}} placeholder="LADA" value={form.gobierno?.dependencia?.contacto?.telefono?.lada ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.telefono.lada", e.target.value)} />
                    <input className="form-control" placeholder="Número" value={form.gobierno?.dependencia?.contacto?.telefono?.numero ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.telefono.numero", e.target.value)} />
                    <input className="form-control" style={{maxWidth:100}} placeholder="Ext." value={form.gobierno?.dependencia?.contacto?.telefono?.extension ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.telefono.extension", e.target.value)} />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Departamento</label>
                  <input className="form-control" value={form.gobierno?.dependencia?.contacto?.departamento ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.departamento", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Puesto</label>
                  <input className="form-control" value={form.gobierno?.dependencia?.contacto?.puesto ?? ""} onChange={(e) => upd("gobierno.dependencia.contacto.puesto", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── DATOS DE FACTURACIÓN (todos los tipos) ── */}
          <h6 className="fw-bold border-bottom pb-1 mb-3 mt-2">Datos de Facturación</h6>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">RFC</label>
              <input className="form-control" value={form.rfc} onChange={(e) => upd("rfc", e.target.value.toUpperCase())} />
            </div>
            <div className="col-md-8">
              <label className="form-label fw-semibold">Régimen Fiscal</label>
              <select className="form-select" value={form.regimenFiscal} onChange={(e) => upd("regimenFiscal", e.target.value)}>
                <option value="">-- Seleccionar --</option>
                <option value="601">601 - General de Ley Personas Morales</option>
                <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                <option value="605">605 - Sueldos y Salarios e Ingresos Asimilados</option>
                <option value="606">606 - Arrendamiento</option>
                <option value="608">608 - Demás ingresos</option>
                <option value="612">612 - Personas Físicas con Actividades Empresariales</option>
                <option value="616">616 - Sin obligaciones fiscales</option>
                <option value="621">621 - Incorporación Fiscal</option>
                <option value="626">626 - Régimen Simplificado de Confianza</option>
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label fw-semibold">Dirección (Calle)</label>
              <input className="form-control" value={form.facturacion?.direccion?.calle ?? ""} onChange={(e) => upd("facturacion.direccion.calle", e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">Núm. Ext.</label>
              <input className="form-control" value={form.facturacion?.direccion?.numeroExterior ?? ""} onChange={(e) => upd("facturacion.direccion.numeroExterior", e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">Núm. Int.</label>
              <input className="form-control" value={form.facturacion?.direccion?.numeroInterior ?? ""} onChange={(e) => upd("facturacion.direccion.numeroInterior", e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Colonia</label>
              <input className="form-control" value={form.facturacion?.direccion?.colonia ?? ""} onChange={(e) => upd("facturacion.direccion.colonia", e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Código Postal Fiscal</label>
              <input className="form-control" value={form.codigoPostalFiscal} onChange={(e) => upd("codigoPostalFiscal", e.target.value)} />
            </div>
            <div className="col-md-5">
              <label className="form-label fw-semibold">Ciudad</label>
              <input className="form-control" value={form.facturacion?.direccion?.ciudad ?? ""} onChange={(e) => upd("facturacion.direccion.ciudad", e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Estado</label>
              <input className="form-control" value={form.facturacion?.direccion?.estado ?? ""} onChange={(e) => upd("facturacion.direccion.estado", e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Asesor Responsable</label>
              <select className="form-select" value={form.asesorResponsable} onChange={(e) => upd("asesorResponsable", e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {empleados.map((emp) => (
                  <option key={emp._id} value={emp.nombre}>
                    {emp.nombre}{emp.puesto ? ` (${emp.puesto})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Condiciones de Pago</label>
              <select className="form-select" value={form.condicionesPago} onChange={(e) => upd("condicionesPago", e.target.value)}>
                <option value="">-- Seleccionar --</option>
                <option value="Contado">Contado</option>
                <option value="Credito">Crédito</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Observaciones</label>
              <textarea className="form-control" rows={3} value={form.observaciones} onChange={(e) => upd("observaciones", e.target.value)} />
            </div>
          </div>

          {/* Footer botones */}
          <div className="d-flex gap-2 pt-2 border-top">
            <button type="submit" className="btn btn-danger" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => { setForm(initialCliente); setMsg(""); }}>
              Limpiar
            </button>
            <button type="button" className="btn btn-link text-secondary" onClick={onClose}>
              Regresar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function VehiculoEntrada() {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [mostrarAcciones, setMostrarAcciones] = useState(false);
  const [mostrarFormNuevoCarro, setMostrarFormNuevoCarro] = useState(false);

  const [vehiculosCliente, setVehiculosCliente] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(false);
  const [errorVehiculos, setErrorVehiculos] = useState("");

  const [mostrarModalNuevoCliente, setMostrarModalNuevoCliente] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const cargarClientes = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getClientes();
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setClientes(data);
        setFiltrados(data);
      } catch (err) {
        console.error("Error al obtener clientes:", err);
        setError("No se pudieron cargar los clientes.");
      } finally {
        setLoading(false);
      }
    };
    cargarClientes();
  }, []);

  useEffect(() => {
    const term = q.toLowerCase();
    if (!term) { setFiltrados(clientes); return; }
    setFiltrados(clientes.filter((c) =>
      (c.nombre || c.nombre_cliente || "").toLowerCase().includes(term)
    ));
  }, [q, clientes]);

  const handleSeleccion = (cliente) => {
    setClienteSeleccionado(cliente);
    setMostrarAcciones(false);
    setMostrarFormNuevoCarro(false);
    setVehiculosCliente([]);
    setErrorVehiculos("");
    const nombre =
      cliente.nombre ||
      cliente.nombre_cliente ||
      `${cliente.nombre_cliente} ${cliente.apellidos || ""}`.trim();
    setQ(nombre);
  };

  const cargarVehiculosCliente = async (clienteId) => {
    try {
      setLoadingVehiculos(true);
      setErrorVehiculos("");
      const res = await listVehiculosByCliente(clienteId);
      setVehiculosCliente(res.data.data || []);
    } catch (err) {
      console.error("Error cargando vehículos:", err);
      setErrorVehiculos("No se pudieron cargar los vehículos del cliente.");
      setVehiculosCliente([]);
    } finally {
      setLoadingVehiculos(false);
    }
  };

  const handleBuscar = () => {
    if (!clienteSeleccionado) { alert("Primero selecciona un cliente de la lista."); return; }
    setMostrarAcciones(true);
    setMostrarFormNuevoCarro(false);
    cargarVehiculosCliente(clienteSeleccionado._id);
  };

  const handleClienteCreado = (nuevoCliente) => {
    setClientes((prev) => [...prev, nuevoCliente]);
    setMostrarModalNuevoCliente(false);
  };

  return (
    <div className="container-fluid">
      <h2 className="text-center fw-bold my-3" style={{ letterSpacing: "2px" }}>
        NUEVA ORDEN DE SERVICIO
      </h2>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="row g-2 align-items-center">

            <div className="col-12 col-md-3">
              <label className="fw-semibold mb-0">Nombre Cliente:</label>
            </div>

            <div className="col-12 col-md-6">
              <div className="input-group">
                {/* Botón + */}
                <button
                  type="button"
                  className="btn btn-danger"
                  title="Registrar nuevo cliente"
                  onClick={() => setMostrarModalNuevoCliente(true)}
                  style={{ fontWeight: "bold", fontSize: "1.1rem", lineHeight: 1 }}
                >
                  +
                </button>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar un Nombre..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setClienteSeleccionado(null);
                    setMostrarAcciones(false);
                    setMostrarFormNuevoCarro(false);
                    setVehiculosCliente([]);
                  }}
                />
              </div>
            </div>

            <div className="col-12 col-md-3 d-grid">
              <button type="button" className="btn btn-primary" onClick={handleBuscar}>
                Buscar
              </button>
            </div>
          </div>

          {loading && <p className="text-muted mt-2 mb-0">Cargando clientes...</p>}
          {error   && <p className="text-danger mt-2 mb-0">{error}</p>}

          {!loading && filtrados.length > 0 && (
            <div className="mt-3">
              <ul className="list-group" style={{ maxHeight: "260px", overflowY: "auto" }}>
                {filtrados.map((c) => {
                  const nombre =
                    c.nombre ||
                    c.nombre_cliente ||
                    `${c.nombre_cliente} ${c.apellidos || ""}`.trim();
                  const isActive =
                    clienteSeleccionado &&
                    (clienteSeleccionado._id === c._id || clienteSeleccionado.id === c.id);
                  return (
                    <li
                      key={c._id || c.id}
                      className={"list-group-item list-group-item-action" + (isActive ? " active" : "")}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSeleccion(c)}
                    >
                      {nombre}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!loading && !error && filtrados.length === 0 && (
            <p className="text-muted mt-3 mb-0">No se encontraron clientes con ese nombre.</p>
          )}

          {mostrarAcciones && clienteSeleccionado && (
            <div className="mt-3">
              <div className="mb-2">
                {loadingVehiculos && <p className="text-muted mb-1">Cargando vehículos...</p>}
                {errorVehiculos   && <p className="text-danger mb-1">{errorVehiculos}</p>}

                {!loadingVehiculos && !errorVehiculos && vehiculosCliente.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {vehiculosCliente.map((v) => {
                      const label = `${v.marca || ""} ${v.modelo || ""} - ${v.anio || ""} - ${v.color || ""}`.trim();
                      return (
                        <button
                          key={v._id}
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => navigate(`/vehiculo/orden/${v._id}`)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!loadingVehiculos && !errorVehiculos && vehiculosCliente.length === 0 && (
                  <p className="text-muted mb-2">Este cliente aún no tiene vehículos registrados.</p>
                )}
              </div>

              <p className="mb-2">
                <strong>Cliente Seleccionado: </strong>
                {clienteSeleccionado.nombre || clienteSeleccionado.nombre_cliente}
              </p>

              <button type="button" className="btn btn-primary me-2" onClick={() => setMostrarFormNuevoCarro(true)}>
                Nuevo Carro
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => console.log("Sin carro:", clienteSeleccionado)}>
                Sin Carro
              </button>
            </div>
          )}
        </div>
      </div>

      {mostrarFormNuevoCarro && clienteSeleccionado && (
        <VehiculoNuevoForm
          cliente={clienteSeleccionado}
          onCreated={(vehiculo) => {
            const id = vehiculo?._id || vehiculo?.id;
            if (id) navigate(`/vehiculo/orden/${id}`);
          }}
        />
      )}

      <small className="text-muted d-block mt-2">
        * Primero selecciona un cliente de la lista y luego da clic en "Buscar"
        para continuar con el registro del vehículo o de la orden sin carro.
      </small>

      {/* Modal */}
      {mostrarModalNuevoCliente && (
        <ModalNuevoCliente
          onClose={() => setMostrarModalNuevoCliente(false)}
          onClienteCreado={handleClienteCreado}
        />
      )}
    </div>
  );
}