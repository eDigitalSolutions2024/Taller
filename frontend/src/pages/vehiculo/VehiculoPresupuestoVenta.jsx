// src/pages/vehiculo/VehiculoPresupuestoVenta.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function VehiculoPresupuestoVenta({ orden }) {
  // Datos de encabezado
  const [dirigidoA, setDirigidoA] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [observCotizacion, setObservCotizacion] = useState("");

  // ===== PRESUPUESTO =====
  const [presRows, setPresRows] = useState([]);
  const [presLine, setPresLine] = useState({
    cant: "",
    concepto: "",
    refaccion: "",
    tipo: "",
    marca: "",
    proveedor: "",
    codigo: "",
    precioCompra: "",
    tiempoEntrega: "",
    horasMO: "",
    precioVenta: "",
    observInt: "",
  });

  // ===== VENTA AL CLIENTE =====
  const [ventaRows, setVentaRows] = useState([]);
  const [ventaLine, setVentaLine] = useState({
    cant: "",
    concepto: "",
    precioVenta: "",
    observaciones: "",
  });

  // ===== MANO DE OBRA =====
  const [moRows, setMoRows] = useState([]);
  const [moLine, setMoLine] = useState({
    concepto: "",
    mecanico: "",
    horas: "",
    fechaPago: "",
    observaciones: "",
  });

  useEffect(() => {
    if (!orden) return;

    // Aquí después podremos rellenar desde backend:
    // setPresRows(orden.presupuesto || []);
    // setVentaRows(orden.ventaCliente || []);
    // setMoRows(orden.manoObra || []);
  }, [orden]);

  const formatMoney = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(n) || 0);

  const totalPresupuesto = useMemo(
    () => presRows.reduce((acc, r) => acc + (Number(r.precioVenta) || 0), 0),
    [presRows]
  );

  const totalVentaCliente = useMemo(
    () => ventaRows.reduce((acc, r) => acc + (Number(r.precioVenta) || 0), 0),
    [ventaRows]
  );

  const handlePresLineChange = (e) => {
    const { name, value } = e.target;
    setPresLine((prev) => ({ ...prev, [name]: value }));
  };

  const handleVentaLineChange = (e) => {
    const { name, value } = e.target;
    setVentaLine((prev) => ({ ...prev, [name]: value }));
  };

  const handleMoLineChange = (e) => {
    const { name, value } = e.target;
    setMoLine((prev) => ({ ...prev, [name]: value }));
  };

  // === Acciones de línea (por ahora solo UI, sin backend) ===
  const addPresRow = () => {
    const cant = Number(presLine.cant) || 0;
    if (!cant || !presLine.concepto.trim()) {
      alert("En presupuesto captura al menos Cantidad y Concepto/Servicio.");
      return;
    }
    setPresRows((prev) => [...prev, { ...presLine, cant }]);
    setPresLine({
      cant: "",
      concepto: "",
      refaccion: "",
      tipo: "",
      marca: "",
      proveedor: "",
      codigo: "",
      precioCompra: "",
      tiempoEntrega: "",
      horasMO: "",
      precioVenta: "",
      observInt: "",
    });
  };

  const removePresRow = (idx) => {
    setPresRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addVentaRow = () => {
    const cant = Number(ventaLine.cant) || 0;
    if (!cant || !ventaLine.concepto.trim()) {
      alert("En venta al cliente captura al menos Cantidad y Concepto.");
      return;
    }
    setVentaRows((prev) => [...prev, { ...ventaLine, cant }]);
    setVentaLine({
      cant: "",
      concepto: "",
      precioVenta: "",
      observaciones: "",
    });
  };

  const removeVentaRow = (idx) => {
    setVentaRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addMoRow = () => {
    if (!moLine.concepto.trim()) {
      alert("En mano de obra captura al menos el concepto/servicio.");
      return;
    }
    setMoRows((prev) => [...prev, moLine]);
    setMoLine({
      concepto: "",
      mecanico: "",
      horas: "",
      fechaPago: "",
      observaciones: "",
    });
  };

  const removeMoRow = (idx) => {
    setMoRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Botones de la parte de arriba (Imprimir, Enviar, Autorizado, Rechazado)
  // Por ahora sólo placeholders; luego los conectamos.
  const handleGuardarPresupuesto = () => {
    alert("Luego conectamos este botón al backend para guardar presupuesto.");
  };

  const handleEnviar = () => {
    alert("Luego conectamos 'Enviar' al flujo de asesor / ventas.");
  };

  const handleAutorizar = () => {
    alert("Luego conectamos 'Autorizado' al cambio de estado de la orden.");
  };

  const handleRechazar = () => {
    alert("Luego conectamos 'Rechazado' al flujo correspondiente.");
  };

  const handleRegresarRefaccionaria = () => {
    alert("Luego definimos la lógica para regresar la orden a refaccionaria.");
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
              onChange={(e) => setDirigidoA(e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Departamento:</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={departamento}
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
            onChange={(e) => setObservCotizacion(e.target.value)}
          />
        </div>

        {/* =================== PRESUPUESTO =================== */}
        <h5 className="text-center mb-2 fw-bold">PRESUPUESTO</h5>

        {/* Línea de captura de presupuesto */}
        <div className="table-responsive mb-2">
          <table className="table table-bordered table-sm align-middle mb-0">
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
                <th>Obs. Internas</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ width: "70px" }}>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    name="cant"
                    value={presLine.cant}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="concepto"
                    value={presLine.concepto}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="refaccion"
                    value={presLine.refaccion}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "120px" }}>
                  <select
                    className="form-select form-select-sm"
                    name="tipo"
                    value={presLine.tipo}
                    onChange={handlePresLineChange}
                  >
                    <option value="">Selec...</option>
                    <option value="Original">Original</option>
                    <option value="Alterna">Alterna</option>
                  </select>
                </td>
                <td style={{ width: "120px" }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="marca"
                    value={presLine.marca}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "120px" }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="proveedor"
                    value={presLine.proveedor}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "110px" }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="codigo"
                    value={presLine.codigo}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "110px" }}>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    name="precioCompra"
                    value={presLine.precioCompra}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "110px" }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="tiempoEntrega"
                    value={presLine.tiempoEntrega}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "90px" }}>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="horasMO"
                    value={presLine.horasMO}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td style={{ width: "120px" }}>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    name="precioVenta"
                    value={presLine.precioVenta}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="observInt"
                    value={presLine.observInt}
                    onChange={handlePresLineChange}
                  />
                </td>
                <td className="text-center" style={{ width: "70px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addPresRow}
                  >
                    +
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Lista de presupuesto */}
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
                <th>Obs. Internas</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {presRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-muted">
                    No hay partidas de presupuesto.
                  </td>
                </tr>
              )}

              {presRows.map((r, idx) => (
                <tr key={idx}>
                  <td className="text-center">{r.cant}</td>
                  <td>{r.concepto}</td>
                  <td>{r.refaccion}</td>
                  <td className="text-center">{r.tipo}</td>
                  <td className="text-center">{r.marca}</td>
                  <td className="text-center">{r.proveedor}</td>
                  <td className="text-center">{r.codigo}</td>
                  <td className="text-end">{formatMoney(r.precioCompra)}</td>
                  <td className="text-center">{r.tiempoEntrega}</td>
                  <td className="text-center">{r.horasMO}</td>
                  <td className="text-end">{formatMoney(r.precioVenta)}</td>
                  <td>{r.observInt}</td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removePresRow(idx)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={10}></td>
                <td className="text-end fw-bold">Total:</td>
                <td className="text-end fw-bold">
                  {formatMoney(totalPresupuesto)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Botones estilo sistema viejo */}
        <div className="d-flex justify-content-end gap-2 mb-4">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleGuardarPresupuesto}
          >
            Guardar
          </button>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleEnviar}
          >
            Enviar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAutorizar}
          >
            Autorizado
          </button>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={handleRechazar}
          >
            Rechazado
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleRegresarRefaccionaria}
          >
            Regresar a Refaccionaria
          </button>
        </div>

        {/* =================== VENTA AL CLIENTE =================== */}
        <h5 className="text-center mb-2 fw-bold">
          VENTA AL CLIENTE (CIERRE DE ORDEN)
        </h5>

        {/* Línea de captura venta cliente */}
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
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    name="cant"
                    value={ventaLine.cant}
                    onChange={handleVentaLineChange}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="concepto"
                    value={ventaLine.concepto}
                    onChange={handleVentaLineChange}
                  />
                </td>
                <td style={{ width: "140px" }}>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    name="precioVenta"
                    value={ventaLine.precioVenta}
                    onChange={handleVentaLineChange}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="observaciones"
                    value={ventaLine.observaciones}
                    onChange={handleVentaLineChange}
                  />
                </td>
                <td className="text-center" style={{ width: "70px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addVentaRow}
                  >
                    +
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Lista venta cliente */}
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
                  <td colSpan={5} className="text-center text-muted">
                    No hay partidas de venta al cliente.
                  </td>
                </tr>
              )}

              {ventaRows.map((r, idx) => (
                <tr key={idx}>
                  <td className="text-center">{r.cant}</td>
                  <td>{r.concepto}</td>
                  <td className="text-end">
                    {formatMoney(r.precioVenta)}
                  </td>
                  <td>{r.observaciones}</td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeVentaRow(idx)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}></td>
                <td className="text-end fw-bold">
                  {formatMoney(totalVentaCliente)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* =================== MANO DE OBRA =================== */}
        <h5 className="text-center mb-2 fw-bold">MANO DE OBRA</h5>

        {/* Línea de captura mano de obra */}
        <div className="table-responsive mb-2">
          <table className="table table-bordered table-sm align-middle mb-0">
            <thead className="table-light text-center">
              <tr>
                <th>Reparación y/o Servicio</th>
                <th>Mecánico</th>
                <th>Horas</th>
                <th>Fecha de Pago</th>
                <th>Observaciones</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="concepto"
                    value={moLine.concepto}
                    onChange={handleMoLineChange}
                  />
                </td>
                <td style={{ width: "160px" }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="mecanico"
                    value={moLine.mecanico}
                    onChange={handleMoLineChange}
                  />
                </td>
                <td style={{ width: "80px" }}>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="horas"
                    value={moLine.horas}
                    onChange={handleMoLineChange}
                  />
                </td>
                <td style={{ width: "150px" }}>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="fechaPago"
                    value={moLine.fechaPago}
                    onChange={handleMoLineChange}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="observaciones"
                    value={moLine.observaciones}
                    onChange={handleMoLineChange}
                  />
                </td>
                <td className="text-center" style={{ width: "70px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addMoRow}
                  >
                    +
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Lista mano de obra */}
        <div className="table-responsive mb-4">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-light text-center">
              <tr>
                <th>Reparación y/o Servicio</th>
                <th>Mecánico</th>
                <th>Horas</th>
                <th>Fecha de Pago</th>
                <th>Observaciones</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {moRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    No hay registros de mano de obra.
                  </td>
                </tr>
              )}

              {moRows.map((m, idx) => (
                <tr key={idx}>
                  <td>{m.concepto}</td>
                  <td className="text-center">{m.mecanico}</td>
                  <td className="text-center">{m.horas}</td>
                  <td className="text-center">{m.fechaPago}</td>
                  <td>{m.observaciones}</td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeMoRow(idx)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* OBSERVACIONES FINALES (si quieres, como en el sistema viejo) */}
        {/* Aquí podríamos agregar otro textarea si en la pestaña original lo tienen */}
      </div>
    </div>
  );
}
