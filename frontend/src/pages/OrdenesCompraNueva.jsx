// src/pages/OrdenesCompraNueva.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../api/http";
import { createOrdenCompraManual, downloadOrdenCompraPdf } from "../api/ordenesCompra";
import { getUser } from "../auth";

export default function OrdenesCompraNueva() {
  const navigate = useNavigate();
  const user = getUser();

  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState("");
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadingProveedores(true);
        const { data } = await http.get("/proveedores", {
          params: { limit: 200, soloActivos: true },
        });
        setProveedores(data?.data || []);
      } catch (err) {
        console.error(err);
        alert("Error al cargar el catálogo de proveedores.");
      } finally {
        setLoadingProveedores(false);
      }
    })();
  }, []);

  const proveedor = useMemo(
    () => proveedores.find((p) => p._id === proveedorId) || null,
    [proveedores, proveedorId]
  );

  const domicilio = useMemo(() => {
    if (!proveedor) return "";
    return [
      [proveedor.calle, proveedor.numeroExterior].filter(Boolean).join(" "),
      proveedor.numeroInterior ? `Int. ${proveedor.numeroInterior}` : "",
      proveedor.colonia,
      proveedor.ciudad,
      proveedor.estado,
      proveedor.codigoPostal ? `C.P. ${proveedor.codigoPostal}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  }, [proveedor]);

  const fechaHoy = useMemo(() => new Date().toLocaleDateString("es-MX"), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proveedorId) {
      alert("Selecciona un proveedor.");
      return;
    }

    try {
      setSaving(true);
      const resp = await createOrdenCompraManual({ proveedorId });
      if (!resp?.ok) throw new Error(resp?.msg || "Error al generar la orden de compra.");

      const oc = resp.ordenCompra;
      alert(`Orden de compra ${oc.numero} generada correctamente.`);

      if (oc?._id) {
        await downloadOrdenCompraPdf(oc._id);
      }
      navigate("/ordenes-compra");
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al generar la orden de compra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-body" style={{ maxWidth: 640 }}>
          <h4 className="mb-1 fw-bold">Nueva orden de compra</h4>
          <p className="text-muted small mb-3">
            El folio se asigna automáticamente al generar. Las piezas se capturan a mano en el
            formato impreso.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label mb-1">Proveedor</label>
              <select
                className="form-select form-select-sm"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                disabled={loadingProveedores}
                required
              >
                <option value="">{loadingProveedores ? "Cargando..." : "Selecciona un proveedor"}</option>
                {proveedores.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nombreProveedor}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label mb-1">Domicilio</label>
              <input
                className="form-control form-control-sm"
                value={domicilio}
                readOnly
                placeholder="Se completa al elegir un proveedor"
              />
            </div>

            <div className="mb-3">
              <label className="form-label mb-1">Fecha</label>
              <input className="form-control form-control-sm" value={fechaHoy} readOnly />
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label mb-1">Entrega</label>
                <input className="form-control form-control-sm" value={user?.name || ""} readOnly />
              </div>
              <div className="col-6">
                <label className="form-label mb-1">Recibe</label>
                <input
                  className="form-control form-control-sm"
                  value=""
                  readOnly
                  placeholder="En blanco (se firma al recibir)"
                />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Generando..." : "Generar orden de compra"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate("/ordenes-compra")}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
