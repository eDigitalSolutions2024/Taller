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
    const horaActual = dayjs().format('hh:mm a');

    // Consolidación de conceptos
    const itemsRefacciones = (orden.presupuesto || []).map(r => ({
      cant: r.cant,
      desc: `${r.concepto} ${r.refaccion ? '- ' + r.refaccion : ''}`,
      tipo: r.tipo || 'N/A',
      precio: Number(r.precioVenta || 0),
      total: Number(r.cant || 0) * Number(r.precioVenta || 0)
    }));

    const itemsManoObra = (orden.manoObra || []).map(m => ({
      cant: 1,
      desc: `MANO DE OBRA: ${m.concepto}`,
      tipo: 'SERVICIO',
      precio: Number(m.precioVenta || 0),
      total: Number(m.precioVenta || 0)
    }));

    const todosLosServicios = [...itemsRefacciones, ...itemsManoObra];
    const subtotal = todosLosServicios.reduce((acc, item) => acc + item.total, 0);
    const iva = subtotal * 0.08; 
    const totalFinal = subtotal + iva;

    const htmlContent = `
    <html>
      <head>
        <style>
           @page {
            size: Letter;
            margin: 6mm;
          }

          * {
            box-sizing: border-box;
            font-family: Arial, sans-serif;
          }

          body {
            margin: 0;
            padding: 0;
            font-size: 9px;
            color: #000;
          }

          /* =========================================
              HEADER
          ========================================= */

          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
          }

          .header-table td {
            border: none;
            vertical-align: top;
          }

          .header-qr {
            width: 32mm;
          }

          .qr-box {
            width: 30mm;
            height: 30mm;
            border: 1px solid #6B7280;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6B7280;
            font-size: 10px;
          }

          .header-center {
            text-align: center;
          }

          .brand-name {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: .5px;
            color: #1D4ED8;
            margin-top: 6px;
            line-height: 1;
          }

          .brand-slogan {
            font-size: 9px;
            color: #4B5563;
            margin-top: 2px;
          }

          .header-address {
            font-size: 7.5px;
            color: #6B7280;
            margin-top: 2px;
            line-height: 1.2;
          }

          .header-right {
            width: 38mm;
            text-align: right;
            font-size: 8px;
          }

          .asesor-text {
            font-weight: bold;
          }

          .folio {
            color: #DC2626;
            font-size: 15px;
            font-weight: 800;
            margin-top: 6px;
          }

          .fecha {
            margin-top: 2px;
            color: #6B7280;
          }

          /* =========================================
              TABLAS GENERALES
          ========================================= */

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            border: 0.8px solid #000;
            padding: 2px 4px;
            vertical-align: middle;
          }

          .text-left {
            text-align: left !important;
          }

          .text-right {
            text-align: right !important;
          }

          .center {
            text-align: center;
          }

          /* =========================================
              INFO CLIENTE / VEHICULO
          ========================================= */

          .info-table {
            margin-top: 3px;
            margin-bottom: 5px;
            font-size: 9px;
          }

          .info-table td {
            padding: 3px 4px;
          }

          .label-cell {
            background: #E5E7EB;
            font-weight: bold;
          }

          .service-label {
            background: #1D4ED8;
            color: white;
            text-align: center;
            font-weight: bold;
          }

          .folio-cell {
            color: #DC2626;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
          }

          .vehicle-header td,
          .vehicle-header {
            background: #E5E7EB;
            font-weight: bold;
            text-align: center;
          }

          /* =========================================
              SECCIONES AZULES
          ========================================= */

          .section-title {
            background: #1D4ED8;
            color: #FFFFFF;
            font-weight: bold;
            text-align: center;
            padding: 2px 0;
            margin-top: 3px;
            letter-spacing: 2px;
            font-size: 10px;
          }

          .sub-title {
            background: #E5E7EB;
            font-weight: bold;
            text-align: center;
            padding: 1px 0;
            border-left: 0.8px solid #000;
            border-right: 0.8px solid #000;
          }

          .grey-header {
            background: #E5E7EB;
            font-weight: bold;
          }

          /* =========================================
              TABLA PRINCIPAL
          ========================================= */

          .main-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 9px;
          }

          .main-table th {
            background: #1D4ED8;
            color: white;
            padding: 5px;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: .5px;
            border: 0.8px solid #1D4ED8;
          }

          .main-table td {
            padding: 5px;
            border: 0.8px solid #000;
          }

          .main-table tbody tr:nth-child(even) {
            background: #FAFAFA;
          }

          .main-table td:nth-child(1) {
            font-weight: bold;
            text-align: center;
          }

          .main-table td:nth-child(3) {
            font-size: 8px;
            text-align: center;
          }

          .main-table td:nth-child(4),
          .main-table td:nth-child(5) {
            font-weight: bold;
          }

          /* =========================================
              FOOTER / TOTALES
          ========================================= */

          .footer-layout {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            gap: 6px;
          }

          .obs-box {
            width: 68%;
            border: 0.8px solid #000;
            padding: 6px;
            font-size: 8px;
            min-height: 45px;
          }

          .totals-box {
            width: 30%;
            font-size: 9px;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            border-bottom: 1px solid #DDD;
          }

          .grand-total {
            font-weight: bold;
            font-size: 13px;
            color: #1D4ED8;
            border-top: 2px solid #1D4ED8;
            margin-top: 4px;
            padding-top: 4px;
          }

          /* =========================================
              ALTURAS
          ========================================= */

          .medium-cell {
            height: 50px;
          }

          .large-cell {
            height: 75px;
          }

          /* =========================================
              UTILIDADES
          ========================================= */

          .small {
            font-size: 8px;
          }

          .label {
            font-weight: bold;
          }

          ul {
            margin: 0;
            padding-left: 14px;
          }

          li {
            margin-bottom: 2px;
          }

          .no-border td, .no-border th { border: none; }
        </style>
      </head>
      <body>
        <table class ="no-border">
            <tr>
              <td style="width: 25mm; vertical-align: top;">
                <div class="qr-box">QR</div>
              </td>
              <td style="text-align: center;">
                <div class="brand-name">Autoservicio D y G</div>
                <div class="brand-slogan">Profesionales al servicio de su automóvil</div>
                <div class="header-address">
                  32370, Av Valentín Fuentes Varela 1779, La Fuente, 32370 Juárez, Chih.
                  Tel: (656) *********
                </div>
              </td>
              <td style="width: 40mm; text-align: right; font-size: 9px; vertical-align: top;">
                <div class="small"><span class="label">ASESOR:</span> admin</div>
              </td>
            </tr>
          </table>

        <table class="info-table">
          <tr>
            <td class="label-cell">NOMBRE DEL CLIENTE:</td>
            <td colspan="3">${orden.nombreCliente || 'CLIENTE GENERAL'}</td>

            <td class="service-label">ORDEN DE SERVICIO:</td>
            <td class="folio-cell">
              L-${orden._id.toString().slice(-4).toUpperCase()}
            </td>
          </tr>

          <tr>
            <td class="label-cell">FECHA DE RECEPCIÓN:</td>
            <td>${fechaActual}</td>

            <td class="label-cell">CORREO</td>
            <td colspan="3">${orden.correo || 'N/A'}</td>
          </tr>

          <tr>
            <td class="label-cell">RFC:</td>
            <td>${orden.rfc || 'N/A'}</td>

            <td class="label-cell">TELÉFONO</td>
            <td>${orden.telefono || 'N/A'}</td>

            <td class="label-cell">CELULAR</td>
            <td>${orden.celular || 'N/A'}</td>
          </tr>

          <tr>
            <td class="label-cell">DIRECCIÓN:</td>
            <td colspan="5">${orden.direccion || 'N/A'}</td>
          </tr>

          <!-- DATOS VEHICULO -->
          <tr class="vehicle-header">
            <td>MARCA</td>
            <td>MODELO</td>
            <td>AÑO</td>
            <td>COLOR</td>
            <td>NACIONALIDAD</td>
            <td>SERIE</td>
          </tr>

          <tr>
            <td>${orden.marca || ''}</td>
            <td>${orden.modelo || ''}</td>
            <td>${orden.anio || ''}</td>
            <td>${orden.color || ''}</td>
            <td>${orden.nacionalidad || ''}</td>
            <td>${orden.serie || ''}</td>
          </tr>

          <tr class="vehicle-header">
            <td>PLACAS</td>
            <td>MOTOR</td>
            <td>KMS/MILLAS</td>
            <td>DIRIGIDO A</td>
            <td>NÚMERO ECONÓMICO</td>
            <td>DEPARTAMENTO</td>
          </tr>

          <tr>
            <td>${orden.placas || ''}</td>
            <td>${orden.motor || ''}</td>
            <td>${orden.kilometraje || ''}</td>
            <td>${orden.dirigidoA || ''}</td>
            <td>${orden.numeroEconomico || ''}</td>
            <td>${orden.departamento || ''}</td>
          </tr>
        </table>

        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 8%;">Cant.</th>
              <th class="text-left">Descripción del Servicio / Refacción</th>
              <th style="width: 12%;">Tipo</th>
              <th style="width: 15%;">Precio</th>
              <th style="width: 15%;">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${todosLosServicios.map(item => `
              <tr>
                <td>${item.cant}</td>
                <td class="text-left">${item.desc}</td>
                <td style="font-size: 8px;">${item.tipo}</td>
                <td class="text-right">$${item.precio.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                <td class="text-right">$${item.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
              </tr>
            `).join('')}
            ${Array(Math.max(0, 8 - todosLosServicios.length)).fill(0).map(() => `
              <tr><td style="color:transparent">.</td><td></td><td></td><td></td><td></td></tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer-layout">
          <div class="obs-box">
            <strong>OBSERVACIONES:</strong><br>
            ${orden.servicioReparacion?.revisionFallas || 'Sin observaciones.'}
          </div>
          <div class="totals-box">
            <div class="total-row"><span>Subtotal:</span> <span>$${subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</span></div>
            <div class="total-row"><span>I.V.A. (8%):</span> <span>$${iva.toLocaleString('es-MX', {minimumFractionDigits: 2})}</span></div>
            <div class="total-row grand-total"><span>TOTAL:</span> <span>$${totalFinal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</span></div>
          </div>
        </div>
      </body>
    </html>`;

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ 
      format: 'Letter', 
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });

    await browser.close();
    res.contentType("application/pdf");
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error al generar PDF');
  }
};