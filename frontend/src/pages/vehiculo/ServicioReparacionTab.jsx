// src/pages/vehiculo/ServicioReparacionTab.jsx
import React, { useEffect, useState } from "react";
import { updateServicioReparacion, saveRequisicionDiagnostico } from "../../api/vehiculos";
import { fetchServiciosTaller } from "../../api/codigos";

const emptyServicio = {
  serviciosSeleccionados: [],
  fallasReportadasCliente: "",   // ✅ Agregado
  infoLlantas: "",
  revisionFallas: "",
};

export default function ServicioReparacionTab({
  ordenId,
  initialData,
  onSaved,
  yaCerrada
}) {
  const [form, setForm] = useState(emptyServicio);
  const [saving, setSaving] = useState(false);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(false);

  // ✅ Estado del modal de refacciones
  const [showModal, setShowModal] = useState(false);
  const [refacciones, setRefacciones] = useState([{ refaccion: "", cantidad: 1 }]);
  const [guardandoRefacciones, setGuardandoRefacciones] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        serviciosSeleccionados: initialData.serviciosSeleccionados || [],
        fallasReportadasCliente: initialData.fallasReportadasCliente || "",  // ✅ Agregado
        infoLlantas: initialData.infoLlantas || "",
        revisionFallas: initialData.revisionFallas || "",
      });
    }
  }, [initialData]);

  useEffect(() => {
    const cargarServicios = async () => {
      try {
        setCargandoServicios(true);
        const servicios = await fetchServiciosTaller();
        setCatalogoServicios(servicios);
      } catch (err) {
        console.error("Error cargando servicios:", err);
        setCatalogoServicios([]);
      } finally {
        setCargandoServicios(false);
      }
    };
    cargarServicios();
  }, []);

  const handleChangeText = (e) => {
    if (yaCerrada) return;
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleServicio = (codigoServicio) => {
    if (yaCerrada) return;
    setForm((prev) => {
      const yaEsta = prev.serviciosSeleccionados.includes(codigoServicio);
      return {
        ...prev,
        serviciosSeleccionados: yaEsta
          ? prev.serviciosSeleccionados.filter((c) => c !== codigoServicio)
          : [...prev.serviciosSeleccionados, codigoServicio],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ordenId || yaCerrada) return;

    try {
      setSaving(true);
      const manoObraGenerada = form.serviciosSeleccionados.map((codigo) => {
        const srv = catalogoServicios.find((s) => s.codigo === codigo);
        return {
          concepto: srv ? (srv.descripcion || srv.label) : `Servicio ${codigo}`
        };
      });

      const payload = { ...form, manoObraGenerada };
      const res = await updateServicioReparacion(ordenId, payload);
      alert("Orden iniciada. Los servicios se enviaron al presupuesto.");
      if (onSaved) onSaved(res.data.vehiculo);
    } catch (err) {
      console.error(err);
      alert("Error al guardar el diagnóstico");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Handlers del modal de refacciones
  const agregarRefaccion = () =>
    setRefacciones((prev) => [...prev, { refaccion: "", cantidad: 1 }]);

  const eliminarRefaccion = (idx) =>
    setRefacciones((prev) => prev.filter((_, i) => i !== idx));

  const cambiarRefaccion = (idx, field, value) =>
    setRefacciones((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, [field]: field === "cantidad" ? Number(value || 0) : value }
          : item
      )
    );

  const handleEnviarRefacciones = async () => {
    if (!ordenId) return;

    const validas = refacciones
      .filter((r) => r.refaccion.trim() && Number(r.cantidad) > 0)
      .map((r) => ({
        refaccion: r.refaccion.trim(),
        cant: Number(r.cantidad),
        precioUnitario: 0,
        importeTotal: 0,
        estatus: "PENDIENTE",
        requiereOC: false,
        ocGenerada: false,
        opciones: [],
        opcionSeleccionada: null,
      }));

    if (validas.length === 0) {
      alert("Agrega al menos una refacción con cantidad.");
      return;
    }

    try {
      setGuardandoRefacciones(true);

      // 1. Guardar el servicio primero
      const manoObraGenerada = form.serviciosSeleccionados.map((codigo) => {
        const srv = catalogoServicios.find((s) => s.codigo === codigo);
        return {
          concepto: srv ? (srv.descripcion || srv.label) : `Servicio ${codigo}`
        };
      });
      await updateServicioReparacion(ordenId, { ...form, manoObraGenerada });

      // 2. Enviar refacciones
      const res = await saveRequisicionDiagnostico(ordenId, {
        refacciones: validas,
        estadoOrden: "PENDIENTE_REFACCIONARIA",
      });

      alert("Refacciones enviadas a refaccionaria correctamente.");
      setShowModal(false);
      setRefacciones([{ refaccion: "", cantidad: 1 }]);

      if (onSaved && res?.data?.vehiculo) {
        onSaved(res.data.vehiculo);
      }
    } catch (err) {
      console.error(err);
      alert("Error al enviar las refacciones.");
    } finally {
      setGuardandoRefacciones(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header fw-bold d-flex justify-content-between align-items-center">
            Servicio o Reparación
            {yaCerrada && <span className="badge bg-secondary">Solo Lectura</span>}
          </div>
          <div className="card-body">

            {/* Tabla de servicios */}
            <div className="table-responsive mb-3">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th className="text-center">Generales</th>
                  </tr>
                </thead>
                <tbody>
                  {cargandoServicios && (
                    <tr><td colSpan={2}>Cargando servicios...</td></tr>
                  )}
                  {!cargandoServicios && catalogoServicios.map((srv) => {
                    const codigo = srv.codigo;
                    const activo = form.serviciosSeleccionados.includes(codigo);
                    const descripcion = srv.descripcion || srv.label;
                    return (
                      <tr key={srv._id || codigo}>
                        <td>{codigo} - {descripcion}</td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={activo}
                            onChange={() => toggleServicio(codigo)}
                            disabled={yaCerrada}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ✅ Fallas reportadas por el cliente */}
            <div className="mb-3">
              <label className="form-label fw-semibold">FALLAS REPORTADAS POR EL CLIENTE</label>
              <textarea
                className="form-control"
                rows={4}
                name="fallasReportadasCliente"
                placeholder="Describe las fallas o síntomas que reportó el cliente..."
                value={form.fallasReportadasCliente}
                onChange={handleChangeText}
                disabled={yaCerrada}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">INFORMACIÓN DE LLANTAS</label>
              <textarea
                className="form-control"
                rows={3}
                name="infoLlantas"
                value={form.infoLlantas}
                placeholder="Estado de las llantas, medidas, observaciones..."
                onChange={handleChangeText}
                disabled={yaCerrada}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">OBSERVACIONES GENERALES</label>
              <textarea
                className="form-control"
                rows={3}
                name="revisionFallas"
                value={form.revisionFallas}
                placeholder="Observaciones adicionales sobre el servicio o reparación..."
                onChange={handleChangeText}
                disabled={yaCerrada}
              />
            </div>

            {/* Botones */}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              {/* ✅ Botón solicitar refacciones */}
              {!yaCerrada && (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setShowModal(true)}
                >
                  Solicitar refacciones a refaccionaria
                </button>
              )}

              <div className="ms-auto">
                {!yaCerrada ? (
                  <button type="submit" className="btn btn-primary px-5" disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                ) : (
                  <div className="alert alert-warning d-inline-block mb-0">
                    Esta orden ya ha sido cerrada y no permite modificaciones.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </form>

      {/* ✅ Modal solicitud de refacciones */}
      {showModal && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  Solicitar refacciones a refaccionaria
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  disabled={guardandoRefacciones}
                />
              </div>

              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Indica las refacciones que necesita el vehículo. El
                  refaccionario recibirá esta solicitud y cotizará las opciones.
                </p>

                <table className="table table-sm table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Refacción / Descripción</th>
                      <th style={{ width: "120px" }}>Cantidad</th>
                      <th style={{ width: "50px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {refacciones.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            value={item.refaccion}
                            onChange={(e) => cambiarRefaccion(idx, "refaccion", e.target.value)}
                            placeholder="Ej. Filtro de aceite, Balatas delanteras..."
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm"
                            value={item.cantidad}
                            onChange={(e) => cambiarRefaccion(idx, "cantidad", e.target.value)}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => eliminarRefaccion(idx)}
                            disabled={refacciones.length === 1}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={agregarRefaccion}
                >
                  + Agregar refacción
                </button>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={guardandoRefacciones}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEnviarRefacciones}
                  disabled={guardandoRefacciones}
                >
                  {guardandoRefacciones ? "Enviando..." : "Enviar a refaccionaria"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}