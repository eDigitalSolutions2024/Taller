import React from "react";
import { calcularTotalesCierre, TERMINALES_KEYS } from "../../../utils/cierreCajaTotales";
import { openNotaVentaPdf, openRemisionPdf, openReciboProvisionalPdf } from "../../../api/cajas";

function formatMoney(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
}

function abrirComprobantePdf(c) {
  if (!c.vehiculoId || !c.pagoId) return;
  if (c.tipo === "NOTA_VENTA") openNotaVentaPdf(c.vehiculoId, c.pagoId);
  else if (c.tipo === "REMISION") openRemisionPdf(c.vehiculoId, c.pagoId);
  else if (c.tipo === "RECIBO_PROVISIONAL") openReciboProvisionalPdf(c.vehiculoId, c.pagoId);
}

// Vista de solo lectura del cierre de caja de un día. La usa Gestión de Caja
// (resumen del día en curso). `accionesCierre` es un slot opcional (botón de
// Cerrar/Restablecer Caja) que se inserta debajo del resumen de totales.
export default function CierreCajaResumen({ cierre, accionesCierre }) {
  const totales = calcularTotalesCierre(cierre);
  const comprobantes = cierre.comprobantes || [];

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="card mb-3">
          <div className="card-header py-2 fw-bold">Billetes</div>
          <table className="table table-sm mb-0">
            <tbody>
              {(cierre.billetes || []).map((b) => (
                <tr key={b.denominacion}>
                  <td>{formatMoney(b.denominacion)}</td>
                  <td className="text-end">{Number(b.cantidad) || 0}</td>
                  <td className="text-end">{formatMoney(b.denominacion * (Number(b.cantidad) || 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-light">
                <td colSpan={2} className="fw-bold">Total</td>
                <td className="text-end fw-bold">{formatMoney(totales.totalBilletes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 fw-bold">Terminales</div>
          <table className="table table-sm mb-0">
            <tbody>
              {TERMINALES_KEYS.map((k) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="text-end">{formatMoney(cierre.terminales?.[k])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-light">
                <td className="fw-bold">Total</td>
                <td className="text-end fw-bold">{formatMoney(totales.totalTerminales)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="card-body py-2 small text-muted border-top">
            Se suman solas de los pagos del día — no se capturan a mano.
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-body py-2 d-flex justify-content-between">
            <span className="fw-bold">Total Cobrado</span>
            <span className="fw-bold">{formatMoney(totales.totalCobrado)}</span>
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="card mb-3">
          <div className="card-header py-2 fw-bold">Monedas</div>
          <table className="table table-sm mb-0">
            <tbody>
              {(cierre.monedas || []).map((m) => (
                <tr key={m.denominacion}>
                  <td>{formatMoney(m.denominacion)}</td>
                  <td className="text-end">{Number(m.cantidad) || 0}</td>
                  <td className="text-end">{formatMoney(m.denominacion * (Number(m.cantidad) || 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-light">
                <td colSpan={2} className="fw-bold">Total</td>
                <td className="text-end fw-bold">{formatMoney(totales.totalMonedas)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 fw-bold">Dólares</div>
          <div className="card-body py-2">
            <div className="d-flex justify-content-between">
              <span>Cantidad (USD)</span>
              <span>{Number(cierre.dolares?.cantidad) || 0}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>T.C.</span>
              <span>{Number(cierre.dolares?.tipoCambio) || 0}</span>
            </div>
            <div className="d-flex justify-content-between mt-2">
              <span className="fw-bold">Total</span>
              <span className="fw-bold">{formatMoney(totales.totalDolares)}</span>
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-body py-2">
            <div className="d-flex justify-content-between">
              <span className="fw-bold">Total Reportes</span>
              <span className="text-muted small">Ingresos del día registrados en el sistema</span>
            </div>
            <div className="text-end">{formatMoney(cierre.totalReportes)}</div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-body py-2 d-flex justify-content-between">
            <span className="fw-bold">Fondo de Caja</span>
            <span>{formatMoney(cierre.fondoCaja)}</span>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-body py-2 d-flex justify-content-between">
            <span className="fw-bold">Diferencia</span>
            <span className={`fw-bold ${totales.diferencia >= 0 ? "text-success" : "text-danger"}`}>
              {formatMoney(totales.diferencia)}
            </span>
          </div>
        </div>

        {accionesCierre && <div className="mb-3">{accionesCierre}</div>}

        {cierre.capturadoPor && (
          <div className="text-muted small">Última captura por: {cierre.capturadoPor}</div>
        )}
        {cierre.estado === "CERRADA" && cierre.cerradoPor && (
          <div className="text-muted small">Caja cerrada por: {cierre.cerradoPor}</div>
        )}
      </div>

      <div className="col-12">
        <div className="card mb-3">
          <div className="card-header py-2 fw-bold">Comprobantes del día</div>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Tipo</th>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th className="text-end">Monto</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted">Sin comprobantes generados.</td>
                  </tr>
                )}
                {comprobantes.map((c) => (
                  <tr
                    key={`${c.vehiculoId}-${c.pagoId}`}
                    style={{ cursor: c.vehiculoId && c.pagoId ? "pointer" : undefined }}
                    onClick={() => abrirComprobantePdf(c)}
                    title="Ver comprobante"
                  >
                    <td>{c.ordenServicio || "-"}</td>
                    <td>{c.tipoLabel}</td>
                    <td>{c.folio ?? "-"}</td>
                    <td>{c.cliente || "-"}</td>
                    <td className="text-end">{formatMoney(c.monto)}</td>
                    <td>{c.registradoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
