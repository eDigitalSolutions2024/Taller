// src/pages/vehiculo/VehiculosConsultaGarantias.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listGarantias, resolverGarantia, cancelarGarantia } from "../../api/garantias";
import { getUser } from "../../auth";

const PAGE_SIZE = 10;

const ESTADO_BADGE = {
  PENDIENTE: "bg-warning text-dark",
  APROBADA: "bg-success",
  NEGADA: "bg-danger",
  NO_APLICA: "bg-secondary",
};

export default function VehiculosConsultaGarantias() {
  const navigate = useNavigate();
  const usuario = getUser();
  const esAdmin = usuario?.role === "admin";

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState("");
  const [searchOs, setSearchOs] = useState("");
  const [loading, setLoading] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await listGarantias({ estado, searchOs: searchOs.trim(), page, limit: PAGE_SIZE });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      alert("Error al cargar solicitudes de garantía.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, estado]);

  const handleBuscar = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleResolver = async (id, accion) => {
    let motivo;
    let autorizaCarreon = false;

    if (accion === "APROBAR") {
      autorizaCarreon = window.confirm(
        "¿Autorizar esta garantía? Se marcará como aprobada."
      );
      if (!autorizaCarreon) return;
      motivo = window.prompt("Motivo de la garantía (obligatorio):", "") || "";
      if (!motivo.trim()) {
        alert("El motivo es obligatorio para autorizar.");
        return;
      }
    } else if (accion === "NO_APLICA") {
      if (!window.confirm('¿Marcar esta solicitud como "No aplica"? La orden nueva no correspondía a una garantía.')) return;
      motivo = window.prompt("Motivo (obligatorio):", "") || "";
      if (!motivo.trim()) {
        alert('El motivo es obligatorio para marcar "No aplica".');
        return;
      }
    } else {
      if (!window.confirm("¿Negar esta solicitud de garantía?")) return;
      motivo = window.prompt("Motivo de la negación (opcional):", "") || "";
    }

    try {
      setProcesandoId(id);
      await resolverGarantia(id, { accion, motivo, autorizaCarreon });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.msg || "No se pudo resolver la solicitud.");
    } finally {
      setProcesandoId(null);
    }
  };

  const handleCancelar = async (id) => {
    if (!window.confirm("¿Cancelar esta orden? La orden nueva quedará marcada como CANCELADA.")) return;
    try {
      setProcesandoId(id);
      await cancelarGarantia(id);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.msg || "No se pudo cancelar la orden.");
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="card card-body">
      <h4 className="mb-3">SOLICITUDES DE GARANTÍA</h4>

      <form className="row g-2 align-items-end mb-3" onSubmit={handleBuscar}>
        <div className="col-md-3">
          <label className="form-label">Estado:</label>
          <select className="form-select form-select-sm" value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="NEGADA">Negada</option>
            <option value="NO_APLICA">No aplica</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Orden de Servicio:</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={searchOs}
            onChange={(e) => setSearchOs(e.target.value)}
            placeholder="Ej. OS-00012"
          />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-primary btn-sm w-100" disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Orden (garantía)</th>
              <th>Orden origen</th>
              <th>Motivo</th>
              <th style={{ width: 120 }}>Estado</th>
              <th style={{ width: 140 }}>Solicitó</th>
              {esAdmin && <th style={{ width: 200 }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={esAdmin ? 6 : 5} className="text-center">
                  No hay solicitudes de garantía.
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={o._id} style={{ cursor: "pointer" }}>
                <td onClick={() => navigate(`/vehiculo/orden/${o._id}`)}>{o.ordenServicio || o._id}</td>
                <td>{o.garantia?.ordenAnteriorFolio || ""}</td>
                <td>{o.garantia?.motivo || ""}</td>
                <td>
                  <span className={"badge " + (ESTADO_BADGE[o.garantia?.estado] || "bg-secondary")}>
                    {o.garantia?.estado || ""}
                  </span>
                </td>
                <td>{o.creadoPor || ""}</td>
                {esAdmin && (
                  <td>
                    {o.garantia?.estado === "PENDIENTE" ? (
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          disabled={procesandoId === o._id}
                          onClick={() => handleResolver(o._id, "APROBAR")}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={procesandoId === o._id}
                          onClick={() => handleResolver(o._id, "NEGAR")}
                        >
                          Negar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={procesandoId === o._id}
                          onClick={() => handleResolver(o._id, "NO_APLICA")}
                        >
                          No aplica
                        </button>
                      </div>
                    ) : o.garantia?.estado === "NO_APLICA" && o.estadoOrden !== "CANCELADA" ? (
                      <div className="d-flex flex-column gap-1">
                        <small className="text-muted">{o.garantia?.resueltoPor}</small>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={procesandoId === o._id}
                          onClick={() => handleCancelar(o._id)}
                        >
                          Cancelar orden
                        </button>
                      </div>
                    ) : (
                      <small className="text-muted">{o.garantia?.resueltoPor}</small>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-2">
        <small>Mostrando página {page} de {totalPages} ({total} solicitudes)</small>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
