// src/pages/refaccionaria/components/ModalBuscarCodigo.jsx
import { useState, useEffect, useRef } from "react";
import { getPiezas } from "../../../api/piezasCodigosApi"; // 👈 cambia el import

export default function ModalBuscarCodigo({ onSeleccionar, onCerrar }) {
  const [q, setQ]                     = useState("");
  const [resultados, setResultados]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    buscar("");
  }, []);

  const buscar = async (texto) => {
    setLoading(true);
    try {
      const data = await getPiezas({ q: texto, limit: 50 });
    
      setResultados(data.piezas || data.data || []);
    } catch(err) {
        
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQ = (e) => {
    setQ(e.target.value);
    buscar(e.target.value);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "#fff", borderRadius: 12, width: "100%",
          maxWidth: 680, maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>
            🔍 Buscar Refacción en Inventario
          </span>
          <button onClick={onCerrar}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>
            ✕
          </button>
        </div>

        {/* Buscador */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <input
            ref={inputRef}
            className="form-control"
            placeholder="Buscar por código, nombre, número de pieza, proveedor o marca…"
            value={q}
            onChange={handleQ}
          />
        </div>

        {/* Resultados */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading && <div className="text-center text-muted py-3">Buscando…</div>}
          {!loading && resultados.length === 0 && (
            <div className="text-center text-muted py-3">Sin resultados.</div>
          )}
          {!loading && resultados.map((item) => (
            <div
              key={item._id}
              onClick={() => onSeleccionar(item)}
              style={{
                padding: "10px 20px",
                borderBottom: "1px solid #f1f5f9",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f0f9ff"}
              onMouseLeave={(e) => e.currentTarget.style.background = ""}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  background: "#dbeafe", color: "#1d4ed8",
                  borderRadius: 4, padding: "1px 7px", fontSize: 12,
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>
                  {item.codigo}
                </span>
                {item.nombrePieza}
                {item.numeroPieza && (
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>#{item.numeroPieza}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, display: "flex", gap: 16 }}>
                {item.marca     && <span>Marca: <strong>{item.marca}</strong></span>}
                {item.proveedor && <span>Proveedor: <strong>{item.proveedor}</strong></span>}
                {item.unidadMedida && <span>UM: {item.unidadMedida}</span>}
                {item.precioUnitario > 0 && (
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>
                    ${Number(item.precioUnitario).toFixed(2)}
                  </span>
                )}
                {item.cantidad !== undefined && (
                  <span style={{ color: item.cantidad <= (item.cantidadMinima || 0) ? "#dc2626" : "#64748b" }}>
                    Stock: {item.cantidad}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid #e2e8f0",
          fontSize: 12, color: "#94a3b8", textAlign: "right",
        }}>
          {resultados.length} resultado(s) — haz clic en una fila para seleccionar
        </div>
      </div>
    </div>
  );
}