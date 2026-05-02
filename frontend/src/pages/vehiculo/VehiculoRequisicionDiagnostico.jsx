// src/pages/vehiculo/VehiculoRequisicionDiagnostico.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  saveRequisicionDiagnostico,
  generarOrdenCompra,
} from "../../api/vehiculos";
import http from "../../api/http";

export default function VehiculoRequisicionDiagnostico({ orden, onSaved, readOnly }) {
  const [diagnostico, setDiagnostico] = useState("");
  const [rows, setRows] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [line, setLine] = useState({
    cant: "", unidad: "", refaccion: "", tipo: "", marca: "", proveedor: "",
    codigo: "", precioUnitario: "", moneda: "MN", tiempoEntrega: "", core: "", observaciones: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [historialDiagnosticos, setHistorialDiagnosticos] = useState([]);

  useEffect(() => {
    if (!orden) return;
    setDiagnostico(orden.diagnosticoTecnico || "");
    setHistorialDiagnosticos(orden.historialDiagnosticos || []);

    const refConEstatus = (orden.refaccionesSolicitadas || []).map((r) => ({
      ...r,
      estatus: r.estatus || "PENDIENTE",
      requiereOC: !!r.requiereOC,
      ocGenerada: !!r.ocGenerada,
      numeroOC: r.numeroOC || null,
      ordenCompra: r.ordenCompra || null,
    }));
    setRows(refConEstatus);
    setCargos(orden.cargosEnOrden || []);
  }, [orden]);

  const handleLineChange = (e) => {
    const { name, value } = e.target;
    setLine((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddLine = async () => {
    if (readOnly) return;
    const cantNum = Number(line.cant) || 0;
    const puNum = Number(line.precioUnitario) || 0;
    if (!cantNum || !line.refaccion.trim()) return alert("Captura al menos Cantidad y Refacción.");

    const nueva = {
      ...line,
      cant: cantNum,
      precioUnitario: puNum,
      importeTotal: cantNum * puNum,
      estatus: "PENDIENTE",
    };

    const nuevasFilas = [...rows, nueva];

    try {
      setSavingLine(true);
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: nuevasFilas,
      });
      if (onSaved) onSaved(res.data.vehiculo);
      setLine({
        cant: "", unidad: "", refaccion: "", tipo: "", marca: "",
        proveedor: "", codigo: "", precioUnitario: "", moneda: "MN",
        tiempoEntrega: "", core: "", observaciones: "",
      });
    } catch (err) {
      alert("Error al guardar la refacción.");
    } finally {
      setSavingLine(false);
    }
  };

  const handleEditRow = (idx) => {
    if (readOnly) return;
    const r = rows[idx];
    setLine({
      cant: r.cant || "", unidad: r.unidad || "", refaccion: r.refaccion || "",
      tipo: r.tipo || "", marca: r.marca || "", proveedor: r.proveedor || "",
      codigo: r.codigo || "", precioUnitario: r.precioUnitario || "",
      moneda: r.moneda || "MN", tiempoEntrega: r.tiempoEntrega || "",
      core: r.core || "", observaciones: r.observaciones || "",
    });
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveRow = async (idx) => {
    if (readOnly || !window.confirm("¿Estás seguro de eliminar esta refacción?")) return;
    const nuevasFilas = rows.filter((_, i) => i !== idx);
    try {
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: nuevasFilas,
      });
      if (onSaved) onSaved(res.data.vehiculo);
    } catch (err) {
      alert("No se pudo eliminar.");
    }
  };

  const handleSetStatus = async (idx, estatus) => {
    if (readOnly) return;
    const nuevasFilas = rows.map((r, i) => (i === idx ? { ...r, estatus } : r));
    try {
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: nuevasFilas,
      });
      if (onSaved) onSaved(res.data.vehiculo);
    } catch (err) {
      alert("Error al actualizar estatus.");
    }
  };

  const handleVerOrdenCompra = async (ordenCompraId) => {
    try {
      const resp = await http.get(`/ordenes-compra/${ordenCompraId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      alert("No se pudo abrir el PDF.");
    }
  };

  const handleGenerarOC = async (idx) => {
    if (readOnly) return;
    const ref = rows[idx];
    if (ref.ocGenerada) return ref.ordenCompra && handleVerOrdenCompra(ref.ordenCompra);
    if (ref.estatus !== "APROBADA") return alert("Solo refacciones APROBADAS.");
    if (!window.confirm("¿Generar orden de compra?")) return;

    try {
      const data = await generarOrdenCompra(orden._id, ref);
      const res = await http.get(`/vehiculos/${orden._id}`);
      if (onSaved) onSaved(res.data.vehiculo);
      if (data.ordenCompraId) await handleVerOrdenCompra(data.ordenCompraId);
    } catch (err) {
      alert("Error al generar OC.");
    }
  };

  const handleSave = async () => {
    if (readOnly) return;
    try {
      setSaving(true);
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: rows,
        estadoOrden: "PENDIENTE_AUTORIZACION",
      });
      if (onSaved) onSaved(res.data.vehiculo);
      alert("Enviado al asesor.");
    } catch (err) {
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const guardarDiagnosticoEnHistorial = async () => {
    if (readOnly || !diagnostico.trim()) return;
    try {
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: rows,
        guardarEnHistorial: true,
      });
      if (onSaved) onSaved(res.data.vehiculo);
      alert("Guardado en historial.");
    } catch (err) {
      alert("Error al guardar en historial.");
    }
  };

  const totalGeneral = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.importeTotal) || 0), 0), [rows]);
  const totalCargos = useMemo(() => cargos.reduce((acc, c) => acc + (Number(c.importeTotal) || 0), 0), [cargos]);
  const formatMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
  const badgeClass = (s) => `badge ${s === "APROBADA" ? "bg-success" : s === "RECHAZADA" ? "bg-danger" : "bg-secondary"}`;

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="flex-grow-1 me-3">
            <label className="form-label">Diagnóstico del Técnico:</label>
            <textarea
              className="form-control"
              rows={3}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              disabled={readOnly}
            />
            <div className="mt-2">
              <button type="button" className="btn btn-outline-success btn-sm" onClick={guardarDiagnosticoEnHistorial} disabled={readOnly}>
                Guardar en historial del vehículo
              </button>
            </div>
            <div className="border mt-2 p-2" style={{ maxHeight: "180px", overflowY: "auto" }}>
              {historialDiagnosticos.length === 0 && <small className="text-muted">Sin diagnósticos previos.</small>}
              {historialDiagnosticos.slice().reverse().map((d, idx) => (
                <div key={idx} className="d-flex justify-content-between align-items-start mb-2">
                  <div style={{ maxWidth: "78%" }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{d.texto}</div>
                    <small className="text-muted">{d.fecha ? new Date(d.fecha).toLocaleString("es-MX") : ""}</small>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setDiagnostico(d.texto || "")} disabled={readOnly}>Usar</button>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || readOnly}>
              {saving ? "Enviando..." : "Enviar Orden a Asesor"}
            </button>
          </div>
        </div>

        <h5 className="text-center mb-2 fw-bold">REFACCIONES SOLICITADAS</h5>
        <div className="table-responsive mb-2">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Cant</th><th>Unidad</th><th>Refacción</th><th>Tipo</th><th>Marca</th><th>Proveedor</th><th>Código</th>
                <th>Precio Unitario</th><th>Importe Total</th><th>Moneda</th><th>Tiempo Entrega</th><th>Observaciones</th>
                <th>Estatus</th><th>Orden compra</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={15} className="text-center text-muted">No hay refacciones capturadas.</td></tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="text-center">{r.cant}</td>
                    <td className="text-center">{r.unidad}</td>
                    <td>{r.refaccion}</td>
                    <td className="text-center">{r.tipo}</td>
                    <td className="text-center">{r.marca}</td>
                    <td className="text-center">{r.proveedor}</td>
                    <td className="text-center">{r.codigo}</td>
                    <td className="text-end">{formatMoney(r.precioUnitario)}</td>
                    <td className="text-end">{formatMoney(r.importeTotal)}</td>
                    <td className="text-center">{r.moneda}</td>
                    <td className="text-center">{r.tiempoEntrega}</td>
                    <td>{r.observaciones}</td>
                    <td className="text-center"><span className={badgeClass(r.estatus)}>{r.estatus}</span></td>
                    <td className="text-center">
                      {r.ocGenerada ? (
                        <button type="button" className="btn btn-info btn-sm" onClick={() => handleVerOrdenCompra(r.ordenCompra)}>
                          {r.numeroOC ? `OC ${r.numeroOC}` : "Ver OC"}
                        </button>
                      ) : (
                        <input type="checkbox" onChange={() => handleGenerarOC(idx)} disabled={readOnly || r.estatus !== "APROBADA"} />
                      )}
                    </td>
                    <td className="text-center">
                      <div className="btn-group-vertical btn-group-sm">
                        <button type="button" className="btn btn-warning" onClick={() => handleEditRow(idx)} disabled={readOnly}>Editar</button>
                        <button type="button" className="btn btn-danger" onClick={() => handleRemoveRow(idx)} disabled={readOnly}>Borrar</button>
                        <button type="button" className="btn btn-success" onClick={() => handleSetStatus(idx, "APROBADA")} disabled={readOnly}>Autorizado</button>
                        <button type="button" className="btn btn-outline-danger" onClick={() => handleSetStatus(idx, "RECHAZADA")} disabled={readOnly}>Rechazado</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className="text-end fw-bold">Total:</td>
                <td className="text-end fw-bold">{formatMoney(totalGeneral)}</td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Línea de captura (solo visible si no es readOnly) */}
        {!readOnly && (
          <div className="table-responsive mb-4">
            <table className="table table-bordered table-sm align-middle mb-0">
              <thead className="table-light text-center">
                <tr>
                  <th>Cant</th><th>Unidad</th><th>Refacción</th><th>Tipo</th><th>Marca</th><th>Proveedor</th><th>Código</th>
                  <th>Precio Unitario</th><th>Moneda</th><th>Tiempo Entrega</th><th>Core</th><th>Observaciones</th><th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ width: "70px" }}><input type="number" className="form-control form-control-sm" name="cant" value={line.cant} onChange={handleLineChange} /></td>
                  <td style={{ width: "90px" }}><input type="text" className="form-control form-control-sm" name="unidad" value={line.unidad} onChange={handleLineChange} /></td>
                  <td><input type="text" className="form-control form-control-sm" name="refaccion" value={line.refaccion} onChange={handleLineChange} /></td>
                  <td style={{ width: "120px" }}>
                    <select className="form-select form-select-sm" name="tipo" value={line.tipo} onChange={handleLineChange}>
                      <option value="">Selec...</option><option value="Original">Original</option><option value="Alterna">Alterna</option>
                    </select>
                  </td>
                  <td style={{ width: "120px" }}><input type="text" className="form-control form-control-sm" name="marca" value={line.marca} onChange={handleLineChange} /></td>
                  <td style={{ width: "120px" }}><input type="text" className="form-control form-control-sm" name="proveedor" value={line.proveedor} onChange={handleLineChange} /></td>
                  <td style={{ width: "110px" }}><input type="text" className="form-control form-control-sm" name="codigo" value={line.codigo} onChange={handleLineChange} /></td>
                  <td style={{ width: "120px" }}><input type="number" step="0.01" className="form-control form-control-sm" name="precioUnitario" value={line.precioUnitario} onChange={handleLineChange} /></td>
                  <td style={{ width: "90px" }}>
                    <select className="form-select form-select-sm" name="moneda" value={line.moneda} onChange={handleLineChange}>
                      <option value="MN">MN</option><option value="USD">USD</option>
                    </select>
                  </td>
                  <td style={{ width: "110px" }}><input type="text" className="form-control form-control-sm" name="tiempoEntrega" value={line.tiempoEntrega} onChange={handleLineChange} /></td>
                  <td style={{ width: "100px" }}><input type="text" className="form-control form-control-sm" name="core" value={line.core} onChange={handleLineChange} /></td>
                  <td><input type="text" className="form-control form-control-sm" name="observaciones" value={line.observaciones} onChange={handleLineChange} /></td>
                  <td className="text-center" style={{ width: "70px" }}>
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleAddLine} disabled={savingLine}>
                      {savingLine ? "..." : "+"}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <h5 className="text-center mb-2 fw-bold">CARGOS EN ORDEN</h5>
        <div className="table-responsive">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Cant</th><th>Unidad</th><th>Refacción y/o Servicio</th><th>Marca</th><th>Proveedor</th><th>Código</th>
                <th>Precio Unitario</th><th>Importe Total</th><th>Moneda</th><th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {cargos.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-muted">No hay cargos registrados.</td></tr>
              ) : (
                cargos.map((c, idx) => (
                  <tr key={idx}>
                    <td className="text-center">{c.cant}</td><td className="text-center">{c.unidad}</td><td>{c.refaccion}</td>
                    <td className="text-center">{c.marca}</td><td className="text-center">{c.proveedor}</td><td className="text-center">{c.codigo}</td>
                    <td className="text-end">{formatMoney(c.precioUnitario)}</td><td className="text-end">{formatMoney(c.importeTotal)}</td>
                    <td className="text-center">{c.moneda}</td><td>{c.observaciones}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="text-end fw-bold">Total:</td>
                <td className="text-end fw-bold">{formatMoney(totalCargos)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}