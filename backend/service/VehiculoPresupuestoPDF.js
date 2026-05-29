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

    const itemsRef = (orden.presupuesto || [])
      .filter(r => r.estatus === 'AUTORIZADO')
      .map(r => ({
        cant:     Number(r.cant || 0),
        desc:     `${r.concepto}${r.refaccion ? ' - ' + r.refaccion : ''}`,
        precio:   Number(r.precioVenta || 0),
        subtotal: Number(r.cant || 0) * Number(r.precioVenta || 0)
      }));

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

    const emptyRow = `<tr>
      <td class="tc">&nbsp;</td><td></td>
      <td class="tr" style="color:#bbb">$ -</td>
      <td class="tr" style="color:#bbb">$ -</td>
    </tr>`;

    const refRows = Array.from({ length: maxRows }, (_, i) => {
      const r = itemsRef[i];
      if (!r) return emptyRow;
      return `<tr>
        <td class="tc">${r.cant}</td>
        <td class="tl">${r.desc}</td>
        <td class="tr">$${fmt(r.precio)}</td>
        <td class="tr">$${fmt(r.subtotal)}</td>
      </tr>`;
    }).join('');

    const moRows = Array.from({ length: maxRows }, (_, i) => {
      const m = itemsMO[i];
      if (!m) return emptyRow;
      return `<tr>
        <td class="tc">${m.cant}</td>
        <td class="tl">${m.desc}</td>
        <td class="tr">$${fmt(m.precio)}</td>
        <td class="tr">$${fmt(m.subtotal)}</td>
      </tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: Letter landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 8.5px; color: #000; }

  /* ══ UTILIDADES ══ */
  .tc  { text-align: center; }
  .tl  { text-align: left; }
  .tr  { text-align: right; }
  .b   { font-weight: bold; }
  .lbl { background: #e8e8e8; font-weight: bold; }

  /* ══ BORDES ══ */
  .brd { border: 0.8px solid #000; }

  /* ══ HEADER PRINCIPAL ══ */
  .hdr-tbl {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 3px;
    border: 0.8px solid #000;
  }
  .hdr-tbl td { border: 0.8px solid #000; padding: 0; vertical-align: top; }

  /* Celda izquierda: logo + datos negocio */
  .hdr-left {
    width: 28%;
    padding: 4px 6px;
    vertical-align: middle;
  }
  .logo-box {
    width: 22mm; height: 16mm;
    border: 1px solid #999;
    display: inline-block;
    text-align: center;
    line-height: 16mm;
    font-size: 9px; color: #666;
    vertical-align: middle;
    margin-bottom: 3px;
  }
  .biz-name { font-size: 9.5px; font-weight: bold; text-transform: uppercase; }
  .biz-info  { font-size: 7.5px; line-height: 1.5; }

  /* Celda derecha: tabla interior de 3 filas */
  .hdr-right { width: 72%; vertical-align: top; }

  .hdr-inner { width: 100%; border-collapse: collapse; height: 100%; }
  .hdr-inner td { border: 0.8px solid #000; padding: 3px 5px; vertical-align: middle; }

  /* Fila 1 — título */
  .hdr-title {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 5px !important;
  }

  /* Fila 2 — nombre cliente */
  .hdr-client-lbl {
    background: #000; color: #fff;
    font-weight: bold; font-size: 9px;
    text-align: center; width: 22%;
  }
  .hdr-client-val {
    font-weight: bold; font-size: 11px;
    text-align: center;
  }

  /* Fila 3 — cotización + marca */
  .hdr-tag  { background: #e8e8e8; font-weight: bold; text-align: right; width: 13%; font-size: 8px; }
  .hdr-val  { text-align: left; width: 13%; font-size: 8px; }
  .hdr-gap  { width: 10%; }
  .hdr-vtag { background: #e8e8e8; font-weight: bold; text-align: right; width: 13%; font-size: 8px; }
  .hdr-vval { text-align: left; width: 13%; font-size: 8px; }

  /* Filas adicionales vehículo (dentro de hdr-right) */
  .v-lbl { background: #e8e8e8; font-weight: bold; text-align: right; font-size: 8px; padding: 2px 4px; width: 30%; }
  .v-val  { font-size: 8px; padding: 2px 4px; }

  /* ══ LAYOUT DOS COLUMNAS ══ */
  .layout-tbl { width: 100%; border-collapse: collapse; }
  .layout-tbl > tbody > tr > td { vertical-align: top; padding: 0; border: none; }
  .col-ref { width: 49.5%; }
  .col-div { width: 1%;  background: #000; }
  .col-mo  { width: 49.5%; }

  /* ══ TABLAS DE ITEMS ══ */
  .items-tbl { width: 100%; border-collapse: collapse; }
  .items-tbl th, .items-tbl td {
    border: 0.8px solid #000; padding: 2px 3px; vertical-align: middle;
  }
  .sec-hdr {
    background: #000; color: #fff;
    text-align: center; font-weight: bold;
    font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
  }
  .col-hdr { background: #e8e8e8; font-weight: bold; text-align: center; font-size: 7.5px; }

  /* ══ SUBTOTALES ══ */
  .sub-tbl { width: 100%; border-collapse: collapse; }
  .sub-tbl td { border: 0.8px solid #000; padding: 2px 4px; font-size: 8px; }
  .sub-lbl { background: #e8e8e8; font-weight: bold; text-align: right; width: 70%; }
  .sub-val { text-align: right; }
  .tot-lbl { background: #000; color: #fff; font-weight: bold; text-align: right; }
  .tot-val { background: #000; color: #fff; font-weight: bold; text-align: right; }

  /* ══ TOTAL GENERAL ══ */
  .grand-tbl { border-collapse: collapse; float: right; width: 62mm; margin-top: 3px; }
  .grand-tbl td { border: 0.8px solid #000; padding: 2px 5px; font-size: 8.5px; }
  .g-lbl { background: #e8e8e8; font-weight: bold; text-align: right; width: 65%; }
  .g-val { text-align: right; }
  .g-tot-lbl { background: #000; color: #fff; font-weight: bold; text-align: right; font-size: 10px; }
  .g-tot-val { background: #000; color: #fff; font-weight: bold; text-align: right; font-size: 10px; }

  /* ══ FOOTER ══ */
  .clearfix::after { content: ''; display: table; clear: both; }
  .footer { margin-top: 5px; font-size: 7px; color: #333; line-height: 1.6; clear: both; }
  .guarantee { text-align: center; font-weight: bold; font-size: 8px; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>

<!-- ══════════════════════════════════════════
     HEADER
     Columna izquierda : logo + datos negocio
     Columna derecha   : 3 filas (título / cliente / cotiz+marca)
                         + filas adicionales de vehículo
════════════════════════════════════════════ -->
<table class="hdr-tbl">
  <tbody>
    <tr>
      <!-- IZQUIERDA -->
      <td class="hdr-left" rowspan="2">
        <div class="logo-box">LOGO</div>
        <div class="biz-name">Autoservicio D y G</div>
        <div class="biz-info">
          Servicios Profesionales de Inyección<br>
          Av. Valentín Fuentes Varela #1779<br>
          Col. La Fuente, Juárez, Chih.<br>
          Tel. (656) *********
        </div>
      </td>

      <!-- DERECHA — tabla interior -->
      <td class="hdr-right">
        <table class="hdr-inner">

          <!-- Fila 1: Título -->
          <tr>
            <td class="hdr-title" colspan="5">COTIZACIÓN DE ORDEN DE TRABAJO</td>
          </tr>

          <!-- Fila 2: Nombre del cliente -->
          <tr>
            <td class="hdr-client-lbl" colspan="2">NOMBRE DEL CLIENTE</td>
            <td class="hdr-client-val" colspan="3">${orden.nombreCliente || 'CLIENTE GENERAL'}</td>
          </tr>

          <!-- Fila 3: Cotización | Número | Espacio | MARCA | valor -->
          <tr>
            <td class="hdr-tag">COTIZACIÓN</td>
            <td class="hdr-val b">L-${orden._id.toString().slice(-4).toUpperCase()}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">MARCA</td>
            <td class="hdr-vval">${orden.marca || ''}</td>
          </tr>

          <!-- Filas extra: resto de datos cotización + vehículo -->
          <tr>
            <td class="hdr-tag">FECHA</td>
            <td class="hdr-val">${fechaActual}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">LÍNEA</td>
            <td class="hdr-vval">${orden.modelo || ''}</td>
          </tr>
          <tr>
            <td class="hdr-tag">RFC</td>
            <td class="hdr-val">${orden.rfc || 'N/A'}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">AÑO</td>
            <td class="hdr-vval">${orden.anio || ''}</td>
          </tr>
          <tr>
            <td class="hdr-tag">TELÉFONO</td>
            <td class="hdr-val">${orden.telefono || 'N/A'}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">COLOR</td>
            <td class="hdr-vval">${orden.color || ''}</td>
          </tr>
          <tr>
            <td class="hdr-tag">ASESOR</td>
            <td class="hdr-val">admin</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">PLACAS</td>
            <td class="hdr-vval">${orden.placas || ''}</td>
          </tr>
          <tr>
            <td class="hdr-tag">CORREO</td>
            <td class="hdr-val">${orden.correo || 'N/A'}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">SERIE</td>
            <td class="hdr-vval">${orden.serie || ''}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:2px 4px; font-size:8px;">${orden.direccion || ''}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">ODÓMETRO</td>
            <td class="hdr-vval">${orden.kilometraje || ''}</td>
          </tr>

        </table>
      </td>
    </tr>
  </tbody>
</table>

<!-- ══════════════════════════════════════════
     DOS COLUMNAS: REFACCIONES | MANO DE OBRA
════════════════════════════════════════════ -->
<table class="layout-tbl">
  <tbody>
    <tr>

      <!-- REFACCIONES -->
      <td class="col-ref">
        <table class="items-tbl">
          <thead>
            <tr><th class="sec-hdr" colspan="4">Refacciones</th></tr>
            <tr>
              <th class="col-hdr" style="width:8%">Cant.</th>
              <th class="col-hdr">Descripción</th>
              <th class="col-hdr" style="width:19%">Precio</th>
              <th class="col-hdr" style="width:19%">Subtotal</th>
            </tr>
          </thead>
          <tbody>${refRows}</tbody>
        </table>
        <table class="sub-tbl">
          <tr><td class="sub-lbl">SUBTOTAL</td>          <td class="sub-val">$${fmt(subtotalRef)}</td></tr>
          <tr><td class="sub-lbl">I.V.A. (8%)</td>       <td class="sub-val">$${fmt(ivaRef)}</td></tr>
          <tr><td class="tot-lbl">TOTAL REFACCIONES</td> <td class="tot-val">$${fmt(totalRef)}</td></tr>
        </table>
      </td>

      <!-- DIVISOR -->
      <td class="col-div">&nbsp;</td>

      <!-- MANO DE OBRA -->
      <td class="col-mo">
        <table class="items-tbl">
          <thead>
            <tr><th class="sec-hdr" colspan="4">Mano de Obra</th></tr>
            <tr>
              <th class="col-hdr" style="width:8%">Cant.</th>
              <th class="col-hdr">Descripción</th>
              <th class="col-hdr" style="width:19%">Precio</th>
              <th class="col-hdr" style="width:19%">Subtotal</th>
            </tr>
          </thead>
          <tbody>${moRows}</tbody>
        </table>
        <table class="sub-tbl">
          <tr><td class="sub-lbl">SUBTOTAL</td>          <td class="sub-val">$${fmt(subtotalMO)}</td></tr>
          <tr><td class="sub-lbl">I.V.A. (8%)</td>       <td class="sub-val">$${fmt(ivaMO)}</td></tr>
          <tr><td class="tot-lbl">TOTAL MANO DE OBRA</td><td class="tot-val">$${fmt(totalMO)}</td></tr>
        </table>
      </td>

    </tr>
  </tbody>
</table>

<!-- TOTAL GENERAL -->
<div class="clearfix">
  <table class="grand-tbl">
    <tr><td class="g-lbl">SUBTOTAL GENERAL</td><td class="g-val">$${fmt(subtotalG)}</td></tr>
    <tr><td class="g-lbl">I.V.A. (8%)</td>     <td class="g-val">$${fmt(ivaG)}</td></tr>
    <tr><td class="g-tot-lbl">TOTAL</td>        <td class="g-tot-val">$${fmt(totalG)}</td></tr>
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
      landscape: true,
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    await browser.close();
    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar PDF:', error.message, error.stack);
    res.status(500).send('Error al generar PDF: ' + error.message);
  }
};