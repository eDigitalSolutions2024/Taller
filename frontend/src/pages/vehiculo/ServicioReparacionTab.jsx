// src/pages/vehiculo/ServicioReparacionTab.jsx
import React, { useEffect, useState } from "react";
import { updateServicioReparacion } from "../../api/vehiculos";
import { fetchServiciosTaller } from "../../api/codigos";

const emptyServicio = {
  serviciosSeleccionados: [],
  infoLlantas: "",
  revisionFallas: "",
};

export default function ServicioReparacionTab({
  ordenId,
  initialData,
  onSaved,
  yaCerrada // 👈 Prop fundamental para el bloqueo
}) {
  const [form, setForm] = useState(emptyServicio);
  const [saving, setSaving] = useState(false);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        serviciosSeleccionados: initialData.serviciosSeleccionados || [],
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

  /* =========================
   * Handlers (Protegidos)
   * ========================= */
  const handleChangeText = (e) => {
    if (yaCerrada) return; // 🔒 Bloqueo funcional
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleServicio = (codigoServicio) => {
    if (yaCerrada) return; // 🔒 Bloqueo funcional
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
    if (!ordenId || yaCerrada) return; // 🔒 No permitir envío si está cerrada

    try {
      setSaving(true);
      const manoObraGenerada = form.serviciosSeleccionados.map((codigo) => {
        const srv = catalogoServicios.find((s) => s.codigo === codigo);
        return {
          concepto: srv ? (srv.descripcion || srv.label) : `Servicio ${codigo}`
        };
      });

      const payload = {
        ...form,
        manoObraGenerada 
      };

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

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
        <div className="card-header fw-bold d-flex justify-content-between align-items-center">
          Servicio o Reparación
          {yaCerrada && <span className="badge bg-secondary">Solo Lectura</span>}
        </div>
        <div className="card-body">
          
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
                          disabled={yaCerrada} // 🔒 Bloqueo de checkbox
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold">Información de Llantas</label>
            <textarea
              className="form-control"
              rows={3}
              name="infoLlantas"
              value={form.infoLlantas}
              onChange={handleChangeText}
              disabled={yaCerrada} // 🔒 Bloqueo de textarea
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold">REVISIÓN FALLAS REPORTADAS POR EL CLIENTE</label>
            <textarea
              className="form-control"
              rows={3}
              name="revisionFallas"
              value={form.revisionFallas}
              onChange={handleChangeText}
              disabled={yaCerrada} 
            />
          </div>

          <div className="text-center">
            {!yaCerrada ? (
              <button
                type="submit"
                className="btn btn-primary px-5"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            ) : (
              <div className="alert alert-warning d-inline-block">
                  Esta orden ya ha sido cerrada y no permite modificaciones.
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}