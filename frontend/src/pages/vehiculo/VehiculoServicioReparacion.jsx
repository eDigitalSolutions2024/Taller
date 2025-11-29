// src/pages/vehiculo/VehiculoServicioReparacion.jsx
import React, { useEffect, useState } from "react";

export default function VehiculoServicioReparacion({ orden, readOnly = false }) {
  const [form, setForm] = useState({
    // GENERALES (ejemplo de servicios)
    alineacionComputadora: false,
    balanceoPorRueda: false,
    rotacion: false,
    instalacionAmortiguadorNormal: false,
    instalacionAmortiguadorEspecial: false,
    montajeLlantaCamioneta: false,
    limpiezaFrenosCamioneta: false,
    frenos2RuedasCamioneta: false,
    cambioBrazo: false,
    cambioTerminalDireccion: false,
    cambioRotula: false,

    infoLlantas: "",
    revisionFallasCliente: "",
  });

  // Si en un futuro la orden trae estos datos, aquí los podríamos precargar
  useEffect(() => {
    if (!orden || !orden.servicioReparacion) return;
    setForm((prev) => ({
      ...prev,
      ...orden.servicioReparacion,
    }));
  }, [orden]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    if (readOnly) return;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleGuardar = () => {
    if (readOnly) return;
    // Más adelante aquí conectamos al backend
    console.log("Datos servicio/reparación a guardar:", form);
    alert("Luego conectamos este Guardar con el backend 😄");
  };

  return (
    <div className="card mt-3">
      <div className="card-header fw-bold">Servicio o Reparación</div>
      <div className="card-body">
        {/* Tabla de servicios (muy parecida a la del sistema viejo) */}
        <div className="table-responsive">
          <table className="table table-bordered table-sm mb-0">
            <thead>
              <tr className="text-center">
                <th style={{ width: "40%" }}>Servicio</th>
                <th>Generales</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["alineacionComputadora", "ALINEACIÓN POR COMPUTADORA"],
                ["balanceoPorRueda", "BALANCEO POR RUEDA"],
                ["rotacion", "ROTACIÓN"],
                ["instalacionAmortiguadorNormal", "INSTALACIÓN AMORTIGUADOR (NORMAL)"],
                ["instalacionAmortiguadorEspecial", "INSTALACIÓN AMORTIGUADOR (ESPECIAL)"],
                ["montajeLlantaCamioneta", "MONTAJE LLANTA (AUTO-CAMIONETA)"],
                ["limpiezaFrenosCamioneta", "LIMP. Y AJUSTE FRENOS (AUTO-CAMIONETA)"],
                ["frenos2RuedasCamioneta", "R. FRENOS 2 RUEDAS (AUTO-CAMIONETA)"],
                ["cambioBrazo", "CAMBIO DE BRAZO"],
                ["cambioTerminalDireccion", "CAMBIO TERMINAL DE DIRECCIÓN"],
                ["cambioRotula", "CAMBIO DE RÓTULA"],
              ].map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name={key}
                      checked={!!form[key]}
                      onChange={handleChange}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Información de llantas */}
        <div className="mt-3">
          <label className="form-label fw-semibold">
            Información de Llantas
          </label>
          <textarea
            className="form-control"
            rows={2}
            name="infoLlantas"
            value={form.infoLlantas}
            onChange={handleChange}
          />
        </div>

        {/* Revisión fallas reportadas por el cliente */}
        <div className="mt-3">
          <label className="form-label fw-semibold">
            REVISIÓN FALLAS REPORTADAS POR EL CLIENTE
          </label>
          <textarea
            className="form-control"
            rows={3}
            name="revisionFallasCliente"
            value={form.revisionFallasCliente}
            onChange={handleChange}
          />
        </div>

        {/* 🔘 Botón Guardar al final */}
        <div className="text-center mt-4">
          <button
            type="button"
            className="btn btn-success px-5"
            onClick={handleGuardar}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
