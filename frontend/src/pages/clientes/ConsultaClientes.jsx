import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";          // 👈 NUEVO
import { listCustomers } from "../../api/customers";
import "../../styles/clientes.css";

function nombreCliente(c) {
  if (c.tipoCliente === "Empresa Gobierno") {
    return c.gobierno?.nombreGobierno || "-";
  }
  if (c.tipoCliente === "Empresa Privada" || c.tipoCliente === "Empresa Arrendadora") {
    return c.empresa?.razonSocial || "-";
  }
  return (
    [c.nombre, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(" ") || "-"
  );
}

export default function ConsultaClientes() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const limit = 10;

  const navigate = useNavigate();                        // 👈 NUEVO

  const fetchData = useCallback(
    async (p = 1) => {
      try {
        setErr("");
        const res = await listCustomers({ q, page: p, limit });
        setRows(res.data.data || []);
        setTotal(res.data.total || 0);
        setPage(res.data.page || 1);
      } catch (e) {
        console.error(e);
        setErr(
          e?.response?.data?.error ||
            e.message ||
            "Error al consultar clientes"
        );
        setRows([]);
        setTotal(0);
        setPage(1);
      }
    },
    [q]
  ); // dependemos de q para que el botón “Buscar” use el último valor

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleEdit = (id) => {
    // Reutilizamos AltaCliente para editar
    navigate(`/clientes/alta/${id}`);
  };

  return (
    <div className="consulta-card">
      <div className="consulta-toolbar">
        <input
          className="dash-search"
          placeholder="Buscar por nombre, correo o RFC..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-light" onClick={() => fetchData(1)}>
          Buscar
        </button>
      </div>

      {err && (
        <div
          style={{
            color: "#b91c1c",
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          ERROR: {err}
        </div>
      )}

      <div className="tabla">
        <div className="thead">
          <div>Nombre</div>
          <div>Correo</div>
          <div>RFC</div>
          <div>Teléfono</div>
          <div>Ciudad</div>
          <div>Acciones</div> {/* 👈 NUEVO */}
        </div>

        {rows.map((c) => (
          <div className="trow" key={c._id}>
            <div>
              {nombreCliente(c)}
              {c.esEmpleado && (
                <span className="badge bg-info-subtle text-info-emphasis ms-2">Empleado</span>
              )}
            </div>
            <div>
              {c.emails?.[0] || c.email || "—"}
              {c.emails?.length > 1 && <span className="text-muted small ms-1">+{c.emails.length - 1}</span>}
            </div>
            <div>{c.rfc || "—"}</div>
            <div>
              {(() => {
                const tel = c.celulares?.[0] || c.celular || c.telefonos?.[0] || c.telefono;
                const extra = (c.celulares?.length || 0) + (c.telefonos?.length || 0) - (tel ? 1 : 0);
                return (
                  <>
                    {tel?.numero ? (tel.lada ? `(${tel.lada}) ${tel.numero}` : tel.numero) : "—"}
                    {extra > 0 && <span className="text-muted small ms-1">+{extra}</span>}
                  </>
                );
              })()}
            </div>
            <div>{c.direccion?.ciudad || "—"}</div>
            <div>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleEdit(c._id)}
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="paginacion">
        <button
          className="btn btn-light"
          disabled={page <= 1}
          onClick={() => fetchData(page - 1)}
        >
          «
        </button>
        <span>
          Página {page} de {totalPages}
        </span>
        <button
          className="btn btn-light"
          disabled={page >= totalPages}
          onClick={() => fetchData(page + 1)}
        >
          »
        </button>
      </div>
    </div>
  );
}
