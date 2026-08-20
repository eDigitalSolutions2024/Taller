// src/pages/vehiculo/VehiculoRequisicionDiagnostico.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  saveRequisicionDiagnostico,
  updateHistorialDiagnostico,
  generarOrdenCompra,
} from "../../api/vehiculos";
import http from "../../api/http";

// Modal para corregir el texto de una entrada ya guardada en el historial de
// diagnósticos (no cambia la fecha original, solo el texto).
function EditarDiagnosticoModal({ entry, saving, onSave, onClose }) {
  const [texto, setTexto] = useState(entry?.texto || "");

  if (!entry) return null;

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Editar diagnóstico</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            <small className="text-muted d-block mb-2">
              {entry.fecha ? new Date(entry.fecha).toLocaleString("es-MX") : ""}
            </small>
            <textarea
              className="form-control"
              rows={5}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => onSave(texto)}
              disabled={saving || !texto.trim()}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VehiculoRequisicionDiagnostico({ orden, onSaved, onGoPresupuesto, readOnly = false }) {
  const [diagnostico, setDiagnostico]     = useState("");
  const [rows, setRows]                   = useState([]);
  const [cargos, setCargos]               = useState([]);
  const [saving, setSaving]               = useState(false);
  const [savingLine, setSavingLine]       = useState(false);
  const [historialDiagnosticos, setHistorialDiagnosticos] = useState([]);
  const [editEntry, setEditEntry]         = useState(null);
  const [savingEdit, setSavingEdit]       = useState(false);

  // El tab "req" hace polling cada 8s (ver VehiculoOrdenDetalle.jsx) para
  // reflejar en vivo las cotizaciones de refaccionaria, y cada refresh trae
  // un objeto `orden` nuevo. El diagnóstico es texto libre que el técnico
  // captura y solo se guarda al pulsar un botón explícito: si se
  // reinicializara en cada refresh, el polling borraría lo que aún no se
  // había guardado. Por eso se inicializa una sola vez por orden (id), no en
  // cada cambio de `orden`.
  useEffect(() => {
    if (!orden) return;
    setDiagnostico(orden.diagnosticoTecnico || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden?._id]);

  // El diagnóstico es texto libre: no se guarda solo mientras el técnico
  // escribe, solo cuando pulsa una acción explícita ("Guardar en historial
  // del vehículo", "Guardar selección", "Continuar a Presupuesto", etc.),
  // que ya mandan `diagnostico` en su payload.
  const handleDiagnosticoChange = (e) => {
    setDiagnostico(e.target.value);
  };

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orden) return;

    setHistorialDiagnosticos(orden.historialDiagnosticos || []);

    const refConEstatus = (orden.refaccionesSolicitadas || []).map((r) => ({
      ...r,
      cant: Number(r.cant || 0),
      estatus: r.estatus || "PENDIENTE",
      opcionSeleccionada:
        r.opcionSeleccionada === undefined ? null : r.opcionSeleccionada,
      opciones: Array.isArray(r.opciones)
        ? r.opciones.map((op) => ({
            ...op,
            precioUnitario: Number(op.precioUnitario || 0),
            tipoCambio: op.moneda === "USD" ? Number(op.tipoCambio || 0) : 0,
            importeTotal:
              Number(op.importeTotal || 0) ||
              Number(r.cant || 0) *
                Number(op.precioUnitario || 0) *
                (op.moneda === "USD" ? Number(op.tipoCambio || 0) : 1),
            precioCore: op.core === "SI" ? Number(op.precioCore || 0) : 0,
            moneda: op.moneda || "MN",
            seleccionada: !!op.seleccionada,
          }))
        : [],
      requiereOC: !!r.requiereOC,
      ocGenerada:  !!r.ocGenerada,
      numeroOC:    r.numeroOC    || null,
      ordenCompra: r.ordenCompra || null,
    }));

    setRows(refConEstatus);
    setCargos(orden.cargosEnOrden || []);
  }, [orden]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const formatMoney = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(n) || 0);

  const badgeClass = (estatus) => {
    switch (estatus) {
      case "APROBADA":  return "badge bg-success";
      case "RECHAZADA": return "badge bg-danger";
      default:          return "badge bg-secondary";
    }
  };

  const getSeleccionadas = () =>
    rows.filter((r) => r.estatus === "APROBADA" && r.opcionSeleccionada !== null);

  // ── Guardar diagnóstico en historial ────────────────────────────────────
  const guardarDiagnosticoEnHistorial = async () => {
    if (!diagnostico.trim()) return;
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

  // ── Editar una entrada ya guardada en el historial ──────────────────────
  const handleGuardarEdicionHistorial = async (nuevoTexto) => {
    if (!editEntry?._id) return;
    try {
      setSavingEdit(true);
      const res = await updateHistorialDiagnostico(orden._id, editEntry._id, nuevoTexto);
      if (onSaved && res?.data?.vehiculo) onSaved(res.data.vehiculo);
      setHistorialDiagnosticos((prev) =>
        prev.map((d) => (d._id === editEntry._id ? { ...d, texto: nuevoTexto } : d))
      );
      setEditEntry(null);
    } catch (err) {
      alert("Error al editar el diagnóstico.");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Guardar payload base ─────────────────────────────────────────────────
  const guardarRequisicion = async (estadoOrden) => {
    const payload = {
      diagnosticoTecnico: diagnostico,
      refacciones: rows,
    };
    if (estadoOrden) payload.estadoOrden = estadoOrden;

    const res = await saveRequisicionDiagnostico(orden._id, payload);
    const vAct = res.data.vehiculo;
    if (onSaved) onSaved(vAct);
    return vAct;
  };

  // ── Botones principales ──────────────────────────────────────────────────
  const handleGuardarSeleccion = async () => {
    try {
      setSaving(true);
      await guardarRequisicion();
      alert("Selección guardada correctamente.");
    } catch (err) {
      alert("Error al guardar la selección.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegresarRefaccionaria = async () => {
    if (!window.confirm("¿Deseas regresar esta orden a refaccionaria?")) return;
    try {
      setSaving(true);
      await guardarRequisicion("PENDIENTE_REFACCIONARIA");
      alert("Orden regresada a refaccionaria.");
    } catch (err) {
      alert("Error al regresar la orden a refaccionaria.");
    } finally {
      setSaving(false);
    }
  };

  const handleContinuarPresupuesto = async () => {
    // Si el asesor omitió refacciones (orden de puros servicios), no hay
    // nada que seleccionar aquí: se deja pasar directo a Presupuesto.
    if (getSeleccionadas().length === 0 && !orden?.refaccionesOmitidas) {
      alert("Selecciona al menos una refacción para continuar al presupuesto.");
      return;
    }
    try {
      setSaving(true);
      await guardarRequisicion("PENDIENTE_AUTORIZACION_CLIENTE");
      alert("Refacciones enviadas a presupuesto.");
      if (onGoPresupuesto) onGoPresupuesto();
    } catch (err) {
      alert("Error al continuar a presupuesto.");
    } finally {
      setSaving(false);
    }
  };

  // ── Elegir / quitar opción ───────────────────────────────────────────────
  const handleSeleccionarOpcion = async (refIdx, opIdx) => {
    const ref   = rows[refIdx];
    const opcion = ref?.opciones?.[opIdx];
    if (!opcion) return;

    const cant       = Number(ref.cant || 0);
    const precio     = Number(opcion.precioUnitario || 0);
    const moneda     = opcion.moneda || "MN";
    const tipoCambio = moneda === "USD" ? Number(opcion.tipoCambio || 0) : 0;
    const importe    = cant * precio * (moneda === "USD" ? tipoCambio : 1);

    const nuevasFilas = rows.map((r, i) => {
      if (i !== refIdx) return r;
      return {
        ...r,
        unidad:        opcion.unidad       || r.unidad || "",
        tipo:          opcion.tipo         || "",
        marca:         opcion.marca        || "",
        proveedor:     opcion.proveedor    || "",
        codigo:        opcion.codigo       || "",
        precioUnitario: precio,
        tipoCambio,
        importeTotal:  importe,
        moneda,
        tiempoEntrega: opcion.tiempoEntrega || "",
        core:          opcion.core          || "",
        precioCore:    Number(opcion.precioCore || 0),
        observaciones: opcion.observaciones || "",
        opcionSeleccionada: opIdx,
        opciones: (r.opciones || []).map((op, idx) => ({
          ...op,
          seleccionada: idx === opIdx,
        })),
        estatus: "APROBADA",
      };
    });

    setRows(nuevasFilas);
    try {
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: nuevasFilas,
      });
      // Sincroniza de inmediato la orden del padre con la respuesta del
      // servidor: si no se hace, el padre solo se entera de esta selección
      // hasta el siguiente poll (cada 8s en el tab "req"), y si ese poll
      // llega a dispararse antes de que este guardado termine, pisa la
      // selección recién hecha con datos viejos (se ve "elegida" y luego,
      // sin razón aparente, deja de estarlo).
      if (onSaved && res?.data?.vehiculo) onSaved(res.data.vehiculo);
    } catch (err) {
      alert("Error al elegir la refacción.");
    }
  };

  const handleQuitarSeleccion = async (refIdx) => {
    const nuevasFilas = rows.map((r, i) => {
      if (i !== refIdx) return r;
      return {
        ...r,
        tipo: "", marca: "", proveedor: "", codigo: "",
        precioUnitario: 0, importeTotal: 0,
        tiempoEntrega: "", core: "", precioCore: 0, observaciones: "",
        opcionSeleccionada: null,
        opciones: (r.opciones || []).map((op) => ({ ...op, seleccionada: false })),
        estatus: "PENDIENTE",
      };
    });
    setRows(nuevasFilas);
    try {
      const res = await saveRequisicionDiagnostico(orden._id, {
        diagnosticoTecnico: diagnostico,
        refacciones: nuevasFilas,
      });
      if (onSaved && res?.data?.vehiculo) onSaved(res.data.vehiculo);
    } catch (err) {
      alert("Error al quitar la selección.");
    }
  };

  // ── Orden de compra ──────────────────────────────────────────────────────
  const handleVerOrdenCompra = async (ordenCompraId) => {
    if (!ordenCompraId) return;
    try {
      const resp = await http.get(`/ordenes-compra/${ordenCompraId}/pdf`, { responseType: "blob" });
      const url  = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      alert("No se pudo abrir el PDF de la orden de compra.");
    }
  };

  const handleGenerarOC = async (idx) => {
    const ref = rows[idx];
    if (ref.ocGenerada) {
      if (ref.ordenCompra) await handleVerOrdenCompra(ref.ordenCompra);
      else alert("Esta refacción ya tiene una OC generada.");
      return;
    }
    if (ref.estatus !== "APROBADA") {
      alert("Solo se puede generar orden de compra para refacciones APROBADAS.");
      return;
    }
    if (!window.confirm("¿Generar orden de compra para esta refacción?")) return;

    const prevRows = rows;
    setRows(rows.map((r, i) => i === idx ? { ...r, _ocLoading: true } : r));

    try {
      const data = await generarOrdenCompra(orden._id, ref);
      setRows(rows.map((r, i) =>
        i === idx
          ? { ...r, _ocLoading: false, ocGenerada: true, requiereOC: true,
              numeroOC: data.numeroOC || null, ordenCompra: data.ordenCompraId || null }
          : r
      ));
      alert(data.numeroOC ? `Orden de compra generada: ${data.numeroOC}` : "Orden de compra generada.");
      if (data.ordenCompraId) await handleVerOrdenCompra(data.ordenCompraId);
    } catch (err) {
      alert("Error al generar la orden de compra.");
      setRows(prevRows);
    }
  };

  // ── Totales ──────────────────────────────────────────────────────────────
  const totalSeleccionadas = useMemo(
    () => getSeleccionadas().reduce((acc, r) => acc + (Number(r.importeTotal) || 0), 0),
    [rows]
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <div className="card">
      <div className="card-body">

        {/* ── Diagnóstico ──────────────────────────────────────────────── */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="flex-grow-1 me-3">
            <label className="form-label">Diagnóstico del Técnico:</label>
            <textarea
              className="form-control"
              rows={3}
              value={diagnostico}
              onChange={handleDiagnosticoChange}
              disabled={readOnly}
            />

            <div className="mt-2">
              <button
                type="button"
                className="btn btn-outline-success btn-sm"
                onClick={guardarDiagnosticoEnHistorial}
                disabled={readOnly}
              >
                Guardar en historial del vehículo
              </button>
            </div>

            {/* Historial */}
            <div className="border mt-2 p-2" style={{ maxHeight: "180px", overflowY: "auto" }}>
              {historialDiagnosticos.length === 0 && (
                <small className="text-muted">Sin diagnósticos previos.</small>
              )}
              {historialDiagnosticos.slice().reverse().map((d, idx) => (
                <div key={d._id || idx} className="d-flex justify-content-between align-items-start mb-2">
                  <div style={{ maxWidth: "78%" }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{d.texto}</div>
                    <small className="text-muted">
                      {d.fecha ? new Date(d.fecha).toLocaleString("es-MX") : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setEditEntry(d)}
                    disabled={!d._id}
                    title={!d._id ? "Esta entrada es de un formato antiguo y no se puede editar" : undefined}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Botones principales */}
          {!readOnly && (
            <div className="mt-4 d-flex flex-column gap-2 align-items-stretch">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleGuardarSeleccion}
                disabled={saving}
              >
                Guardar selección
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleRegresarRefaccionaria}
                disabled={saving}
              >
                Regresar a Refaccionaria
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleContinuarPresupuesto}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Continuar a Presupuesto"}
              </button>
            </div>
          )}
        </div>

        {/* ── Opciones de refacciones ───────────────────────────────────── */}
        <h5 className="text-center mb-2 fw-bold">OPCIONES DE REFACCIONES</h5>

        <div className="mb-4">
          {rows.length === 0 && (
            <div className="alert alert-info text-center">
              No hay refacciones solicitadas.
            </div>
          )}

          {rows.map((r, idx) => (
            <div className="border rounded mb-3" key={idx}>
              <div className="bg-light px-3 py-2 d-flex justify-content-between align-items-center">
                <div>
                  <strong>{r.refaccion}</strong>
                  <span className="ms-3">Cantidad: {r.cant}</span>
                  {r.unidad && <span className="ms-2">({r.unidad})</span>}
                </div>
                <span className={badgeClass(r.estatus || "PENDIENTE")}>
                  {r.estatus || "PENDIENTE"}
                </span>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered table-sm align-middle mb-0">
                  <thead className="table-light text-center">
                    <tr>
                      <th>Tipo</th>
                      <th>Marca</th>
                      <th>Proveedor</th>
                      <th>Código</th>
                      <th>Precio</th>
                      <th>Importe</th>
                      <th>Moneda</th>
                      <th>Tipo Cambio</th>
                      <th>Tiempo</th>
                      <th>Core</th>
                      <th>Precio Core</th>
                      <th>Observaciones</th>
                      <th style={{ width: "110px" }}>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(!r.opciones || r.opciones.length === 0) && (
                      <tr>
                        <td colSpan={13} className="text-center text-muted">
                          Refaccionaria aún no agregó opciones.
                        </td>
                      </tr>
                    )}

                    {(r.opciones || []).map((op, opIdx) => (
                      <tr key={opIdx} className={op.seleccionada ? "table-success" : ""}>
                        <td className="text-center">{op.tipo         || "-"}</td>
                        <td>{op.marca        || "-"}</td>
                        <td>{op.proveedor    || "-"}</td>
                        <td>{op.codigo       || "-"}</td>
                        <td className="text-end">{formatMoney(op.precioUnitario)}</td>
                        <td className="text-end fw-bold">{formatMoney(op.importeTotal)}</td>
                        <td className="text-center">{op.moneda || "MN"}</td>
                        <td className="text-end">
                          {(op.moneda || "MN") === "USD"
                            ? Number(op.tipoCambio || 0).toFixed(4)
                            : "-"}
                        </td>
                        <td>{op.tiempoEntrega || "-"}</td>
                        <td className="text-center">{op.core || "N/A"}</td>
                        <td className="text-end">
                          {op.precioCore ? formatMoney(op.precioCore) : "-"}
                        </td>
                        <td>{op.observaciones || "-"}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            className={
                              op.seleccionada
                                ? "btn btn-success btn-sm w-100"
                                : "btn btn-outline-primary btn-sm w-100"
                            }
                            onClick={() => handleSeleccionarOpcion(idx, opIdx)}
                            disabled={readOnly}
                          >
                            {op.seleccionada ? "Elegida ✓" : "Elegir"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* ── Refacciones seleccionadas ─────────────────────────────────── */}
        <h5 className="text-center mb-2 fw-bold">REFACCIONES SELECCIONADAS</h5>

        <div className="table-responsive mb-4">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Cant</th>
                <th>Unidad</th>
                <th>Refacción</th>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Proveedor</th>
                <th>Código</th>
                <th>Precio Unitario</th>
                <th>Importe Total</th>
                <th>Moneda</th>
                <th>Tipo Cambio</th>
                <th>Tiempo Entrega</th>
                <th>Observaciones</th>
                <th style={{ width: "100px" }}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {getSeleccionadas().length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center text-muted">
                    No hay refacciones seleccionadas.
                  </td>
                </tr>
              )}

              {rows.map((r, idx) => {
                if (r.estatus !== "APROBADA" || r.opcionSeleccionada === null) return null;

                return (
                  <tr key={idx}>
                    <td className="text-center">{r.cant}</td>
                    <td className="text-center">{r.unidad}</td>
                    <td>{r.refaccion}</td>
                    <td className="text-center">{r.tipo}</td>
                    <td>{r.marca}</td>
                    <td>{r.proveedor}</td>
                    <td>{r.codigo}</td>
                    <td className="text-end">{formatMoney(r.precioUnitario)}</td>
                    <td className="text-end fw-bold">{formatMoney(r.importeTotal)}</td>
                    <td className="text-center">{r.moneda}</td>
                    <td className="text-end">
                      {(r.moneda || "MN") === "USD"
                        ? Number(r.tipoCambio || 0).toFixed(4)
                        : "-"}
                    </td>
                    <td>{r.tiempoEntrega}</td>
                    <td>{r.observaciones}</td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm w-100"
                        onClick={() => handleQuitarSeleccion(idx)}
                        disabled={readOnly}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={8} className="text-end fw-bold">Total:</td>
                <td className="text-end fw-bold">{formatMoney(totalSeleccionadas)}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </div>

    <EditarDiagnosticoModal
      key={editEntry?._id || "closed"}
      entry={editEntry}
      saving={savingEdit}
      onSave={handleGuardarEdicionHistorial}
      onClose={() => setEditEntry(null)}
    />
    </>
  );
}