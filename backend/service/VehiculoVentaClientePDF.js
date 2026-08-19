const puppeteer = require('puppeteer');
const dayjs = require('dayjs');

// Resuelve el nombre a mostrar del cliente a partir del snapshot plano que
// vive en la propia orden (Particular: nombre+apellidos; Empresa/Gobierno:
// nombreGobierno) — mismo criterio que usa VehiculosConsultaOrdenes.jsx.
function nombreCliente(orden) {
  if (orden.nombreGobierno) return orden.nombreGobierno;
  const partes = [orden.nombreCliente, orden.apellidoPaterno, orden.apellidoMaterno].filter(Boolean);
  return partes.length ? partes.join(' ') : 'CLIENTE GENERAL';
}

function direccionCliente(orden) {
  const partes = [
    orden.direccion,
    orden.numeroExt ? `#${orden.numeroExt}` : '',
    orden.colonia,
    orden.ciudad,
    orden.estado,
  ].filter(Boolean);
  return partes.join(', ');
}

exports.generarVentaClientePDF = async (res, orden) => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    const fecha = orden.fechaCierre ? dayjs(orden.fechaCierre) : dayjs();
    const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

    const items = (orden.ventaCliente || []).map((r) => ({
      cant: Number(r.cant || 0),
      desc: r.concepto || '',
      obs: r.observaciones || '',
      precio: Number(r.precioVenta || 0),
      importe: Number(r.cant || 0) * Number(r.precioVenta || 0),
    }));

    const subtotal = items.reduce((a, i) => a + i.importe, 0);
    const ivaPct = Number(orden.ivaVenta ?? 8) || 0;
    const ivaMonto = subtotal * (ivaPct / 100);
    const total = subtotal + ivaMonto;

    const MIN_ROWS = 12;
    const maxRows = Math.max(MIN_ROWS, items.length);

    const emptyRow = `<tr>
      <td class="tc">&nbsp;</td><td></td><td></td>
      <td class="tr" style="color:#bbb">$ -</td>
      <td class="tr" style="color:#bbb">$ -</td>
    </tr>`;

    const rows = Array.from({ length: maxRows }, (_, i) => {
      const r = items[i];
      if (!r) return emptyRow;
      return `<tr>
        <td class="tc">${r.cant}</td>
        <td class="tl">${r.desc}</td>
        <td class="tl">${r.obs}</td>
        <td class="tr">$${fmt(r.precio)}</td>
        <td class="tr">$${fmt(r.importe)}</td>
      </tr>`;
    }).join('');

    const infoVehiculo = orden.sinVehiculo
      ? ''
      : `
          <tr>
            <td class="hdr-tag">MARCA</td>
            <td class="hdr-val">${orden.marca || ''}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">PLACAS</td>
            <td class="hdr-vval">${orden.placas || ''}</td>
          </tr>
          <tr>
            <td class="hdr-tag">LÍNEA / AÑO</td>
            <td class="hdr-val">${[orden.modelo, orden.anio].filter(Boolean).join(' / ')}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">SERIE</td>
            <td class="hdr-vval">${orden.serie || ''}</td>
          </tr>`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: Legal portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9.5px; color: #000; }

  .tc { text-align: center; }
  .tl { text-align: left; }
  .tr { text-align: right; }
  .b  { font-weight: bold; }

  .hdr-tbl { width: 100%; border-collapse: collapse; margin-bottom: 6px; border: 0.8px solid #000; }
  .hdr-tbl td { border: 0.8px solid #000; padding: 0; vertical-align: top; }

  .hdr-left { width: 28%; padding: 5px 7px; vertical-align: middle; }
  .logo-box {
    width: 24mm; height: 18mm; border: 1px solid #999; display: inline-block;
    text-align: center; line-height: 18mm; font-size: 10px; color: #666;
    vertical-align: middle; margin-bottom: 4px;
  }
  .biz-name { font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .biz-info { font-size: 8.5px; line-height: 1.5; }

  .hdr-right { width: 72%; vertical-align: top; }
  .hdr-inner { width: 100%; border-collapse: collapse; height: 100%; }
  .hdr-inner td { border: 0.8px solid #000; padding: 3px 6px; vertical-align: middle; }

  .hdr-title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 6px !important; }

  .hdr-client-lbl { background: #000; color: #fff; font-weight: bold; font-size: 10px; text-align: center; width: 22%; }
  .hdr-client-val { font-weight: bold; font-size: 12px; text-align: center; }

  .hdr-tag  { background: #e8e8e8; font-weight: bold; text-align: right; width: 15%; font-size: 9px; }
  .hdr-val  { text-align: left; width: 30%; font-size: 9px; }
  .hdr-gap  { width: 4%; }
  .hdr-vtag { background: #e8e8e8; font-weight: bold; text-align: right; width: 14%; font-size: 9px; }
  .hdr-vval { text-align: left; width: 15%; font-size: 9px; }

  .items-tbl { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .items-tbl th, .items-tbl td { border: 0.8px solid #000; padding: 3px 5px; vertical-align: middle; }
  .sec-hdr { background: #000; color: #fff; text-align: center; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .col-hdr { background: #e8e8e8; font-weight: bold; text-align: center; font-size: 8.5px; }

  .grand-tbl { border-collapse: collapse; float: right; width: 72mm; margin-top: 6px; }
  .grand-tbl td { border: 0.8px solid #000; padding: 3px 6px; font-size: 9.5px; }
  .g-lbl { background: #e8e8e8; font-weight: bold; text-align: right; width: 60%; }
  .g-val { text-align: right; }
  .g-tot-lbl { background: #000; color: #fff; font-weight: bold; text-align: right; font-size: 11px; }
  .g-tot-val { background: #000; color: #fff; font-weight: bold; text-align: right; font-size: 11px; }

  .clearfix::after { content: ''; display: table; clear: both; }
  .obs-box { margin-top: 8px; border: 0.8px solid #000; padding: 6px; font-size: 9px; min-height: 14mm; }
  .obs-box .obs-lbl { font-weight: bold; text-transform: uppercase; font-size: 8px; margin-bottom: 3px; display: block; }
  .footer { margin-top: 10px; font-size: 8px; color: #333; line-height: 1.6; clear: both; }
  .guarantee { text-align: center; font-weight: bold; font-size: 9px; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>

<table class="hdr-tbl">
  <tbody>
    <tr>
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

      <td class="hdr-right">
        <table class="hdr-inner">
          <tr>
            <td class="hdr-title" colspan="5">Venta al Cliente</td>
          </tr>
          <tr>
            <td class="hdr-client-lbl" colspan="2">NOMBRE DEL CLIENTE</td>
            <td class="hdr-client-val" colspan="3">${nombreCliente(orden)}</td>
          </tr>
          <tr>
            <td class="hdr-tag">ORDEN DE SERVICIO</td>
            <td class="hdr-val b">${orden.ordenServicio || ''}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">FECHA</td>
            <td class="hdr-vval">${fecha.format('DD/MM/YYYY')}</td>
          </tr>
          <tr>
            <td class="hdr-tag">RFC</td>
            <td class="hdr-val">${orden.rfc || 'N/A'}</td>
            <td class="hdr-gap"></td>
            <td class="hdr-vtag">TELÉFONO</td>
            <td class="hdr-vval">${orden.celular || orden.telefonoFijo || 'N/A'}</td>
          </tr>
          <tr>
            <td class="hdr-tag">DIRECCIÓN</td>
            <td class="hdr-val" colspan="4">${direccionCliente(orden) || 'N/A'}</td>
          </tr>
          ${infoVehiculo}
        </table>
      </td>
    </tr>
  </tbody>
</table>

<table class="items-tbl">
  <thead>
    <tr><th class="sec-hdr" colspan="5">Conceptos</th></tr>
    <tr>
      <th class="col-hdr" style="width:7%">Cant.</th>
      <th class="col-hdr">Concepto</th>
      <th class="col-hdr" style="width:22%">Observaciones</th>
      <th class="col-hdr" style="width:15%">Precio</th>
      <th class="col-hdr" style="width:15%">Importe</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="clearfix">
  <table class="grand-tbl">
    <tr><td class="g-lbl">SUBTOTAL</td>          <td class="g-val">$${fmt(subtotal)}</td></tr>
    <tr><td class="g-lbl">I.V.A. (${ivaPct}%)</td><td class="g-val">$${fmt(ivaMonto)}</td></tr>
    <tr><td class="g-tot-lbl">TOTAL</td>          <td class="g-tot-val">$${fmt(total)}</td></tr>
  </table>
</div>

<div class="obs-box clearfix">
  <span class="obs-lbl">Observaciones</span>
  ${orden.observacionesExternas || orden.observCotizacion || '&nbsp;'}
</div>

<div class="footer">
  <p>Este documento ampara los conceptos y precios acordados con el cliente para la presente orden de servicio.</p>
</div>
<div class="guarantee">Garantía de 90 días en refacciones y mano de obra</div>

</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Legal',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="venta_cliente_${orden.ordenServicio || orden._id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF de venta al cliente:', error.message, error.stack);
    res.status(500).send('Error al generar PDF: ' + error.message);
  }
};
