// backend/service/cierreCajaPdf.js
const puppeteer = require('puppeteer');
const { calcularTotalesCierre, TERMINALES_KEYS } = require('../utils/cierreCajaTotales');

function esc(str) {
  return (str ?? '').toString();
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function fmtFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildHtml(cierre) {
  const totales = calcularTotalesCierre(cierre);

  const filasBilletes = (cierre.billetes || [])
    .map(
      (b) => `<tr>
        <td>${fmtMoney(b.denominacion)}</td>
        <td class="tr">${Number(b.cantidad) || 0}</td>
        <td class="tr">${fmtMoney(b.denominacion * (Number(b.cantidad) || 0))}</td>
      </tr>`
    )
    .join('');

  const filasMonedas = (cierre.monedas || [])
    .map(
      (m) => `<tr>
        <td>${fmtMoney(m.denominacion)}</td>
        <td class="tr">${Number(m.cantidad) || 0}</td>
        <td class="tr">${fmtMoney(m.denominacion * (Number(m.cantidad) || 0))}</td>
      </tr>`
    )
    .join('');

  const filasTerminales = TERMINALES_KEYS.map(
    (k) => `<tr><td>${esc(k)}</td><td class="tr">${fmtMoney(cierre.terminales?.[k])}</td></tr>`
  ).join('');

  const filasComprobantes = (cierre.comprobantes || [])
    .map(
      (c) => `<tr>
        <td>${esc(c.ordenServicio)}</td>
        <td>${esc(c.tipoLabel)}</td>
        <td>${esc(c.folio ?? '-')}</td>
        <td>${esc(c.cliente)}</td>
        <td class="tr">${fmtMoney(c.monto)}</td>
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
  .tr { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  td, th { border: 0.8px solid #000; padding: 3px 5px; }
  .noborder td { border: none; }
  .hdr { margin-bottom: 6px; }
  .biz-name { font-size: 13px; font-weight: bold; text-transform: uppercase; }
  .biz-info { font-size: 8.5px; line-height: 1.4; }
  .titulo { background: #000; color: #fff; text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1px; padding: 4px; margin-bottom: 8px; }
  .sec { background: #e8e8e8; font-weight: bold; }
  .cols { display: flex; gap: 12px; }
  .col { flex: 1; }
  .total-row td { font-weight: bold; background: #f2f2f2; }
  .resumen td { padding: 4px 6px; }
  .diferencia { font-weight: bold; }
  .diferencia.neg { color: #c00; }
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
      <div class="biz-info">
        Fecha del corte: <strong>${fmtFecha(cierre.fecha)}</strong><br>
        Estado: <strong>${cierre.estado === 'CERRADA' ? 'CERRADA' : 'ABIERTA'}</strong><br>
        ${cierre.estado === 'CERRADA' ? `Cerrada por: ${esc(cierre.cerradoPor)}` : `Última captura: ${esc(cierre.capturadoPor)}`}
      </div>
    </td>
  </tr>
</table>

<div class="titulo">CIERRE DE CAJA</div>

<div class="cols">
  <div class="col">
    <table>
      <thead><tr class="sec"><th colspan="3">Billetes</th></tr></thead>
      <tbody>${filasBilletes}</tbody>
      <tfoot><tr class="total-row"><td colspan="2">Total</td><td class="tr">${fmtMoney(totales.totalBilletes)}</td></tr></tfoot>
    </table>
  </div>
  <div class="col">
    <table>
      <thead><tr class="sec"><th colspan="3">Monedas</th></tr></thead>
      <tbody>${filasMonedas}</tbody>
      <tfoot><tr class="total-row"><td colspan="2">Total</td><td class="tr">${fmtMoney(totales.totalMonedas)}</td></tr></tfoot>
    </table>
  </div>
</div>

<div class="cols">
  <div class="col">
    <table>
      <thead><tr class="sec"><th colspan="2">Terminales</th></tr></thead>
      <tbody>${filasTerminales}</tbody>
      <tfoot><tr class="total-row"><td>Total</td><td class="tr">${fmtMoney(totales.totalTerminales)}</td></tr></tfoot>
    </table>
  </div>
  <div class="col">
    <table>
      <thead><tr class="sec"><th colspan="2">Dólares</th></tr></thead>
      <tbody>
        <tr><td>Cantidad (USD)</td><td class="tr">${Number(cierre.dolares?.cantidad) || 0}</td></tr>
        <tr><td>Tipo de cambio</td><td class="tr">${Number(cierre.dolares?.tipoCambio) || 0}</td></tr>
      </tbody>
      <tfoot><tr class="total-row"><td>Total</td><td class="tr">${fmtMoney(totales.totalDolares)}</td></tr></tfoot>
    </table>
  </div>
</div>

<table class="resumen">
  <tbody>
    <tr><td>Total Cobrado</td><td class="tr">${fmtMoney(totales.totalCobrado)}</td></tr>
    <tr><td>Total Reportes (sistema)</td><td class="tr">${fmtMoney(cierre.totalReportes)}</td></tr>
    <tr><td>Fondo de Caja</td><td class="tr">${fmtMoney(cierre.fondoCaja)}</td></tr>
    <tr><td class="diferencia ${totales.diferencia < 0 ? 'neg' : ''}">Diferencia</td><td class="tr diferencia ${totales.diferencia < 0 ? 'neg' : ''}">${fmtMoney(totales.diferencia)}</td></tr>
  </tbody>
</table>

<table>
  <thead><tr class="sec"><th>Orden</th><th>Tipo</th><th>Folio</th><th>Cliente</th><th>Monto</th></tr></thead>
  <tbody>${filasComprobantes || '<tr><td colspan="5">Sin comprobantes generados.</td></tr>'}</tbody>
</table>

</body>
</html>`;
}

async function streamCierreCajaPdf(res, cierre) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(buildHtml(cierre), { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
  });

  await browser.close();

  const fechaStr = new Date(cierre.fecha).toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="cierre_caja_${fechaStr}.pdf"`);
  res.send(pdfBuffer);
}

module.exports = { streamCierreCajaPdf };
