// src/pages/Empleados.jsx
import React, { useCallback, useEffect, useState } from "react";
import {
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  cambiarEstadoEmpleado,
  vincularUsuario,
} from "../api/empleados";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  restablecerPasswordUsuario,
} from "../api/users";
import "../styles/Empleados.css";

const ROLES_SISTEMA = [
  { value: "admin", label: "Administrador" },
  { value: "staff", label: "Staff" },
  { value: "mecanico", label: "Mecánico" },
  { value: "recepcion", label: "Recepción" },
  { value: "contabilidad", label: "Contabilidad" },
  { value: "consulta", label: "Solo consulta" },
];

const PUESTOS = [
  { value: "mecanico", label: "Mecánico" },
  { value: "carrocero", label: "Carrocero" },
  { value: "ayudante", label: "Ayudante" },
  { value: "recepcion", label: "Recepción" },
  { value: "contabilidad", label: "Contabilidad" },
  { value: "jefe_taller", label: "Jefe de taller" },
  { value: "otro", label: "Otro" },
];

const roleLabel = (v) => ROLES_SISTEMA.find((r) => r.value === v)?.label ?? v ?? "—";
const puestoLabel = (v) => PUESTOS.find((p) => p.value === v)?.label ?? v ?? "—";

const emptyForm = {
  // Empleado
  nombre: "",
  puesto: "mecanico",
  telefono: "",
  correo: "",
  fechaAlta: "",
  notas: "",
  // Control
  tipo: "empleado", // 'empleado' | 'empleado_acceso' | 'solo_usuario'
  // Usuario
  email: "",
  password: "",
  newPassword: "",
  role: "consulta",
};

function Empleados() {
  const [personas, setPersonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | con_acceso | sin_acceso
  const [filtroActivo, setFiltroActivo] = useState("activos"); // todos | activos | inactivos

  const [editando, setEditando] = useState(null); // persona actual en edición, {} = nuevo
  const [form, setForm] = useState(emptyForm);
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const cargarPersonal = useCallback(async () => {
    try {
      setCargando(true);
      const [empList, userList] = await Promise.all([listarEmpleados({}), listarUsuarios()]);

      const lista = [];
      const userIdsEnEmpleados = new Set();

      // Empleados (con o sin usuario vinculado)
      for (const emp of empList) {
        const u = emp.usuario;
        if (u) userIdsEnEmpleados.add(String(u._id));
        lista.push({
          key: emp._id,
          empleadoId: emp._id,
          userId: u?._id || null,
          nombre: emp.nombre,
          puesto: emp.puesto,
          telefono: emp.telefono || "",
          correo: emp.correo || "",
          fechaAlta: emp.fechaAlta || null,
          notas: emp.notas || "",
          activo: emp.activo,
          tieneAcceso: !!u,
          userEmail: u?.email || null,
          role: u?.role || null,
        });
      }

      // Usuarios puros (sin empleado vinculado)
      for (const u of userList) {
        if (!u.employee && !userIdsEnEmpleados.has(String(u._id))) {
          lista.push({
            key: u._id,
            empleadoId: null,
            userId: u._id,
            nombre: u.name,
            puesto: null,
            telefono: "",
            correo: u.email || "",
            fechaAlta: null,
            notas: "",
            activo: u.isActive,
            tieneAcceso: true,
            userEmail: u.email,
            role: u.role,
          });
        }
      }

      setPersonas(lista);
    } catch (err) {
      console.error(err);
      setError("Error al cargar el personal");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarPersonal();
  }, [cargarPersonal]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(""), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function resetForm() {
    setEditando(null);
    setForm(emptyForm);
    setShowPwd(false);
    setShowNewPwd(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleEditar(persona) {
    setEditando(persona);
    const tipo = persona.tieneAcceso
      ? persona.empleadoId
        ? "empleado_acceso"
        : "solo_usuario"
      : "empleado";
    setForm({
      nombre: persona.nombre || "",
      puesto: persona.puesto || "mecanico",
      telefono: persona.telefono || "",
      correo: persona.correo || "",
      fechaAlta: persona.fechaAlta ? persona.fechaAlta.slice(0, 10) : "",
      notas: persona.notas || "",
      tipo,
      email: persona.userEmail || persona.correo || "",
      password: "",
      newPassword: "",
      role: persona.role || "consulta",
    });
    setShowPwd(false);
    setShowNewPwd(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const esEmpleado = form.tipo !== "solo_usuario";
    const tieneAccesoNueva = form.tipo !== "empleado";

    try {
      if (editando && editando.key) {
        // ─ Editar ─
        if (editando.empleadoId) {
          await actualizarEmpleado(editando.empleadoId, {
            nombre: form.nombre,
            puesto: form.puesto,
            telefono: form.telefono,
            correo: form.correo,
            fechaAlta: form.fechaAlta || undefined,
            notas: form.notas,
          });
        }

        if (editando.userId) {
          await actualizarUsuario(editando.userId, {
            name: form.nombre,
            email: form.email,
            role: form.role,
          });
          if (form.newPassword.trim()) {
            await restablecerPasswordUsuario(editando.userId, form.newPassword.trim());
          }
        } else if (tieneAccesoNueva && editando.empleadoId) {
          // Dar acceso al sistema a un empleado que no tenía
          const nuevoUser = await crearUsuario({
            name: form.nombre,
            email: form.email,
            password: form.password,
            role: form.role,
            empleadoId: editando.empleadoId,
          });
          await vincularUsuario(editando.empleadoId, nuevoUser._id);
        }

        setMensaje("Registro actualizado correctamente.");
      } else {
        // ─ Crear ─
        let empleadoId = null;

        if (esEmpleado) {
          const emp = await crearEmpleado({
            nombre: form.nombre,
            puesto: form.puesto,
            telefono: form.telefono,
            correo: form.correo,
            fechaAlta: form.fechaAlta || undefined,
            notas: form.notas,
          });
          empleadoId = emp._id;
        }

        if (tieneAccesoNueva) {
          const nuevoUser = await crearUsuario({
            name: form.nombre,
            email: form.email,
            password: form.password,
            role: form.role,
            empleadoId,
          });
          if (empleadoId) {
            await vincularUsuario(empleadoId, nuevoUser._id);
          }
        }

        setMensaje("Registro creado correctamente.");
      }

      resetForm();
      await cargarPersonal();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.msg || err?.response?.data?.mensaje || "Error al guardar.");
    }
  }

  async function toggleActivo(persona) {
    try {
      const nuevoEstado = !persona.activo;
      if (persona.empleadoId) {
        await cambiarEstadoEmpleado(persona.empleadoId, nuevoEstado);
      }
      if (persona.userId) {
        await actualizarUsuario(persona.userId, { isActive: nuevoEstado });
      }
      setMensaje(nuevoEstado ? "Activado correctamente." : "Desactivado correctamente.");
      await cargarPersonal();
    } catch (err) {
      console.error(err);
      setError("No se pudo cambiar el estado.");
    }
  }

  const listaFiltrada = personas.filter((p) => {
    if (filtro === "con_acceso" && !p.tieneAcceso) return false;
    if (filtro === "sin_acceso" && p.tieneAcceso) return false;
    if (filtroActivo === "activos" && !p.activo) return false;
    if (filtroActivo === "inactivos" && p.activo) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.nombre?.toLowerCase().includes(q) ||
      p.correo?.toLowerCase().includes(q) ||
      p.userEmail?.toLowerCase().includes(q) ||
      p.puesto?.toLowerCase().includes(q) ||
      p.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container-fluid empleados-page mt-3">
      <div className="empleados-header mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h1 className="empleados-title">Personal del Taller</h1>
        {editando === null && (
          <button
            className="btn btn-taller-primary"
            onClick={() => {
              setEditando({});
              setForm(emptyForm);
            }}
          >
            + Nuevo
          </button>
        )}
      </div>

      {mensaje && <div className="alert alert-success py-2 mb-3 empleados-alert">{mensaje}</div>}
      {error && <div className="alert alert-danger py-2 mb-3 empleados-alert">{error}</div>}

      {/* CARD FORM */}
      {editando !== null && (
        <div className="card card-taller mb-3">
          <div className="card-header card-taller-header">
            <h2 className="card-title mb-0">{editando.key ? "Editar registro" : "Nuevo registro"}</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="empleados-form">
              {/* Tipo */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Tipo</label>
                <div className="d-flex gap-3 flex-wrap">
                  {[
                    { val: "empleado", label: "Solo empleado (sin acceso al sistema)" },
                    { val: "empleado_acceso", label: "Empleado con acceso al sistema" },
                    { val: "solo_usuario", label: "Solo usuario del sistema" },
                  ].map((opt) => (
                    <div key={opt.val} className="form-check">
                      <input
                        type="radio"
                        className="form-check-input"
                        id={`tipo_${opt.val}`}
                        name="tipo"
                        value={opt.val}
                        checked={form.tipo === opt.val}
                        onChange={handleChange}
                        disabled={!!editando.key}
                      />
                      <label className="form-check-label" htmlFor={`tipo_${opt.val}`}>
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="row g-3">
                {/* Campos de empleado */}
                {form.tipo !== "solo_usuario" && (
                  <>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">
                        Nombre completo <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        className="form-control"
                        value={form.nombre}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Puesto</label>
                      <select name="puesto" className="form-select" value={form.puesto} onChange={handleChange}>
                        {PUESTOS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Teléfono</label>
                      <input
                        type="text"
                        name="telefono"
                        className="form-control"
                        value={form.telefono}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-semibold">Fecha de alta</label>
                      <input
                        type="date"
                        name="fechaAlta"
                        className="form-control"
                        value={form.fechaAlta}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Correo de contacto</label>
                      <input
                        type="email"
                        name="correo"
                        className="form-control"
                        value={form.correo}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Notas</label>
                      <textarea
                        name="notas"
                        rows={2}
                        className="form-control"
                        value={form.notas}
                        onChange={handleChange}
                        placeholder="Comentarios, habilidades, turno, etc."
                      />
                    </div>
                  </>
                )}

                {/* Campos de usuario del sistema */}
                {form.tipo !== "empleado" && (
                  <>
                    {form.tipo === "solo_usuario" && (
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Nombre completo <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          name="nombre"
                          className="form-control"
                          value={form.nombre}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    )}
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Correo del sistema <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        value={form.email}
                        onChange={handleChange}
                        required={form.tipo !== "empleado"}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Rol</label>
                      <select name="role" className="form-select" value={form.role} onChange={handleChange}>
                        {ROLES_SISTEMA.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contraseña — al crear O al dar acceso nuevo */}
                    {(!editando.key || (editando.key && !editando.userId)) && (
                      <div className="col-md-3">
                        <label className="form-label fw-semibold">
                          Contraseña <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                          <input
                            type={showPwd ? "text" : "password"}
                            name="password"
                            className="form-control"
                            value={form.password}
                            onChange={handleChange}
                            required
                            minLength={6}
                            placeholder="Mínimo 6 caracteres"
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowPwd((v) => !v)}
                          >
                            {showPwd ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Nueva contraseña — al editar usuario existente */}
                    {editando.key && editando.userId && (
                      <div className="col-md-3">
                        <label className="form-label fw-semibold">Nueva contraseña</label>
                        <div className="input-group">
                          <input
                            type={showNewPwd ? "text" : "password"}
                            name="newPassword"
                            className="form-control"
                            placeholder="Dejar vacío para no cambiar"
                            value={form.newPassword}
                            onChange={handleChange}
                            minLength={6}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowNewPwd((v) => !v)}
                          >
                            {showNewPwd ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="d-flex gap-2 mt-4">
                <button type="submit" className="btn btn-taller-primary">
                  {editando.key ? "Guardar cambios" : "Crear registro"}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUSCADOR + FILTROS + TABLA */}
      <div className="card card-taller">
        <div className="card-body">
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-4">
              <input
                type="search"
                className="form-control"
                placeholder="Buscar por nombre, correo, puesto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <select
                className="form-select form-select-sm"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="con_acceso">Con acceso al sistema</option>
                <option value="sin_acceso">Sin acceso al sistema</option>
              </select>
            </div>
            <div className="col-auto">
              <select
                className="form-select form-select-sm"
                value={filtroActivo}
                onChange={(e) => setFiltroActivo(e.target.value)}
              >
                <option value="activos">Solo activos</option>
                <option value="inactivos">Solo inactivos</option>
                <option value="todos">Todos los estados</option>
              </select>
            </div>
            <div className="col-auto ms-auto text-muted small">
              {listaFiltrada.length} registro{listaFiltrada.length !== 1 ? "s" : ""}
              {cargando && " · Cargando…"}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle empleados-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Puesto</th>
                  <th>Contacto</th>
                  <th>Acceso al sistema</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.length === 0 && !cargando && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-3">
                      No hay registros que coincidan.
                    </td>
                  </tr>
                )}

                {listaFiltrada.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <div className="fw-semibold">{p.nombre}</div>
                      {p.tieneAcceso && p.userEmail && p.userEmail !== p.correo && (
                        <div className="text-muted small">{p.userEmail}</div>
                      )}
                    </td>
                    <td>{p.puesto ? puestoLabel(p.puesto) : <span className="text-muted">—</span>}</td>
                    <td>
                      {p.correo && <div className="small">{p.correo}</div>}
                      {p.telefono && <div className="small text-muted">{p.telefono}</div>}
                    </td>
                    <td>
                      {p.tieneAcceso ? (
                        <span className="badge bg-info-subtle text-info-emphasis">
                          🛡️ {roleLabel(p.role)}
                        </span>
                      ) : (
                        <span className="text-muted small">Sin acceso</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${p.activo ? "bg-success" : "bg-secondary"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="d-flex gap-1 flex-wrap justify-content-center">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => handleEditar(p)}>
                          Editar
                        </button>
                        <button
                          className={`btn btn-sm ${p.activo ? "btn-outline-danger" : "btn-outline-success"}`}
                          onClick={() => toggleActivo(p)}
                        >
                          {p.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Empleados;
