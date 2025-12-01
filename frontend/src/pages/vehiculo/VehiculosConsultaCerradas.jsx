// src/pages/vehiculo/VehiculoConsultaCerradas.jsx
import React, { useEffect, useState } from "react";
import { listOrdenesServicio } from "../../api/vehiculos";

function formatFecha(fechaIso) {
  if (!fechaIso) return "";
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX");
}

export default function VehiculoConsultaCerradas({ onSelectOrden }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [searchInput, setSearchInput] = useState("");
  const [searchOs, setSearchOs] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const params = {
          estado: "CERRADA",
          page,
          limit,
          searchOs, // buscar por No. de Orden
        };

        const res = await listOrdenesServicio(params);
        const { data, total: t } = res.data;

        setRows(data || []);
        setTotal(t || 0);
      } catch (err) {
        console.error(err);
        setError("Error al cargar órdenes cerradas.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, limit, searchOs]);

  const handleBuscar = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchOs(searchInput.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  const handleRowClick = (orden) => {
    if (onSelectOrden) onSelectOrden(orden);
  };

  return (
    <div className="card">
      <div className="card-body">
        <h4 className="mb-3">Órdenes Cerradas</h4>

        {/* Filtros arriba */}
        <div className="d-flex flex-wrap align-items-center mb-3 gap-3">
          <div>
            <label className="me-2">Mostrar</label>
            <select
              className="form-select form-select-sm d-inline-block"
              style={{ width: "80px" }}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value) || 10);
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="ms-1">entradas</span>
          </div>

          <form className="d-flex align-items-center ms-auto" onSubmit={handleBuscar}>
            <label className="me-2 mb-0">Buscar por Orden de Servicio:</label>
            <input
              type="text"
              className="form-control form-control-sm me-2"
              style={{ width: "180px" }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Buscar
            </button>
          </form>
        </div>

        {/* Tabla */}
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Orden de Servicio</th>
                <th>Cliente</th>
                <th>Marca / Modelo</th>
                <th>Año</th>
                <th>Placas</th>
                <th>Fecha Recepción</th>
                <th>Teléfono</th>
                <th>Asesor</th>
                <th>Fecha Cierre</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center">
                    Cargando...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center">
                    No hay órdenes cerradas.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((o) => {
                  const clienteNombre =
                    o.nombreGobierno || o.cliente?.nombre || "";
                  const marcaModelo = [o.marca, o.modelo]
                    .filter(Boolean)
                    .join(" / ");
                  const telefono =
                    o.telefonoFijo ||
                    o.celular ||
                    `${o.telefonoFijoLada || ""} ${o.telefonoFijo || ""}`.trim();

                  return (
                    <tr
                      key={o._id}
                      style={{ cursor: onSelectOrden ? "pointer" : "default" }}
                      onClick={() => handleRowClick(o)}
                    >
                      <td className="text-center">{o.ordenServicio || o._id}</td>
                      <td>{clienteNombre}</td>
                      <td>{marcaModelo}</td>
                      <td className="text-center">{o.anio}</td>
                      <td className="text-center">{o.placas}</td>
                      <td className="text-center">{formatFecha(o.fechaRecepcion)}</td>
                      <td className="text-center">{telefono || "n/a"}</td>
                      <td className="text-center">{o.asesorServicio || ""}</td>
                      <td className="text-center">{formatFecha(o.fechaCierre)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Paginación estilo DataTables */}
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="small text-muted">
            {total === 0
              ? "Mostrando 0 de 0 entradas"
              : `Mostrando ${from} a ${to} de ${total} entradas`}
          </div>

          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button className="btn btn-outline-secondary disabled">
              {page}
            </button>
            <button
              className="btn btn-outline-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mt-2 mb-0 py-1 small">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
