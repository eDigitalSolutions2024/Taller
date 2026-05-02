// src/pages/vehiculo/VehiculoPresupuestoVenta.jsx
import React, { useEffect, useMemo, useState } from "react";
import { openPresupuestoPdf, savePresupuestoVenta } from "../../api/vehiculos";

export default function VehiculoPresupuestoVenta({ orden, onSaved, empleados = [] }) {
  // --- LÓGICA DE BLOQUEO POR ORDEN CERRADA ---
  const isClosed = orden?.estadoOrden === "CERRADA";

  // Datos de encabezado
  const [dirigidoA, setDirigidoA] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [observCotizacion, setObservCotizacion] = useState("");

  // ===== VENTA AL CLIENTE =====
  const [ventaRows, setVentaRows] = useState([]);
  const [ventaLine, setVentaLine] = useState({
    cant: "",
    concepto: "",
    precioVenta: "",
    observaciones: "",
  });
  const [presRows, setPresRows] = useState([]);
  const [newPresLine, setNewPresLine] = useState({
    cant: "", concepto: "", refaccion: "", tipo: "", marca: "", 
    proveedor: "", codigo: "", precioCompra: "", tiempoEntrega: "", 
    horasMO: "", precioVenta: "", observInt: ""
  });

  // ===== MANO DE OBRA =====
  const [moRows, setMoRows] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [moLine, setMoLine] = useState({
    concepto: "",
    mecanico: "",
    horas: "",
    fechaPago: "",
    observaciones: "",
  });

  // ===== OBSERVACIONES FINALES =====
  const [obsExternas, setObsExternas] = useState("");
  const [obsInternas, setObsInternas] = useState("");

  const [editingCell, setEditingCell] = useState({ row: null, field: null });

  useEffect(() => {
    if (!orden) return;

    // 1. Lo que el usuario ya guardó en el presupuesto
    const presupuestoGuardado = Array.isArray(orden.presupuesto) ? orden.presupuesto : [];

    // 2. Obtener TODAS las refacciones solicitadas de la orden
    const refSolicitadas = orden.refaccionesSolicitadas || [];

    // 3. Identificar cuáles de las que están en el presupuesto vienen de "Refacciones Solicitadas"
    const presupuestoActualizado = presupuestoGuardado.filter(filaPres => {
      const refOriginal = refSolicitadas.find(rs => rs.refaccion === filaPres.concepto);
      if (refOriginal) {
        return refOriginal.estatus === "APROBADA";
      }
      return true; 
    });

    // 4. Agregar las que son nuevas APROBADAS que no estaban antes
    const aprobadas = refSolicitadas.filter(r => r.estatus === "APROBADA");
    aprobadas.forEach(aprob => {
      const yaExiste = presupuestoActualizado.some(p => p.concepto === aprob.refaccion);
      if (!yaExiste) {
        presupuestoActualizado.push({
          cant: aprob.cant ?? 0,
          concepto: aprob.refaccion || "",
          refaccion: aprob.refaccion || "",
          tipo: aprob.tipo || "",
          marca: aprob.marca || "",
          proveedor: aprob.proveedor || "",
          codigo: aprob.codigo || "",
          precioCompra: aprob.precioUnitario ?? 0,
          tiempoEntrega: aprob.tiempoEntrega ?? "",
          horasMO: 0,
          precioVenta: aprob.precioUnitario ?? 0,
          observInt: aprob.observaciones ?? "",
          isRefaccionVinculada: true
        });
      }
    });

    setPresRows(presupuestoActualizado);
    
    if (orden.ventaCliente) setVentaRows(orden.ventaCliente);
    if (orden.manoObra) setMoRows(orden.manoObra);
    setObsExternas(orden.observacionesExternas || "");
    setObsInternas(orden.observacionesInternas || "");
    setDirigidoA(orden.dirigidoA || "");
    setDepartamento(orden.departamento || "");
    setObservCotizacion(orden.observCotizacion || "");

  }, [orden]);

  const addManualPresRow = async () => {
    if (isClosed) return; // Bloqueo si ya cerró
    if (!newPresLine.concepto.trim()) {
      alert("Por favor, ingresa al menos el concepto.");
      return;
    }

    const finalPrecioVenta = newPresLine.precioVenta || newPresLine.precioCompra || 0;
    const registroParaAgregar = { 
      ...newPresLine, 
      precioVenta: finalPrecioVenta 
    };

    const nuevasFilas = [...presRows, registroParaAgregar];
    setPresRows(nuevasFilas);

    try {
      const payload = {
        presupuesto: nuevasFilas,
        ventaCliente: ventaRows,
        manoObra: moRows,
        observacionesExternas: obsExternas,
        observacionesInternas: obsInternas,
        dirigidoA,
        departamento,
        observCotizacion
      };

      const res = await savePresupuestoVenta(orden._id, payload);
      if (onSaved) onSaved(res.data.vehiculo);

      setNewPresLine({
        cant: "", concepto: "", refaccion: "", tipo: "", marca: "", 
        proveedor: "", codigo: "", precioCompra: "", tiempoEntrega: "", 
        horasMO: "", precioVenta: "", observInt: ""
      });
    } catch (err) {
      console.error(err);
      alert("Error al sincronizar con el servidor.");
    }
  };

  const handleImprimir = async () => {
    try {
      const payload = {
        presupuesto: presRows,
        ventaCliente: ventaRows,
        manoObra: moRows,
        observacionesExternas: obsExternas,
        observacionesInternas: obsInternas,
        dirigidoA,
        departamento,
        observCotizacion
      };

      const res = await savePresupuestoVenta(orden._id, payload);
      if (onSaved) onSaved(res.data.vehiculo);
      openPresupuestoPdf(orden._id);
    } catch (err) {
      console.error("Error al imprimir:", err);
      alert("Error al preparar el PDF");
    }
  };
  
  const formatMoney = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(n) || 0);

  const totalPresupuesto = useMemo(
  () =>
    presRows.reduce(
      (acc, r) => acc + (Number(r.cant || 0) * Number(r.precioVenta || 0)),
      0
    ),
  [presRows]
  );

  const totalVentaCliente = useMemo(
    () =>
      ventaRows.reduce(
        (acc, r) => acc + (Number(r.cant || 0) * Number(r.precioVenta || 0)),
        0
      ),
    [ventaRows]
  );

  const handleVentaLineChange = (e) => {
    if (isClosed) return;
    const { name, value } = e.target;
    setVentaLine((prev) => ({ ...prev, [name]: value }));
  };

  const handleMoLineChange = (e) => {
    if (isClosed) return;
    const { name, value } = e.target;
    setMoLine((prev) => ({ ...prev, [name]: value }));
  };

  const inputProps = (idx, field, defaultValue) => ({
    defaultValue: defaultValue,
    autoFocus: true,
    disabled: isClosed, // Deshabilita inputs de edición rápida
    className: "form-control form-control-sm",
    onBlur: (e) => handleUpdate(idx, field, e.target.value),
    onKeyDown: (e) => {
      if (e.key === 'Enter') handleUpdate(idx, field, e.target.value);
      if (e.key === 'Escape') setEditingCell({ row: null, field: null });
    }
  });

  const handleUpdate = (idx, field, value) => {
    if (isClosed) return;
    const newRows = [...presRows];
    newRows[idx][field] = value;
    if (field === 'precioCompra') {
      newRows[idx]['precioVenta'] = value;
    }
    setPresRows(newRows);
  };

  const handleUpdateMO = (idx, field, value) => {
    if (isClosed) return;
    const newMoRows = [...moRows];
    newMoRows[idx][field] = value;
    setMoRows(newMoRows);
  };

  const removePresRow = async (idx) => {
    if (isClosed) return;
    const nuevasFilas = presRows.filter((_, i) => i !== idx);
    setPresRows(nuevasFilas);
    try {
      const res = await savePresupuestoVenta(orden._id, {
        presupuesto: nuevasFilas,
        ventaCliente: ventaRows,
        manoObra: moRows
      });
      if (onSaved) onSaved(res.data.vehiculo);
    } catch (err) {
      alert("Error al eliminar la fila en el servidor.");
    }
  };

  const addVentaRow = () => {
    if (isClosed) return;
    const cant = Number(ventaLine.cant) || 0;
    if (!cant || !ventaLine.concepto.trim()) {
      alert("En venta al cliente captura al menos Cantidad y Concepto.");
      return;
    }
    setVentaRows((prev) => [...prev, { ...ventaLine, cant }]);
    setVentaLine({ cant: "", concepto: "", precioVenta: "", observaciones: "" });
  };

  const removeVentaRow = (idx) => {
    if (isClosed) return;
    setVentaRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addMoRow = () => {
    if (isClosed) return;
    if (!moLine.concepto.trim()) {
      alert("En mano de obra captura al menos el concepto/servicio.");
      return;
    }
    setMoRows((prev) => [...prev, moLine]);
    setMoLine({ concepto: "", mecanico: "", horas: "", fechaPago: "", observaciones: "" });
  };

  const removeMoRow = (idx) => {
    if (isClosed) return;
    setMoRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEnviar = () => {
    if (isClosed) return;
    alert("Luego conectamos 'Enviar' al flujo de asesor / ventas.");
  };

  const handleAutorizar = async () => {
    if (isClosed) return;
    try {
      if (presRows.length === 0) {
        alert("No hay partidas de presupuesto para autorizar.");
        return;
      }
      const nuevasVentas = presRows.map((r) => ({
        cant: r.cant || 0,
        concepto: r.concepto || r.refaccion || "",
        precioVenta: Number(r.precioVenta) || 0,
        observaciones: "",
      }));
      setVentaRows(nuevasVentas);
      const payload = {
        presupuesto: presRows,
        ventaCliente: nuevasVentas,
      };
      const res = await savePresupuestoVenta(orden._id, payload);
      if (onSaved) onSaved(res.data.vehiculo);
      alert("Presupuesto autorizado y enviado a Venta al Cliente.");
    } catch (err) {
      console.error(err);
      alert("Error al autorizar el presupuesto.");
    }
  };

  const handleGuardarOrdenServicio = async () => {
    if (isClosed) return;
    try {
      const payload = {
        presupuesto: presRows,
        ventaCliente: ventaRows,
        manoObra: moRows,
        observacionesExternas: obsExternas,
        observacionesInternas: obsInternas,
      };
      const res = await savePresupuestoVenta(orden._id, payload);
      if (onSaved) onSaved(res.data.vehiculo);
      alert("Orden de servicio guardada correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la orden de servicio.");
    }
  };

  const handleRechazar = () => { if (isClosed) return; alert("Rechazado..."); };
  const handleRegresarRefaccionaria = () => { if (isClosed) return; alert("Regresando..."); };

  const handleEditClick = (idx) => {
    if (isClosed) return;
    setEditingCell({ row: idx, field: 'all' });
  };

  const handleSaveEdit = () => {
    setEditingCell({ row: null, field: null });
  };

return (
    <div className="card">
      <div className="card-body">
        {/* ===== Encabezado ===== */}
        <h5 className="text-center mb-3 fw-bold">
          PRESUPUESTO Y VENTA AL CLIENTE
        </h5>

        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Dirigido a:</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={dirigidoA}
              disabled={isClosed}
              onChange={(e) => setDirigidoA(e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Departamento:</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={departamento}
              disabled={isClosed}
              onChange={(e) => setDepartamento(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label">Observaciones en Cotización:</label>
          <textarea
            className="form-control"
            rows={2}
            value={observCotizacion}
            disabled={isClosed}
            onChange={(e) => setObservCotizacion(e.target.value)}
          />
        </div>

        {/* =================== PRESUPUESTO =================== */}
        <h5 className="text-center mb-2 fw-bold">PRESUPUESTO</h5>

        <div className="table-responsive mb-2">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Cantidad</th>
                <th>Concepto, Servicio y/o Reparación</th>
                <th>Refacción</th>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Proveedor</th>
                <th>Código</th>
                <th>Precio Compra</th>
                <th>Tiempo Entrega</th>
                <th>M.O. (Hrs)</th>
                <th>Precio Venta (Sin IVA)</th>
                <th className="table-secondary">Importe</th>
                <th>Obs. Internas</th>
                <th style={{ width: "100px" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {presRows.map((r, idx) => {
                const isEditingRow = editingCell.row === idx && editingCell.field === 'all';
                const importeFila = (Number(r.cant) || 0) * (Number(r.precioVenta) || 0);

                return (
                  <tr key={idx} className={isEditingRow ? "table-warning" : ""}>
                    <td>
                      {isEditingRow ? (
                        <input type="number" className="form-control form-control-sm" value={r.cant} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'cant', e.target.value)} />
                      ) : (r.cant)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.concepto} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'concepto', e.target.value)} />
                      ) : (r.concepto)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.refaccion} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'refaccion', e.target.value)} />
                      ) : (r.refaccion)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <select className="form-select form-select-sm" value={r.tipo} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'tipo', e.target.value)}>
                          <option value="">Selec...</option>
                          <option value="Original">Original</option>
                          <option value="Alterna">Alterna</option>
                        </select>
                      ) : (r.tipo)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.marca} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'marca', e.target.value)} />
                      ) : (r.marca)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.proveedor} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'proveedor', e.target.value)} />
                      ) : (r.proveedor)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.codigo} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'codigo', e.target.value)} />
                      ) : (r.codigo)}
                    </td>
                    <td className="text-end">
                      {isEditingRow ? (
                        <input type="number" className="form-control form-control-sm" value={r.precioCompra} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'precioCompra', e.target.value)} />
                      ) : (formatMoney(r.precioCompra))}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.tiempoEntrega} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'tiempoEntrega', e.target.value)} />
                      ) : (r.tiempoEntrega)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="number" className="form-control form-control-sm" value={r.horasMO} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'horasMO', e.target.value)} />
                      ) : (r.horasMO)}
                    </td>
                    <td className="text-end">
                      {isEditingRow ? (
                        <input type="number" className="form-control form-control-sm" value={r.precioVenta} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'precioVenta', e.target.value)} />
                      ) : (formatMoney(r.precioVenta))}
                    </td>
                    <td className="text-end fw-bold bg-light">
                      {formatMoney(importeFila)}
                    </td>
                    <td>
                      {isEditingRow ? (
                        <input type="text" className="form-control form-control-sm" value={r.observInt} disabled={isClosed} onChange={(e) => handleUpdate(idx, 'observInt', e.target.value)} />
                      ) : (r.observInt)}
                    </td>
                    <td className="text-center">
                      {isEditingRow ? (
                        <button type="button" className="btn btn-sm btn-success w-100" onClick={handleSaveEdit}>Listo</button>
                      ) : (
                        <div className="btn-group-vertical w-100">
                          <button type="button" className="btn btn-sm btn-outline-primary" disabled={isClosed} onClick={() => handleEditClick(idx)}>Editar</button>
                          <button type="button" className="btn btn-sm btn-danger" disabled={isClosed} onClick={() => removePresRow(idx)}>Borrar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Fila Azul de Captura */}
              {!isClosed && (
                <tr className="table-info">
                  <td><input type="number" className="form-control form-control-sm" value={newPresLine.cant} onChange={e => setNewPresLine({...newPresLine, cant: e.target.value})} /></td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.concepto} onChange={e => setNewPresLine({...newPresLine, concepto: e.target.value})} /></td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.refaccion} onChange={e => setNewPresLine({...newPresLine, refaccion: e.target.value})} /></td>
                  <td>
                    <select className="form-select form-select-sm" value={newPresLine.tipo} onChange={e => setNewPresLine({...newPresLine, tipo: e.target.value})}>
                      <option value="">Selec...</option>
                      <option value="Original">Original</option>
                      <option value="Alterna">Alterna</option>
                    </select>
                  </td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.marca} onChange={e => setNewPresLine({...newPresLine, marca: e.target.value})} /></td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.proveedor} onChange={e => setNewPresLine({...newPresLine, proveedor: e.target.value})} /></td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.codigo} onChange={e => setNewPresLine({...newPresLine, codigo: e.target.value})} /></td>
                  <td><input type="number" className="form-control form-control-sm" value={newPresLine.precioCompra} onChange={e => setNewPresLine({...newPresLine, precioCompra: e.target.value})} /></td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.tiempoEntrega} onChange={e => setNewPresLine({...newPresLine, tiempoEntrega: e.target.value})} /></td>
                  <td><input type="number" className="form-control form-control-sm" value={newPresLine.horasMO} onChange={e => setNewPresLine({...newPresLine, horasMO: e.target.value})} /></td>
                  <td><input type="number" className="form-control form-control-sm" value={newPresLine.precioVenta} onChange={e => setNewPresLine({...newPresLine, precioVenta: e.target.value})} /></td>
                  <td className="bg-info-subtle"></td>
                  <td><input type="text" className="form-control form-control-sm" value={newPresLine.observInt} onChange={e => setNewPresLine({...newPresLine, observInt: e.target.value})} /></td>
                  <td className="text-center">
                    <button type="button" className="btn btn-sm btn-danger fw-bold w-100" onClick={addManualPresRow}>+</button>
                  </td>
                </tr>
              )}
            </tbody>
            
            <tfoot className="table-light">
              <tr>
                <td colSpan={11} className="text-end fw-bold text-uppercase">Total Presupuesto:</td>
                <td className="text-end fw-bold text-white bg-primary" style={{ fontSize: '1.1rem' }}>
                  {formatMoney(totalPresupuesto)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="d-flex justify-content-end gap-2 mb-4">
          <button type="button" className="btn btn-danger btn-sm shadow-sm" onClick={handleImprimir}>Imprimir</button>
          <button type="button" className="btn btn-success btn-sm" disabled={isClosed} onClick={handleEnviar}>Enviar</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={isClosed} onClick={handleAutorizar}>Autorizado</button>
          <button type="button" className="btn btn-outline-danger btn-sm" disabled={isClosed} onClick={handleRechazar}>Rechazado</button>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={isClosed} onClick={handleRegresarRefaccionaria}>Regresar a Refaccionaria</button>
        </div>

        {/* =================== VENTA AL CLIENTE =================== */}
        <h5 className="text-center mb-2 fw-bold">VENTA AL CLIENTE (CIERRE DE ORDEN)</h5>

        {!isClosed && (
          <div className="table-responsive mb-2">
            <table className="table table-bordered table-sm align-middle mb-0">
              <thead className="table-light text-center">
                <tr>
                  <th>Cantidad</th>
                  <th>Concepto, Servicio y/o Reparación</th>
                  <th>Precio Venta (Sin IVA)</th>
                  <th>Observaciones</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ width: "70px" }}>
                    <input type="number" className="form-control form-control-sm" name="cant" value={ventaLine.cant} onChange={handleVentaLineChange} />
                  </td>
                  <td>
                    <input type="text" className="form-control form-control-sm" name="concepto" value={ventaLine.concepto} onChange={handleVentaLineChange} />
                  </td>
                  <td style={{ width: "140px" }}>
                    <input type="number" step="0.01" className="form-control form-control-sm" name="precioVenta" value={ventaLine.precioVenta} onChange={handleVentaLineChange} />
                  </td>
                  <td>
                    <input type="text" className="form-control form-control-sm" name="observaciones" value={ventaLine.observaciones} onChange={handleVentaLineChange} />
                  </td>
                  <td className="text-center" style={{ width: "70px" }}>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addVentaRow}>+</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="table-responsive mb-4">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Cantidad</th>
                <th>Concepto, Servicio y/o Reparación</th>
                <th>Precio Venta (Sin IVA)</th>
                <th>Observaciones</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {ventaRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted">No hay partidas de venta al cliente.</td>
                </tr>
              )}
              {ventaRows.map((r, idx) => (
                <tr key={idx}>
                  <td className="text-center" onDoubleClick={() => !isClosed && setEditingCell({row: idx, field:'cant'})}> 
                    {editingCell.row === idx && editingCell.field === 'cant' ? (
                      <input {...inputProps(idx,'cant',r.cant)}/>
                    ) : (r.cant)}
                  </td>
                  <td>{r.concepto}</td>
                  <td className="text-end">{formatMoney(r.precioVenta)}</td>
                  <td>{r.observaciones}</td>
                  <td className="text-center">
                    <button type="button" className="btn btn-sm btn-danger" disabled={isClosed} onClick={() => removeVentaRow(idx)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}></td>
                <td className="text-end fw-bold">{formatMoney(totalVentaCliente)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* =================== MANO DE OBRA =================== */}
        <h5 className="text-center mb-2 fw-bold">MANO DE OBRA</h5>

        {!isClosed && (
          <div className="table-responsive mb-2">
            <table className="table table-bordered table-sm align-middle mb-0">
              <thead className="table-light text-center">
                <tr>
                  <th>Reparación y/o Servicio</th>
                  <th>Mecánico</th>
                  <th>Horas</th>
                  <th>Fecha de Pago</th>
                  <th>Observaciones</th>
                  <th style={{ width: "70px" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><input type="text" className="form-control form-control-sm" name="concepto" value={moLine.concepto} onChange={handleMoLineChange} /></td>
                  <td style={{ width: "200px" }}>
                    <select className="form-select form-select-sm" name="mecanico" value={moLine.mecanico} onChange={handleMoLineChange}>
                      <option value="">Seleccionar...</option>
                      {empleados.map((emp) => (<option key={emp._id} value={emp.nombre}>{emp.nombre}</option>))}
                    </select>
                  </td>
                  <td style={{ width: "80px" }}><input type="number" className="form-control form-control-sm" name="horas" value={moLine.horas} onChange={handleMoLineChange} /></td>
                  <td style={{ width: "150px" }}><input type="date" className="form-control form-control-sm" name="fechaPago" value={moLine.fechaPago} onChange={handleMoLineChange} /></td>
                  <td><input type="text" className="form-control form-control-sm" name="observaciones" value={moLine.observaciones} onChange={handleMoLineChange} /></td>
                  <td className="text-center"><button type="button" className="btn btn-sm btn-primary" onClick={addMoRow}>+</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="table-responsive mb-4">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-dark text-center">
              <tr>
                <th>Reparación y/o Servicio</th>
                <th>Mecánico</th>
                <th>Horas</th>
                <th>Fecha de Pago</th>
                <th>Observaciones</th>
                <th style={{ width: "100px" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {moRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No hay registros.</td></tr>
              ) : (
                moRows.map((row, idx) => {
                  const isEditing = editIdx === idx;
                  return (
                    <tr key={idx} className={isEditing ? "table-info" : ""}>
                      <td><input type="text" className={`form-control form-control-sm ${!isEditing ? "form-control-plaintext" : ""}`} value={row.concepto} readOnly={!isEditing || isClosed} onChange={(e) => handleUpdateMO(idx, "concepto", e.target.value)} /></td>
                      <td style={{ width: "200px" }}>
                        <select className="form-select form-select-sm" value={row.mecanico || ""} disabled={!isEditing && !isClosed ? false : (isClosed || !isEditing)} onChange={(e) => handleUpdateMO(idx, "mecanico", e.target.value)}>
                          <option value="">-- Asignar --</option>
                          {empleados.map((emp) => (<option key={emp._id} value={emp.nombre}>{emp.nombre}</option>))}
                        </select>
                      </td>
                      <td style={{ width: "80px" }}><input type="number" className={`form-control form-control-sm text-center ${!isEditing ? "form-control-plaintext" : ""}`} value={row.horas} readOnly={!isEditing || isClosed} onChange={(e) => handleUpdateMO(idx, "horas", e.target.value)} /></td>
                      <td style={{ width: "150px" }}><input type="date" className={`form-control form-control-sm ${!isEditing ? "form-control-plaintext" : ""}`} value={row.fechaPago || ""} readOnly={!isEditing || isClosed} onChange={(e) => handleUpdateMO(idx, "fechaPago", e.target.value)} /></td>
                      <td><input type="text" className={`form-control form-control-sm ${!isEditing ? "form-control-plaintext" : ""}`} value={row.observaciones || ""} readOnly={!isEditing || isClosed} onChange={(e) => handleUpdateMO(idx, "observaciones", e.target.value)} /></td>
                      <td className="text-center">
                        {isEditing ? (
                          <button type="button" className="btn btn-sm btn-success" onClick={() => setEditIdx(null)}>✔</button>
                        ) : (
                          <div className="btn-group">
                            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isClosed} onClick={() => setEditIdx(idx)}>Editar</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" disabled={isClosed} onClick={() => removeMoRow(idx)}>X</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =================== OBSERVACIONES FINALES =================== */}
        <h5 className="text-center mb-2 fw-bold">OBSERVACIONES</h5>
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Observaciones Externas:</label>
            <textarea className="form-control" rows={3} value={obsExternas} disabled={isClosed} onChange={(e) => setObsExternas(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Observaciones Internas:</label>
            <textarea className="form-control" rows={3} value={obsInternas} disabled={isClosed} onChange={(e) => setObsInternas(e.target.value)} />
          </div>
        </div>

        <div className="d-flex justify-content-end">
          <button type="button" className="btn btn-primary btn-sm" disabled={isClosed} onClick={handleGuardarOrdenServicio}>
            Guardar Orden de Servicio
          </button>
        </div>

        <p className="mt-2 text-muted" style={{ fontSize: "12px" }}>
          * Favor de aprobar o rechazar todas las partidas para cerrar la orden de servicio.
        </p>
      </div>
    </div>
  );
}