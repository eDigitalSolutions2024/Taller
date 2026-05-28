const puppeteer = require('puppeteer');
const dayjs = require('dayjs');

exports.generarPresupuestoPDF = async (res, orden) => {
  try {
    const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();

    const fechaActual = dayjs().format('DD/MM/YYYY');

    const fmt = n => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

    // Refacciones autorizadas
    const itemsRef = (orden.presupuesto || [])
      .filter(r => r.estatus === 'AUTORIZADO')
      .map(r => ({
        cant:     Number(r.cant || 0),
        desc:     `${r.concepto}${r.refaccion ? ' - ' + r.refaccion : ''}`,
        precio:   Number(r.precioVenta || 0),
        subtotal: Number(r.cant || 0) * Number(r.precioVenta || 0)
      }));

    // Mano de obra
    const itemsMO = (orden.manoObra || []).map(m => ({
      cant:     1,
      desc:     m.concepto,
      precio:   Number(m.precioVenta || 0),
      subtotal: Number(m.precioVenta || 0)
    }));

    const subtotalRef = itemsRef.reduce((a, i) => a + i.subtotal, 0);
    const ivaRef      = subtotalRef * 0.08;
    const totalRef    = subtotalRef + ivaRef;

    const subtotalMO  = itemsMO.reduce((a, i) => a + i.subtotal, 0);
    const ivaMO       = subtotalMO * 0.08;
    const totalMO     = subtotalMO + ivaMO;

    const subtotalG   = subtotalRef + subtotalMO;
    const ivaG        = subtotalG * 0.08;
    const totalG      = subtotalG + ivaG;

    const MIN_ROWS = 14;
    const maxRows  = Math.max(MIN_ROWS, itemsRef.length, itemsMO.length);

    const emptyRow = `
      <tr>
        <td class="tc">&nbsp;</td>
        <td></td>
        <td class="tr money">$&nbsp;-</td>
        <td class="tr money">$&nbsp;-</td>
      </tr>`;

    const refRows = Array.from({ length: maxRows }, (_, i) => {
      const r = itemsRef[i];
      if (!r) return emptyRow;
      return `<tr>
        <td class="tc">${r.cant}</td>
        <td class="tl">${r.desc}</td>
        <td class="tr money">$${fmt(r.precio)}</td>
        <td class="tr money">$${fmt(r.subtotal)}</td>
      </tr>`;
    }).join('');

    const moRows = Array.from({ length: maxRows }, (_, i) => {
      const m = itemsMO[i];
      if (!m) return emptyRow;
      return `<tr>
        <td class="tc">${m.cant}</td>
        <td class="tl">${m.desc}</td>
        <td class="tr money">$${fmt(m.precio)}</td>
        <td class="tr money">$${fmt(m.subtotal)}</td>
      </tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: Letter; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 8.5px; color: #111; }

  /* ── HEADER ── */
  .header { display: flex; align-items: flex-start; gap: 4px; margin-bottom: 4px; }
  .logo-box {
    width: 26mm; height: 20mm; border: 1px solid #999;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; color: #666; flex-shrink: 0;
  }
  .company-info { flex: 1; font-size: 7.5px; line-height: 1.5; }
  .company-name { font-size: 10px; font-weight: bold; text-transform: uppercase; }
  .doc-title {
    flex: 2; text-align: center; font-size: 13px;
    font-weight: bold; text-transform: uppercase; padding-top: 4px;
  }

  /* ── CLIENTE / VEHÍCULO ── */
  .cv-wrap { display: flex; gap: 4px; margin-bottom: 4px; }
  .client-block { flex: 1; }
  .vehicle-block { width: 60mm; flex-shrink: 0; }
  .cv-table { width: 100%; border-collapse: collapse; }
  .cv-table td { border: 0.8px solid #000; padding: 2px 4px; font-size: 8px; }
  .lbl { background: #e0e0e0; font-weight: bold; white-space: nowrap; width: 28%; }
  .lbl-dark { background: #555; color: #fff; font-weight: bold; text-align: center; font-size: 9px; }
  .folio-val { font-weight: bold; font-size: 10px; }

  /* ── DOS COLUMNAS ── */
  .cols { display: flex; gap: 3px; }
  .col { flex: 1; }
  .divider-bar { width: 3px; background: #000; flex-shrink: 0; }

  /* ── TABLAS DE ITEMS ── */
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th, .items-table td {
    border: 0.8px solid #000; padding: 2px 3px; vertical-align: middle;
  }
  .sec-hdr {
    background: #555; color: #fff; text-align: center;
    font-weight: bold; font-size: 9px; text-transform: uppercase;
    letter-spacing: 1px;
  }
  .col-hdr { background: #ccc; font-weight: bold; text-align: center; font-size: 7.5px; }
  .tc { text-align: center; }
  .tl { text-align: left; }
  .tr { text-align: right; }
  .money { font-variant-numeric: tabular-nums; }

  /* ── SUBTOTALES ── */
  .sub-lbl {
    background: #e0e0e0; font-weight: bold;
    text-align: right; border: 0.8px solid #000;
    padding: 2px 4px; font-size: 8px;
  }
  .sub-val {
    background: #f5f5f5; text-align: right;
    border: 0.8px solid #000; padding: 2px 4px; font-size: 8px;
  }
  .tot-lbl {
    background: #555; color: #fff; font-weight: bold;
    text-align: right; border: 0.8px solid #000; padding: 2px 4px; font-size: 8px;
  }
  .tot-val {
    background: #555; color: #fff; font-weight: bold;
    text-align: right; border: 0.8px solid #000; padding: 2px 4px; font-size: 8px;
  }
  .sub-row { display: flex; }
  .sub-row .sub-lbl { flex: 3; }
  .sub-row .sub-val { flex: 1; min-width: 22mm; }
  .sub-row .tot-lbl { flex: 3; }
  .sub-row .tot-val { flex: 1; min-width: 22mm; }

  /* ── TOTAL GENERAL ── */
  .grand-wrap { display: flex; justify-content: flex-end; margin-top: 3px; }
  .grand-table { border-collapse: collapse; width: 58mm; }
  .grand-table td { border: 0.8px solid #000; padding: 2px 5px; font-size: 8.5px; }
  .g-lbl { background: #e0e0e0; font-weight: bold; text-align: right; }
  .g-val { text-align: right; }
  .g-tot td { background: #222; color: #fff; font-weight: bold; font-size: 10px; text-align: right; }

  /* ── FOOTER ── */
  .footer { margin-top: 5px; font-size: 7px; color: #333; line-height: 1.6; }
  .guarantee { text-align: center; font-weight: bold; font-size: 8px; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="logo-box">LOGO</div>
  <div class="company-info">
    <div class="company-name">Autoservicio D y G</div>
    <div>Servicios Profesionales de Inyección</div>
    <div>Av. Valentín Fuentes Varela #1779, Col. La Fuente</div>
    <div>Juárez, Chih. &nbsp;|&nbsp; Tel. (656) *********</div>
  </div>
  <div class="doc-title">Cotización de Orden de Trabajo</div>
</div>

<!-- CLIENTE + VEHÍCULO -->
<div class="cv-wrap">
  <div class="client-block">
    <table class="cv-table">
      <tr>
        <td class="lbl-dark" colspan="2">NOMBRE DEL CLIENTE</td>
        <td colspan="2" style="font-weight:bold; font-size:9px;">${orden.nombreCliente || 'CLIENTE GENERAL'}</td>
      </tr>
      <tr>
        <td class="lbl">COTIZACIÓN</td>
        <td class="folio-val">L-${orden._id.toString().slice(-4).toUpperCase()}</td>
        <td class="lbl">FECHA</td>
        <td>${fechaActual}</td>
      </tr>
      <tr>
        <td class="lbl">RFC</td>
        <td>${orden.rfc || 'N/A'}</td>
        <td class="lbl">TELÉFONO</td>
        <td>${orden.telefono || 'N/A'}</td>
      </tr>
      <tr>
        <td class="lbl">CORREO</td>
        <td colspan="3">${orden.correo || 'N/A'}</td>
      </tr>
      <tr>
        <td class="lbl">DIRECCIÓN</td>
        <td colspan="3">${orden.direccion || 'N/A'}</td>
      </tr>
      <tr>
        <td class="lbl">ASESOR</td>
        <td colspan="3">admin</td>
      </tr>
    </table>
  </div>
  <div class="vehicle-block">
    <table class="cv-table">
      <tr><td class="lbl">MARCA</td>   <td>${orden.marca || ''}</td></tr>
      <tr><td class="lbl">LÍNEA</td>   <td>${orden.modelo || ''}</td></tr>
      <tr><td class="lbl">AÑO</td>     <td>${orden.anio || ''}</td></tr>
      <tr><td class="lbl">COLOR</td>   <td>${orden.color || ''}</td></tr>
      <tr><td class="lbl">PLACAS</td>  <td>${orden.placas || ''}</td></tr>
      <tr><td class="lbl">SERIE</td>   <td>${orden.serie || ''}</td></tr>
      <tr><td class="lbl">ODÓMETRO</td><td>${orden.kilometraje || ''}</td></tr>
    </table>
  </div>
</div>

<!-- DOS COLUMNAS -->
<div class="cols">

  <!-- REFACCIONES -->
  <div class="col">
    <table class="items-table">
      <thead>
        <tr><th class="sec-hdr" colspan="4">Refacciones</th></tr>
        <tr>
          <th class="col-hdr" style="width:8%">Cant.</th>
          <th class="col-hdr">Descripción</th>
          <th class="col-hdr" style="width:18%">Precio</th>
          <th class="col-hdr" style="width:18%">Subtotal</th>
        </tr>
      </thead>
      <tbody>${refRows}</tbody>
    </table>
    <div class="sub-row"><div class="sub-lbl">SUBTOTAL</div><div class="sub-val">$${fmt(subtotalRef)}</div></div>
    <div class="sub-row"><div class="sub-lbl">I.V.A. (8%)</div><div class="sub-val">$${fmt(ivaRef)}</div></div>
    <div class="sub-row"><div class="tot-lbl">TOTAL REFACCIONES</div><div class="tot-val">$${fmt(totalRef)}</div></div>
  </div>

  <div class="divider-bar"></div>

  <!-- MANO DE OBRA -->
  <div class="col">
    <table class="items-table">
      <thead>
        <tr><th class="sec-hdr" colspan="4">Mano de Obra</th></tr>
        <tr>
          <th class="col-hdr" style="width:8%">Cant.</th>
          <th class="col-hdr">Descripción</th>
          <th class="col-hdr" style="width:18%">Precio</th>
          <th class="col-hdr" style="width:18%">Subtotal</th>
        </tr>
      </thead>
      <tbody>${moRows}</tbody>
    </table>
    <div class="sub-row"><div class="sub-lbl">SUBTOTAL</div><div class="sub-val">$${fmt(subtotalMO)}</div></div>
    <div class="sub-row"><div class="sub-lbl">I.V.A. (8%)</div><div class="sub-val">$${fmt(ivaMO)}</div></div>
    <div class="sub-row"><div class="tot-lbl">TOTAL MANO DE OBRA</div><div class="tot-val">$${fmt(totalMO)}</div></div>
  </div>

</div>

<!-- TOTAL GENERAL -->
<div class="grand-wrap">
  <table class="grand-table">
    <tr><td class="g-lbl">SUBTOTAL GENERAL</td><td class="g-val">$${fmt(subtotalG)}</td></tr>
    <tr><td class="g-lbl">I.V.A. (8%)</td><td class="g-val">$${fmt(ivaG)}</td></tr>
    <tr class="g-tot"><td>TOTAL</td><td>$${fmt(totalG)}</td></tr>
  </table>
</div>

<!-- NOTAS -->
<div class="footer">
  <p><strong>NOTA.</strong> Este presupuesto puede presentar cambios y/o modificaciones a la baja o alta en el importe total por situaciones fortuitas que puedan presentarse al momento de la reparación.</p>
  <br>
  <p>Se extiende la presente cotización para los fines que el interesado convenga. Esta cotización se respetará 30 días a partir de la fecha de expedición y no tendrá validez por una devaluación.</p>
</div>
<div class="guarantee">Garantía de 90 días en refacciones y mano de obra</div>

</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'Letter', 
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    await browser.close();
    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).send('Error al generar PDF');
  }
};