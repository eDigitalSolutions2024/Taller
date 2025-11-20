// src/pages/vehiculo/VehiculoEntrada.jsx
import React, { useState } from "react";

export default function VehiculoEntrada() {
  const [q, setQ] = useState("");

  return (
    <div className="container-fluid">
      {/* Título centrado */}
      <h2 className="text-center fw-bold my-3" style={{letterSpacing: "2px"}}>
        NUEVA ORDEN DE SERVICIO
      </h2>

      {/* Card contenedora */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            {/* Etiqueta */}
            <div className="col-12 col-md-3">
              <label className="fw-semibold mb-0">Nombre Cliente:</label>
            </div>

            {/* Input de búsqueda */}
            <div className="col-12 col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar un Nombre..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {/* Botón (pendiente de integrar) */}
            <div className="col-12 col-md-3 d-grid">
              <button
                type="button"
                className="btn btn-primary"
                disabled
                title="Pendiente de implementar"
                // TODO: aquí conectaremos el buscador de clientes (modal/lista/autocompletar)
                onClick={() => {}}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nota opcional para dev */}
      <small className="text-muted d-block mt-2">
        * El botón “Buscar” está deshabilitado temporalmente. En el siguiente paso lo conectamos a la búsqueda de clientes.
      </small>
    </div>
  );
}
