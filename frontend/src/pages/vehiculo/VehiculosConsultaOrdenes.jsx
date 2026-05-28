import React, { useEffect, useState } from "react";
import { listOrdenesServicio } from "../../api/vehiculos";
import { useNavigate } from "react-router-dom";

const TABS = [
  { key: "PENDIENTE_CAPTURA",       label: "PENDIENTE CAPTURA" },
  { key: "PENDIENTE_REFACCIONARIA", label: "PENDIENTE REFACCIONARIA" },
  { key: "PENDIENTE_AUTORIZACION",  label: "PENDIENTE AUTORIZACION CLIENTE" },
  { key: "REPARACION_EN_CURSO",     label: "REPARACIÓN EN CURSO" },
  { key: "CALIDAD",                 label: "CALIDAD" },
  { key: "PENDIENTE_CERRAR",        label: "PENDIENTE DE CERRAR" },
];

export default function VehiculosConsultaOrdenes() {
  const [tab,     setTab]     = useState("PENDIENTE_CAPTURA");
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Búsqueda global ────────────────────────────────────────────────────
  const [globalOs,      setGlobalOs]      = useState("");
  const [globalResult,  setGlobalResult]  = useState(null);  // null = sin búsqueda
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError,   setGlobalError]   = useState("");

  // ── Filtros por tab ────────────────────────────────────────────────────
  const [searchOs, setSearchOs] = useState("");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const [limit]                 = useState(10);
  const [total,    setTotal]    = useState(0);

  const navigate = useNavigate();

  // ── Búsqueda global por OS ─────────────────────────────────────────────
  // Busca en cada estado uno por uno hasta encontrar coincidencia
  const ALL_ESTADOS = [
    "PENDIENTE_CAPTURA",
    "PENDIENTE_REFACCIONARIA",
    "PENDIENTE_AUTORIZACION",
    "REPARACION_EN_CURSO",
    "CALIDAD",
    "PENDIENTE_CERRAR",
    "CERRADA",
  ];

  const handleGlobalSearch = async (e) => {
    e.preventDefault();
    const q = globalOs.trim();
    if (!q) { setGlobalResult(null); setGlobalError(""); return; }

    try {
      setGlobalLoading(true);
      setGlobalError("");
      setGlobalResult(null);

      // Recorre todos los estados hasta encontrar la orden
      for (const estado of ALL_ESTADOS) {
        const res = await listOrdenesServicio({ estado, searchOs: q, page: 1, limit: 5 });
        const data = res.data.data || [];
        if (data.length > 0) {
          setGlobalResult(data[0]);
          return; // encontrado, salir
        }
      }

      setGlobalError("No se encontró ninguna orden con ese folio.");
    } catch (err) {
      setGlobalError("Error al buscar la orden.");
    } finally {
      setGlobalLoading(false);
    }
  };

  const clearGlobal = () => {
    setGlobalOs("");
    setGlobalResult(null);
    setGlobalError("");
  };

  // ── Datos por tab ──────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await listOrdenesServicio({ estado: tab, searchOs, search, page, limit });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError("No se pudieron cargar las órdenes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tab, page]);

  const handleBuscar = (e) => { e.preventDefault(); setPage(1); fetchData(); };
  const totalPages = Math.ceil(total / limit) || 1;

  // ── Render fila ────────────────────────────────────────────────────────
  const RowOrden = ({ r }) => (
    <tr style={{ cursor: "pointer" }} onClick={() => navigate(`/vehiculo/orden/${r._id}`)}>
      <td className="text-center">{r.ordenServicio || "-"}</td>
      <td>{r.nombreCliente || r.nombreGobierno || r.cliente?.nombre || "-"}</td>
      <td>{(r.marca || "") + (r.modelo ? " / " + r.modelo : "") || "-"}</td>
      <td className="text-center">{r.anio    || "-"}</td>
      <td className="text-center">{r.placas  || "-"}</td>
      <td className="text-center">{r.fechaRecepcion ? new Date(r.fechaRecepcion).toLocaleDateString() : "-"}</td>
      <td className="text-center">{r.celular || r.telefonoFijo || "-"}</td>
      <td className="text-center">{r.asesor  || "admin"}</td>
      <td className="text-center">
        <span className="badge" style={{
          background: r.estadoOrden === "CERRADA" ? "#6c757d"
            : r.estadoOrden === "REPARACION_EN_CURSO" ? "#0d6efd"
            : r.estadoOrden === "CALIDAD" ? "#198754"
            : "#ffc107",
          color: r.estadoOrden === "PENDIENTE_AUTORIZACION" ? "#000" : "#fff",
          fontSize: 11,
        }}>
          {(r.estadoOrden || "").replace(/_/g, " ")}
        </span>
      </td>
    </tr>
  );

  const TableHead = ({ showEstado = false }) => (
    <thead className="table-light">
      <tr className="text-center">
        <th>Orden de Servicio</th>
        <th>Cliente</th>
        <th>Marca / Modelo</th>
        <th>Año</th>
        <th>Placas</th>
        <th>Fecha Recepción</th>
        <th>Teléfono</th>
        <th>Asesor</th>
        {showEstado && <th>Estado</th>}
      </tr>
    </thead>
  );

  return (
    <div className="container-fluid">
      <h2 className="text-center fw-bold my-3" style={{ letterSpacing: "2px" }}>
        CONSULTA GENERAL ÓRDENES DE SERVICIO
      </h2>

      {/* ── BÚSQUEDA GLOBAL ─────────────────────────────────────────── */}
      <div className="d-flex justify-content-center mb-4">
        <div className="card shadow-sm" style={{ width: "100%", maxWidth: 560 }}>
          <div className="card-body py-3">
            <p className="text-center fw-semibold mb-2" style={{ fontSize: 14 }}>
              Búsqueda rápida por Orden de Servicio
            </p>
            <form className="d-flex gap-2" onSubmit={handleGlobalSearch}>
              <input
                type="text"
                className="form-control"
                placeholder="Ej. OS-20260528-115912"
                value={globalOs}
                onChange={(e) => { setGlobalOs(e.target.value); setGlobalResult(null); setGlobalError(""); }}
              />
              <button type="submit" className="btn btn-primary px-3" disabled={globalLoading}>
                {globalLoading ? "…" : "Buscar"}
              </button>
              {(globalResult || globalError) && (
                <button type="button" className="btn btn-outline-secondary" onClick={clearGlobal}>
                  ✕
                </button>
              )}
            </form>

            {/* Resultado global */}
            {globalError && (
              <p className="text-danger text-center mt-2 mb-0" style={{ fontSize: 13 }}>{globalError}</p>
            )}
            {globalResult && (
              <div
                className="mt-3 p-3 rounded border border-primary"
                style={{ cursor: "pointer", background: "#f0f7ff" }}
                onClick={() => navigate(`/vehiculo/orden/${globalResult._id}`)}
              >
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-1">
                  <div>
                    <span className="fw-bold text-primary" style={{ fontSize: 15 }}>
                      {globalResult.ordenServicio}
                    </span>
                    <span className="ms-2 badge bg-secondary" style={{ fontSize: 11 }}>
                      {(globalResult.estadoOrden || "").replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {globalResult.fechaRecepcion
                      ? new Date(globalResult.fechaRecepcion).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <div className="mt-1" style={{ fontSize: 13 }}>
                  <strong>Cliente:</strong>{" "}
                  {globalResult.nombreCliente || globalResult.nombreGobierno || globalResult.cliente?.nombre || "-"}
                  {" · "}
                  <strong>Vehículo:</strong>{" "}
                  {[globalResult.marca, globalResult.modelo, globalResult.anio].filter(Boolean).join(" ")}
                  {globalResult.placas ? ` · ${globalResult.placas}` : ""}
                </div>
                <p className="text-primary mb-0 mt-1" style={{ fontSize: 12 }}>
                  Clic para abrir la orden →
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <ul className="nav nav-tabs mb-3">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button
              type="button"
              className={"nav-link" + (tab === t.key ? " active fw-bold" : "")}
              onClick={() => { setTab(t.key); setPage(1); }}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="card shadow-sm">
        <div className="card-body">
          {/* Filtros por tab */}
          <form className="row g-2 align-items-center mb-3" onSubmit={handleBuscar}>
            <div className="col-md-4">
              <label className="form-label mb-0">Buscar por Orden de Servicio:</label>
              <input type="text" className="form-control" value={searchOs} onChange={(e) => setSearchOs(e.target.value)} />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="submit" className="btn btn-primary w-100">Buscar</button>
            </div>
            <div className="col-md-2">
              <label className="form-label mb-0">Mostrar</label>
              <select className="form-select" value={limit} disabled>
                <option value={10}>10 entries</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label mb-0">Search:</label>
              <input type="text" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBuscar(e)} />
            </div>
          </form>

          {loading && <p className="text-muted">Cargando órdenes...</p>}
          {error   && <p className="text-danger">{error}</p>}

          {!loading && !error && (
            <div className="table-responsive">
              <table className="table table-striped table-bordered table-sm">
                <TableHead />
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted">No hay órdenes en este estado.</td></tr>
                  )}
                  {rows.map((r) => <RowOrden key={r._id} r={r} />)}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > 0 && (
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">Mostrando {rows.length} de {total} órdenes</span>
              <div className="btn-group">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>« Prev</button>
                <span className="btn btn-outline-secondary btn-sm disabled">{page} / {totalPages}</span>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p < totalPages ? p + 1 : p)}>Next »</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}