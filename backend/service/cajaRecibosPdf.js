// backend/service/cajaRecibosPdf.js
// Recibo Provisional (abonos/anticipos) y Recibo de Dólares (media carta,
// branding propio).
const puppeteer = require('puppeteer');
const dayjs = require('dayjs');
const { calcularTotalesOrden } = require('../utils/cajaTotales');

function esc(str) {
  return (str ?? '').toString();
}

function fmtMoney(n, currency = 'MXN') {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency });
}

function nombreCliente(orden) {
  return (
    orden.nombreGobierno ||
    [orden.nombreCliente, orden.apellidoPaterno, orden.apellidoMaterno].filter(Boolean).join(' ') ||
    'CLIENTE GENERAL'
  );
}

const HEADER = `
  <table class="noborder hdr">
    <tr>
      <td style="width: 60%; vertical-align: top;">
        <div class="biz-name">Autoservicio D y G</div>
        <div class="biz-info">
          Servicios Profesionales de Inyección<br>
          Av. Valentín Fuentes Varela #1779, Col. La Fuente, Juárez, Chih. (32370)<br>
          Tel. (656) *********
        </div>
      </td>
      <td style="width: 40%; vertical-align: top; text-align: right;" id="titulo-slot"></td>
    </tr>
  </table>`;

const BASE_CSS = `
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
  .lbl { background: #e8e8e8; font-weight: bold; width: 25%; }
  .cancelado { color: #c00; border: 3px solid #c00; text-align: center; font-size: 18px; font-weight: bold; padding: 6px; margin-top: 8px; transform: rotate(-4deg); }
  .firmas { margin-top: 18mm; }
`;

async function renderPdf(res, html, filename) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
  });

  await browser.close();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(pdfBuffer);
}

async function generarReciboProvisionalPDF(res, orden, pago) {
  const rp = pago.reciboProvisional || {};
  const totales = calcularTotalesOrden(orden);

  const titulo = `
    <div class="titulo">RECIBO PROVISIONAL</div>
    <div style="margin-top: 4px;">Folio: <span class="folio">${esc(rp.numero ?? '')}</span></div>
    <div>Fecha: ${dayjs(pago.fecha).format('DD/MM/YYYY HH:mm')}</div>
    <div>Tipo: <strong>${esc(pago.tipoPago)}</strong></div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>
${HEADER.replace('<td style="width: 40%; vertical-align: top; text-align: right;" id="titulo-slot"></td>', `<td style="width: 40%; vertical-align: top; text-align: right;">${titulo}</td>`)}

<table style="margin-bottom: 6px;">
  <tr>
    <td class="lbl">RECIBIMOS DE</td>
    <td colspan="3">${esc(nombreCliente(orden))}</td>
  </tr>
  <tr>
    <td class="lbl">LA CANTIDAD DE</td>
    <td class="tr" style="font-weight:bold; font-size: 12px;">${fmtMoney(pago.monto)}</td>
    <td class="lbl">FORMA DE PAGO</td>
    <td>${esc(rp.formaPago || '')}${rp.formaPago === 'CHEQUE' && rp.chequeNumero ? ` — Cheque #${esc(rp.chequeNumero)}` : ''}</td>
  </tr>
  <tr>
    <td class="lbl">POR CONCEPTO DE</td>
    <td colspan="3">${esc(rp.concepto || `Abono a la orden de servicio ${orden.ordenServicio || ''}`)}</td>
  </tr>
  ${rp.razon ? `<tr><td class="lbl">RAZÓN</td><td colspan="3">${esc(rp.razon)}</td></tr>` : ''}
  <tr>
    <td class="lbl">ORDEN DE SERVICIO</td>
    <td class="tc"><strong>${esc(orden.ordenServicio || '')}</strong></td>
    <td class="lbl">SALDO PENDIENTE</td>
    <td class="tr" style="font-weight:bold;">${fmtMoney(totales.saldoPendiente)}</td>
  </tr>
</table>

${pago.cancelado ? `<div class="cancelado">CANCELADO — ${esc(pago.motivoCancelacion || '')}</div>` : ''}

<table class="noborder firmas">
  <tr>
    <td class="tc" style="width: 45%;">___________________________<br>RECIBIÓ${rp.recibio ? `<br>${esc(rp.recibio)}` : ''}</td>
    <td style="width: 10%;"></td>
    <td class="tc" style="width: 45%;">___________________________<br>AUTORIZÓ${rp.autorizo ? `<br>${esc(rp.autorizo)}` : ''}</td>
  </tr>
</table>

</body></html>`;

  await renderPdf(res, html, `recibo_provisional_${orden.ordenServicio || orden._id}.pdf`);
}

async function generarReciboDolaresPDF(res, orden, pago) {
  const rd = pago.reciboDolares || {};

  const titulo = `
    <div class="titulo">RECIBO DE DÓLARES</div>
    <div style="margin-top: 4px;">Folio: <span class="folio">${esc(rd.numero ?? '')}</span></div>
    <div>Fecha: ${dayjs(pago.fecha).format('DD/MM/YYYY HH:mm')}</div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>
${HEADER.replace('<td style="width: 40%; vertical-align: top; text-align: right;" id="titulo-slot"></td>', `<td style="width: 40%; vertical-align: top; text-align: right;">${titulo}</td>`)}

<table style="margin-bottom: 6px;">
  <tr>
    <td class="lbl">RECIBIMOS DE</td>
    <td colspan="3">${esc(nombreCliente(orden))}</td>
  </tr>
  <tr>
    <td class="lbl">DÓLARES RECIBIDOS</td>
    <td class="tr" style="font-weight:bold; font-size: 12px;">${fmtMoney(pago.montoDolares, 'USD')}</td>
    <td class="lbl">TIPO DE CAMBIO</td>
    <td class="tr">${Number(pago.tipoCambio || 0).toFixed(4)}</td>
  </tr>
  <tr>
    <td class="lbl">EQUIVALENTE EN PESOS</td>
    <td class="tr" style="font-weight:bold;">${fmtMoney(Number(pago.montoDolares || 0) * Number(pago.tipoCambio || 0))}</td>
    <td class="lbl">ORDEN DE SERVICIO</td>
    <td class="tc"><strong>${esc(orden.ordenServicio || '')}</strong></td>
  </tr>
</table>

${pago.cancelado ? `<div class="cancelado">CANCELADO — ${esc(pago.motivoCancelacion || '')}</div>` : ''}

<table class="noborder firmas">
  <tr>
    <td class="tc" style="width: 45%;">___________________________<br>RECIBIÓ (CAJA)</td>
    <td style="width: 10%;"></td>
    <td class="tc" style="width: 45%;">___________________________<br>CLIENTE</td>
  </tr>
</table>

</body></html>`;

  await renderPdf(res, html, `recibo_dolares_${orden.ordenServicio || orden._id}.pdf`);
}

module.exports = { generarReciboProvisionalPDF, generarReciboDolaresPDF };
