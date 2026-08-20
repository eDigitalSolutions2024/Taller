// backend/service/cajaComprobantePdf.js
// Comprobantes de Caja: Nota de Venta y Remisión (media carta, branding propio).
const puppeteer = require('puppeteer');
const dayjs = require('dayjs');
const { calcularTotalesOrden } = require('../utils/cajaTotales');

function esc(str) {
  return (str ?? '').toString();
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function nombreCliente(orden) {
  return (
    orden.nombreGobierno ||
    [orden.nombreCliente, orden.apellidoPaterno, orden.apellidoMaterno].filter(Boolean).join(' ') ||
    'CLIENTE GENERAL'
  );
}

function buildHtml(orden, pago, comprobante) {
  const esNota = comprobante === 'NOTA_VENTA';
  const titulo = esNota ? 'NOTA DE VENTA' : 'REMISIÓN';
  const folio = esNota ? pago.notaVenta?.numero : pago.remision?.numero;
  const tipo = esNota ? pago.notaVenta?.tipo : pago.remision?.tipo;
  const totales = calcularTotalesOrden(orden);

  const conceptosRows = (orden.ventaCliente || [])
    .map(
      (r) => `<tr>
        <td class="tc">${esc(r.cant)}</td>
        <td>${esc(r.concepto)}</td>
        <td class="tr">${fmtMoney(r.precioVenta)}</td>
        <td class="tr">${fmtMoney(Number(r.cant || 0) * Number(r.precioVenta || 0))}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: Letter portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }
  .tc { text-align: center; }
  .tr { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.8px solid #000; padding: 3px 5px; }
  .noborder td { border: none; }
  .hdr { margin-bottom: 6px; }
  .biz-name { font-size: 13px; font-weight: bold; text-transform: uppercase; }
  .biz-info { font-size: 8.5px; line-height: 1.4; }
  .titulo { background: #000; color: #fff; text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1px; padding: 4px; }
  .folio { color: #c00; font-weight: bold; font-size: 14px; }
  .lbl { background: #e8e8e8; font-weight: bold; width: 22%; }
  .sec { background: #e8e8e8; font-weight: bold; text-align: center; }
  .cancelado { color: #c00; border: 3px solid #c00; text-align: center; font-size: 18px; font-weight: bold; padding: 6px; margin-top: 8px; transform: rotate(-4deg); }
</style>
</head>
<body>

<table class="noborder hdr">
  <tr>
    <td style="width: 55%; vertical-align: top;">
      <div class="biz-name">Autoservicio D y G</div>
      <div class="biz-info">
        Servicios Profesionales de Inyección<br>
        Av. Valentín Fuentes Varela #1779, Col. La Fuente, Juárez, Chih. (32370)<br>
        Tel. (656) *********
      </div>
    </td>
    <td style="width: 45%; vertical-align: top; text-align: right;">
      <div class="titulo">${titulo}</div>
      <div style="margin-top: 4px;">Folio: <span class="folio">${esc(folio ?? '')}</span></div>
      <div>Fecha: ${dayjs(pago.fecha).format('DD/MM/YYYY HH:mm')}</div>
      ${tipo ? `<div>Tipo: <strong>${esc(tipo)}</strong></div>` : ''}
    </td>
  </tr>
</table>

<table style="margin-bottom: 6px;">
  <tr>
    <td class="lbl">CLIENTE</td>
    <td>${esc(nombreCliente(orden))}</td>
    <td class="lbl">ORDEN DE SERVICIO</td>
    <td class="tc"><strong>${esc(orden.ordenServicio)}</strong></td>
  </tr>
  <tr>
    <td class="lbl">VEHÍCULO</td>
    <td>${esc([orden.marca, orden.modelo, orden.anio].filter(Boolean).join(' '))}</td>
    <td class="lbl">PLACAS</td>
    <td class="tc">${esc(orden.placas || '')}</td>
  </tr>
</table>

<table style="margin-bottom: 6px;">
  <thead>
    <tr>
      <th class="sec" style="width: 10%;">Cant.</th>
      <th class="sec">Concepto</th>
      <th class="sec" style="width: 18%;">Precio</th>
      <th class="sec" style="width: 18%;">Importe</th>
    </tr>
  </thead>
  <tbody>
    ${conceptosRows || '<tr><td colspan="4" class="tc">Sin conceptos capturados.</td></tr>'}
  </tbody>
  <tfoot>
    <tr><td colspan="3" class="tr" style="font-weight:bold;">Subtotal</td><td class="tr">${fmtMoney(totales.subtotal)}</td></tr>
    <tr><td colspan="3" class="tr" style="font-weight:bold;">IVA (${totales.ivaPct}%)</td><td class="tr">${fmtMoney(totales.ivaMonto)}</td></tr>
    ${totales.descuentoMonto > 0 ? `<tr><td colspan="3" class="tr" style="font-weight:bold;">Descuentos</td><td class="tr">-${fmtMoney(totales.descuentoMonto)}</td></tr>` : ''}
    <tr><td colspan="3" class="tr" style="font-weight:bold; background:#000; color:#fff;">TOTAL DE LA ORDEN</td><td class="tr" style="font-weight:bold; background:#000; color:#fff;">${fmtMoney(totales.totalOrden)}</td></tr>
  </tfoot>
</table>

<table style="margin-bottom: 6px;">
  <tr>
    <td class="lbl">MONTO DE ESTE PAGO</td>
    <td class="tr" style="font-weight:bold;">${fmtMoney(pago.monto)}</td>
    <td class="lbl">TOTAL ABONADO</td>
    <td class="tr">${fmtMoney(totales.totalAbonado)}</td>
  </tr>
  <tr>
    ${esNota && pago.notaVenta?.banco ? `<td class="lbl">BANCO</td><td>${esc(pago.notaVenta.banco)}</td>` : '<td class="lbl">REFERENCIA</td><td>' + esc(pago.referencia || '') + '</td>'}
    <td class="lbl">SALDO PENDIENTE</td>
    <td class="tr" style="font-weight:bold;">${fmtMoney(totales.saldoPendiente)}</td>
  </tr>
  ${pago.observaciones ? `<tr><td class="lbl">OBSERVACIONES</td><td colspan="3">${esc(pago.observaciones)}</td></tr>` : ''}
</table>

${pago.cancelado ? `<div class="cancelado">CANCELADO — ${esc(pago.motivoCancelacion || '')}</div>` : ''}

<table class="noborder" style="margin-top: 18mm;">
  <tr>
    <td class="tc" style="width: 45%;">___________________________<br>RECIBIÓ (CAJA)</td>
    <td style="width: 10%;"></td>
    <td class="tc" style="width: 45%;">___________________________<br>CLIENTE</td>
  </tr>
</table>

</body>
</html>`;
}

async function generarComprobanteCajaPDF(res, orden, pago, comprobante) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(buildHtml(orden, pago, comprobante), { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
  });

  await browser.close();

  const nombre = comprobante === 'NOTA_VENTA' ? 'nota_venta' : 'remision';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombre}_${orden.ordenServicio || orden._id}.pdf"`);
  res.send(pdfBuffer);
}

module.exports = { generarComprobanteCajaPDF };
