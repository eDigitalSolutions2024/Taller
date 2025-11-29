// src/pages/vehiculo/ServicioReparacionTab.jsx
import React, { useEffect, useState } from "react";
import { updateServicioReparacion } from "../../api/vehiculos";

const emptyServicio = {
  alineacionComputadora: false,
  balanceoPorRueda: false,
  rotacion: false,
  instalacionAmortiguadorNormal: false,
  instalacionAmortiguadorEspecial: false,
  montajeLlantaAutocamioneta: false,
  limpiezaAjusteFrenosAutocamioneta: false,
  frenos2RuedasAutocamioneta: false,
  cambioBrazo: false,
  cambioTerminalDireccion: false,
  cambioRotula: false,
  infoLlantas: "",
  revisionFallas: "",
};

export default function ServicioReparacionTab({
  ordenId,
  initialData,
  onSaved,
}) {
  const [form, setForm] = useState(emptyServicio);
  const [saving, setSaving] = useState(false);

  // precargar si ya hay info guardada
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  const handleChangeCheck = (e) => {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleChangeText = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ordenId) return;

    try {
      setSaving(true);
      const res = await updateServicioReparacion(ordenId, form);
      alert("Orden de Servicio Iniciada.");
      if (onSaved) onSaved(res.data.vehiculo);
    } catch (err) {
      console.error(err);
      alert("Error al guardar Servicio / Reparación");
    } finally {
      setSaving(false);
    }
  };

  const renderServicioRow = (label, name) => (
    <tr>
      <td>{label}</td>
      <td className="text-center">
        <input
          type="checkbox"
          name={name}
          className="form-check-input"
          checked={!!form[name]}
          onChange={handleChangeCheck}
        />
      </td>
    </tr>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
        <div className="card-header fw-bold">Servicio o Reparación</div>
        <div className="card-body">
          {/* Tabla de servicios (muy similar a la del sistema viejo) */}
          <div className="table-responsive mb-3">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th className="text-center">Generales</th>
                </tr>
              </thead>
              <tbody>
                {renderServicioRow(
                  "ALINEACIÓN POR COMPUTADORA",
                  "alineacionComputadora"
                )}
                {renderServicioRow("BALANCEO POR RUEDA", "balanceoPorRueda")}
                {renderServicioRow("ROTACIÓN", "rotacion")}
                {renderServicioRow(
                  "INSTALACIÓN AMORTIGUADOR (NORMAL)",
                  "instalacionAmortiguadorNormal"
                )}
                {renderServicioRow(
                  "INSTALACIÓN AMORTIGUADOR (ESPECIAL)",
                  "instalacionAmortiguadorEspecial"
                )}
                {renderServicioRow(
                  "MONTAJE LLANTA (AUTO-CAMIONETA)",
                  "montajeLlantaAutocamioneta"
                )}
                {renderServicioRow(
                  "LIMP. Y AJU. FRENOS (AUTO-CAMIONETA)",
                  "limpiezaAjusteFrenosAutocamioneta"
                )}
                {renderServicioRow(
                  "R. FRENOS 2 RUEDAS (AUTO-CAMIONETA)",
                  "frenos2RuedasAutocamioneta"
                )}
                {renderServicioRow("CAMBIO DE BRAZO", "cambioBrazo")}
                {renderServicioRow(
                  "CAMBIO TERMINAL DE DIRECCIÓN",
                  "cambioTerminalDireccion"
                )}
                {renderServicioRow("CAMBIO DE RÓTULA", "cambioRotula")}
              </tbody>
            </table>
          </div>

          {/* Información de llantas */}
          <div className="mb-3">
            <label className="form-label fw-semibold">
              Información de Llantas
            </label>
            <textarea
              className="form-control"
              rows={3}
              name="infoLlantas"
              value={form.infoLlantas}
              onChange={handleChangeText}
            />
          </div>

          {/* Revisión fallas reportadas */}
          <div className="mb-3">
            <label className="form-label fw-semibold">
              REVISIÓN FALLAS REPORTADAS POR EL CLIENTE
            </label>
            <textarea
              className="form-control"
              rows={3}
              name="revisionFallas"
              value={form.revisionFallas}
              onChange={handleChangeText}
            />
          </div>

          <div className="text-center">
            <button
              type="submit"
              className="btn btn-primary px-5"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
