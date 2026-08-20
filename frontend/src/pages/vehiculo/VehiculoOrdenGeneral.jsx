// src/pages/vehiculo/VehiculoOrdenGeneral.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  closeOrden,
  restoreOrden,
  openVentaClientePdf,
  registrarPago,
  agregarDescuento,
  actualizarDescuento,
  eliminarDescuento,
} from "../../api/vehiculos";
import { calcularTotalesOrden } from "../../utils/cajaTotales";
import { formatFecha } from "../../utils/fechas";

function formatMoney(n) {
  if (n === "" || n === null || n === undefined) return "";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(n) || 0);
}

const COMPROBANTE_LABEL = {
  NOTA_VENTA: "Nota de Venta",
  REMISION: "Remisión",
  RECIBO_PROVISIONAL: "Recibo Provisional",
};

function folioComprobante(p) {
  if (p.comprobante === "NOTA_VENTA" && p.notaVenta?.numero) return `NV-${p.notaVenta.numero}`;
  if (p.comprobante === "REMISION" && p.remision?.numero) return `REM-${p.remision.numero}`;
  if (p.comprobante === "RECIBO_PROVISIONAL" && p.reciboProvisional?.numero) return `RP-${p.reciboProvisional.numero}`;
  return "-";
}

const PAGO_INICIAL = {
  tipoPago: "ABONO",
  comprobante: "RECIBO_PROVISIONAL",
  montoPesos: "",
  montoDolares: "",
  tipoCambio: "",
  referencia: "",
  observaciones: "",
  banco: "EFECTIVOS",
  formaPago: "EFECTIVO",
};

export default function VehiculoOrdenGeneral({ orden, onClosed, onRestored, esAdmin = false }) {
  const [cerrando, setCerrando] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const [mostrarPagoForm, setMostrarPagoForm] = useState(false);
  const [pagoForm, setPagoForm] = useState(PAGO_INICIAL);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [mostrarDescuentoForm, setMostrarDescuentoForm] = useState(false);
  const [descuentoForm, setDescuentoForm] = useState({ tipo: "MONTO", valor: "", motivo: "" });
  const navigate = useNavigate();

  if (!orden) return null;

  const yaCerrada = orden.estadoOrden === "CERRADA";
  const yaCancelada = orden.estadoOrden === "CANCELADA";

  const handleCerrarOrden = async () => {
    if (yaCerrada || orden.estadoOrden !== "PENDIENTE_CERRAR") return;

    const ok = window.confirm(
      "¿Seguro que deseas CERRAR esta orden de servicio? Ya no podrás modificarla."
    );
    if (!ok) return;

    try {
      setCerrando(true);
      const res = await closeOrden(orden._id);
      const vAct = res.data.vehiculo;

      if (onClosed) onClosed(vAct);
      else alert("Orden cerrada correctamente.");
      navigate("/vehiculo/consulta-ordenes-cerradas");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.msg || "Error al cerrar la orden.");
    } finally {
      setCerrando(false);
    }
  };

  const handleRestablecer = async () => {
    const ok = window.confirm("¿Restablecer esta orden a su estado anterior?");
    if (!ok) return;
    try {
      setRestableciendo(true);
      const res = await restoreOrden(orden._id);
      if (onRestored) onRestored(res.data.vehiculo);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.msg || "Error al restablecer la orden.");
    } finally {
      setRestableciendo(false);
    }
  };

  const handlePagoChange = (e) => {
    const { name, value } = e.target;
    setPagoForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    try {
      setGuardandoPago(true);
      const payload = {
        ...pagoForm,
        montoPesos: Number(pagoForm.montoPesos) || 0,
        montoDolares: Number(pagoForm.montoDolares) || 0,
        tipoCambio: Number(pagoForm.tipoCambio) || 0,
      };
      const res = await registrarPago(orden._id, payload);
      if (onClosed) onClosed(res.data.vehiculo);
      setPagoForm(PAGO_INICIAL);
      setMostrarPagoForm(false);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.msg || "No se pudo registrar el pago.");
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleAgregarDescuento = async (e) => {
    e.preventDefault();
    try {
      const res = await agregarDescuento(orden._id, {
        ...descuentoForm,
        valor: Number(descuentoForm.valor) || 0,
      });
      if (onClosed) onClosed(res.data.vehiculo);
      setDescuentoForm({ tipo: "MONTO", valor: "", motivo: "" });
      setMostrarDescuentoForm(false);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.msg || "No se pudo agregar el descuento.");
    }
  };

  const handleToggleDescuento = async (descuentoId, activo) => {
    try {
      const res = await actualizarDescuento(orden._id, descuentoId, { activo: !activo });
      if (onClosed) onClosed(res.data.vehiculo);
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar el descuento.");
    }
  };

  const handleEliminarDescuento = async (descuentoId) => {
    if (!window.confirm("¿Eliminar este descuento?")) return;
    try {
      const res = await eliminarDescuento(orden._id, descuentoId);
      if (onClosed) onClosed(res.data.vehiculo);
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el descuento.");
    }
  };

  // --- TELÉFONOS ---
  const telefonoFijo =
    (orden.telefonoFijoLada ? orden.telefonoFijoLada + " " : "") +
    (orden.telefonoFijo || "");

  let celular = "";
  if (typeof orden.celular === "string") {
    celular = orden.celular;
  } else if (orden.celular) {
    celular = [orden.celular.lada, orden.celular.numero]
      .filter(Boolean)
      .join(" ");
  }

  // --- DIRECCIÓN ---
  let direccionTexto = "";
  if (typeof orden.direccion === "string") {
    direccionTexto = orden.direccion;
  } else if (orden.direccion && typeof orden.direccion === "object") {
    direccionTexto = [
      orden.direccion.calle,
      orden.direccion.colonia,
      orden.direccion.ciudad,
      orden.direccion.estado,
      orden.direccion.cp,
    ]
      .filter(Boolean)
      .join(", ");
  } else {
    direccionTexto = [
      orden.direccionCalle,
      orden.colonia,
      orden.ciudad,
      orden.estado,
      orden.codigoPostal,
    ]
      .filter(Boolean)
      .join(", ");
  }

  // --- LISTAS ---
  const refacciones = orden.refaccionesSolicitadas || [];
  const ventaItems = orden.ventaCliente || [];
  const manoObra = orden.manoObra || [];
  const pagos = orden.pagos || [];
  const descuentos = orden.descuentos || [];

  // --- TOTALES (recalculados siempre, nunca persistidos) ---
  const totales = calcularTotalesOrden(orden);
  const ventaSubtotal = ventaItems.reduce((s, v) => s + Number(v.cant || 0) * Number(v.precioVenta || 0), 0);

  return (
    <div className="card card-body mb-4">
      {/* TÍTULO + ESTADO/CIERRE */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="mb-0">VISTA GENERAL DE LA ORDEN DE SERVICIO</h4>

        <div className="d-flex gap-2 flex-wrap">
          {orden.estadoOrden === "PENDIENTE_CERRAR" && (
            <button type="button" className="btn btn-danger btn-sm" onClick={handleCerrarOrden} disabled={cerrando}>
              {cerrando ? "Cerrando..." : "Cerrar orden"}
            </button>
          )}

          {yaCerrada && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openVentaClientePdf(orden._id)}>
              Imprimir Venta al Cliente
            </button>
          )}

          {(yaCerrada || yaCancelada) && esAdmin && (
            <button type="button" className="btn btn-warning btn-sm" onClick={handleRestablecer} disabled={restableciendo}>
              {restableciendo ? "Restableciendo..." : "Restablecer ahora"}
            </button>
          )}
        </div>
      </div>

      {/* ESTATUS */}
      <div className="text-center mb-3">
        <span className="badge bg-warning text-dark px-4 py-2">
          Estatus de la Orden de Servicio:{" "}
          <strong>{(orden.estadoOrden || "En proceso").replace(/_/g, " ")}</strong>
        </span>
        {orden.garantia && (
          <span className="badge bg-info text-dark px-3 py-2 ms-2">
            Solicitud de garantía: <strong>{orden.garantia.estado}</strong>
          </span>
        )}
      </div>

      {/* DATOS GENERALES */}
      <h5 className="mt-3 mb-2">Datos generales</h5>
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <div className="mb-1">
            <strong>Orden de Servicio:</strong>{" "}
            {orden.ordenServicio || orden._id}
          </div>
          <div className="mb-1">
            <strong>Cliente:</strong>{" "}
            {orden.nombreGobierno || [orden.nombreCliente, orden.apellidoPaterno, orden.apellidoMaterno].filter(Boolean).join(" ")}
          </div>
          <div className="mb-1">
            <strong>Teléfono fijo:</strong> {telefonoFijo}
          </div>
          <div className="mb-1">
            <strong>Celular:</strong> {celular}
          </div>
          <div className="mb-1">
            <strong>Dirección:</strong> {direccionTexto}
          </div>
          <div className="mb-1">
            <strong>RFC:</strong> {orden.rfc || ""}
          </div>
        </div>

        <div className="col-md-6">
          <div className="mb-1">
            <strong>Fecha recepción:</strong>{" "}
            {formatFecha(orden.fechaRecepcion)}
          </div>
          <div className="mb-1">
            <strong>Hora:</strong> {orden.horaRecepcion || ""}
          </div>
          <div className="mb-1">
            <strong>Marca:</strong> {orden.marca || ""}
          </div>
          <div className="mb-1">
            <strong>Modelo:</strong> {orden.modelo || ""}
          </div>
          <div className="mb-1">
            <strong>Año:</strong> {orden.anio || ""}
          </div>
          <div className="mb-1">
            <strong>Color:</strong> {orden.color || ""}
          </div>
          <div className="mb-1">
            <strong>Serie:</strong> {orden.serie || ""}
          </div>
          <div className="mb-1">
            <strong>Placas:</strong> {orden.placas || ""}
          </div>
          <div className="mb-1">
            <strong>KMS/Millas:</strong> {orden.kmsMillas || ""}
          </div>
        </div>
      </div>

      {/* COMPRAS */}
      <h5 className="mt-3 mb-2 text-center">COMPRAS (REFACCIONES)</h5>
      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Cant</th>
              <th>Unidad</th>
              <th>Refacción</th>
              <th>Marca</th>
              <th>Proveedor</th>
              <th>Código</th>
              <th>Precio Unitario</th>
              <th>Importe Total</th>
              <th>Moneda</th>
              <th>Estatus</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {refacciones.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center">
                  No hay refacciones registradas.
                </td>
              </tr>
            )}
            {refacciones.map((r, idx) => (
              <tr key={idx}>
                <td>{r.cant ?? r.cantidad}</td>
                <td>{r.unidad}</td>
                <td>{r.refaccion}</td>
                <td>{r.marca}</td>
                <td>{r.proveedor}</td>
                <td>{r.codigo}</td>
                <td>{formatMoney(r.precioUnitario)}</td>
                <td>{formatMoney(r.importeTotal)}</td>
                <td>{r.moneda}</td>
                <td>{r.estatus || ""}</td>
                <td>{r.observaciones}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* VENTA */}
      <h5 className="mt-3 mb-2 text-center">VENTA AL CLIENTE</h5>
      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Cantidad</th>
              <th>Concepto / Servicio</th>
              <th>Precio Venta (Sin IVA)</th>
              <th>Importe</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {ventaItems.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center">
                  No hay partidas de venta registradas.
                </td>
              </tr>
            )}
            {ventaItems.map((v, idx) => (
              <tr key={idx}>
                <td>{v.cant ?? 0}</td>
                <td>{v.concepto}</td>
                <td>{formatMoney(v.precioVenta)}</td>
                <td>{formatMoney(Number(v.cant || 0) * Number(v.precioVenta || 0))}</td>
                <td>{v.observaciones || ""}</td>
              </tr>
            ))}
          </tbody>
          {ventaItems.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="text-end fw-bold">Subtotal</td>
                <td colSpan={2} className="fw-bold">{formatMoney(ventaSubtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-end fw-bold">I.V.A. ({totales.ivaPct}%)</td>
                <td colSpan={2} className="fw-bold">{formatMoney(totales.ivaMonto)}</td>
              </tr>
              {totales.descuentoMonto > 0 && (
                <tr>
                  <td colSpan={3} className="text-end fw-bold">Descuentos</td>
                  <td colSpan={2} className="fw-bold">-{formatMoney(totales.descuentoMonto)}</td>
                </tr>
              )}
              <tr className="table-dark">
                <td colSpan={3} className="text-end fw-bold">TOTAL</td>
                <td colSpan={2} className="fw-bold">{formatMoney(totales.totalOrden)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* MANO DE OBRA */}
      <h5 className="mt-4 mb-2 text-center">MANO DE OBRA</h5>
      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Reparación / Servicio</th>
              <th>Mecánico / Carrocero</th>
              <th>Horas</th>
              <th>Fecha de Pago</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {manoObra.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center">
                  No hay mano de obra registrada.
                </td>
              </tr>
            )}
            {manoObra.map((m, idx) => (
              <tr key={idx}>
                <td>{m.concepto}</td>
                <td>{m.esCarroceria ? m.carrocero : m.mecanico}</td>
                <td>{m.horas}</td>
                <td>{formatFecha(m.fechaPago)}</td>
                <td>{m.observaciones}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CUENTA DE LA ORDEN */}
      <h5 className="mt-4 mb-2 text-center">CUENTA DE LA ORDEN</h5>
      <div className="row mb-2 text-center">
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">Total de la Orden</div>
            <div className="fw-bold">{formatMoney(totales.totalOrden)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">Total Abonado</div>
            <div className="fw-bold">{formatMoney(totales.totalAbonado)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">Saldo Pendiente</div>
            <div className={"fw-bold " + (totales.saldoPendiente > 0.01 ? "text-danger" : "text-success")}>
              {formatMoney(totales.saldoPendiente)}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">Fecha de Cierre</div>
            <div className="fw-bold">{formatFecha(orden.fechaCierre) || "-"}</div>
          </div>
        </div>
      </div>
      <div className="text-center mb-3">
        <span className={"badge px-3 py-2 " + (totales.saldoPendiente > 0.01 ? "bg-danger" : "bg-success")}>
          {totales.saldoPendiente > 0.01 ? "Pendiente de Pago" : "Liquidada"}
        </span>
      </div>

      {/* PAGOS */}
      <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
        <h6 className="mb-0">Pagos registrados</h6>
        {!yaCerrada && (
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setMostrarPagoForm((v) => !v)}>
            {mostrarPagoForm ? "Cancelar" : "Registrar pago"}
          </button>
        )}
      </div>

      {mostrarPagoForm && (
        <form className="card card-body bg-light mb-3" onSubmit={handleRegistrarPago}>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label mb-0">Tipo de pago</label>
              <select className="form-select form-select-sm" name="tipoPago" value={pagoForm.tipoPago} onChange={handlePagoChange}>
                <option value="ABONO">Abono</option>
                <option value="ANTICIPO">Anticipo</option>
                <option value="COMPLETO">Liquida (Completo)</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-0">Comprobante</label>
              <select className="form-select form-select-sm" name="comprobante" value={pagoForm.comprobante} onChange={handlePagoChange}>
                {pagoForm.tipoPago === "COMPLETO" ? (
                  <>
                    <option value="NOTA_VENTA">Nota de Venta</option>
                    <option value="REMISION">Remisión</option>
                  </>
                ) : (
                  <option value="RECIBO_PROVISIONAL">Recibo Provisional</option>
                )}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-0">Monto (pesos)</label>
              <input type="number" step="0.01" className="form-control form-control-sm" name="montoPesos" value={pagoForm.montoPesos} onChange={handlePagoChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label mb-0">Referencia</label>
              <input className="form-control form-control-sm" name="referencia" value={pagoForm.referencia} onChange={handlePagoChange} />
            </div>
            <div className="col-md-12">
              <label className="form-label mb-0">Observaciones</label>
              <input className="form-control form-control-sm" name="observaciones" value={pagoForm.observaciones} onChange={handlePagoChange} />
            </div>
          </div>
          <div className="text-end mt-2">
            <button className="btn btn-primary btn-sm" type="submit" disabled={guardandoPago}>
              {guardandoPago ? "Guardando..." : "Guardar pago"}
            </button>
          </div>
        </form>
      )}

      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Comprobante</th>
              <th>Monto</th>
              <th>Referencia</th>
              <th>Registró</th>
              <th>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center">
                  No hay pagos registrados.
                </td>
              </tr>
            )}
            {pagos.map((p, idx) => (
              <tr key={p._id || idx} className={p.cancelado ? "text-decoration-line-through text-muted" : ""}>
                <td>{formatFecha(p.fecha)}</td>
                <td>{p.tipoPago}</td>
                <td>{COMPROBANTE_LABEL[p.comprobante] || p.comprobante} {folioComprobante(p)}</td>
                <td>{formatMoney(p.monto)}</td>
                <td>{p.referencia}</td>
                <td>{p.registradoPor}</td>
                <td>{p.cancelado ? "Cancelado" : "Vigente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DESCUENTOS */}
      <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
        <h6 className="mb-0">Descuentos</h6>
        {!yaCerrada && (
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setMostrarDescuentoForm((v) => !v)}>
            {mostrarDescuentoForm ? "Cancelar" : "Agregar descuento"}
          </button>
        )}
      </div>

      {mostrarDescuentoForm && (
        <form className="card card-body bg-light mb-3" onSubmit={handleAgregarDescuento}>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label mb-0">Tipo</label>
              <select className="form-select form-select-sm" value={descuentoForm.tipo} onChange={(e) => setDescuentoForm((p) => ({ ...p, tipo: e.target.value }))}>
                <option value="MONTO">Monto fijo</option>
                <option value="PORCENTAJE">Porcentaje</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-0">Valor</label>
              <input type="number" step="0.01" className="form-control form-control-sm" value={descuentoForm.valor} onChange={(e) => setDescuentoForm((p) => ({ ...p, valor: e.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label mb-0">Motivo</label>
              <input className="form-control form-control-sm" value={descuentoForm.motivo} onChange={(e) => setDescuentoForm((p) => ({ ...p, motivo: e.target.value }))} />
            </div>
          </div>
          <div className="text-end mt-2">
            <button className="btn btn-primary btn-sm" type="submit">Guardar descuento</button>
          </div>
        </form>
      )}

      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Motivo</th>
              <th>Aplicó</th>
              <th>Activo</th>
              {!yaCerrada && <th></th>}
            </tr>
          </thead>
          <tbody>
            {descuentos.length === 0 && (
              <tr>
                <td colSpan={yaCerrada ? 5 : 6} className="text-center">
                  No hay descuentos registrados.
                </td>
              </tr>
            )}
            {descuentos.map((d) => (
              <tr key={d._id}>
                <td>{d.tipo}</td>
                <td>{d.tipo === "PORCENTAJE" ? `${d.valor}%` : formatMoney(d.valor)}</td>
                <td>{d.motivo}</td>
                <td>{d.aplicadoPor}</td>
                <td>{d.activo ? "Sí" : "No"}</td>
                {!yaCerrada && (
                  <td>
                    <button type="button" className="btn btn-outline-secondary btn-sm me-1" onClick={() => handleToggleDescuento(d._id, d.activo)}>
                      {d.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleEliminarDescuento(d._id)}>
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* OBSERVACIONES */}
      <h5 className="mt-4 mb-2 text-center">OBSERVACIONES</h5>
      <div className="row">
        <div className="col-md-6 mb-2">
          <strong>Observaciones externas:</strong>
          <div className="border rounded p-2" style={{ minHeight: "60px" }}>
            {orden.observacionesExternas || ""}
          </div>
        </div>
        <div className="col-md-6 mb-2">
          <strong>Observaciones internas:</strong>
          <div className="border rounded p-2" style={{ minHeight: "60px" }}>
            {orden.observacionesInternas || ""}
          </div>
        </div>
      </div>
    </div>
  );
}
