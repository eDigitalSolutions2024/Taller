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
          @page { size: Letter; margin: 10mm; }
          body { font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; color: #333; margin: 0; padding: 0; }
          
          /* ENCABEZADO ACTUALIZADO (IMAGE_70420C) */
          .header-container { 
            display: grid; 
            grid-template-columns: 1fr 2fr 1fr; 
            align-items: center; 
            margin-bottom: 20px;
          }
          
          .qr-placeholder { 
            width: 80px; height: 80px; 
            border: 1px solid #ccc; border-radius: 4px; 
            display: flex; align-items: center; justify-content: center; 
            color: #999; font-size: 12px;
          }

          .brand-info { text-align: center; }
          .brand-name { color: #0047ba; font-size: 24px; font-weight: bold; margin: 0; }
          .slogan { font-size: 10px; color: #444; margin: 2px 0; }
          .address { font-size: 8.5px; color: #666; line-height: 1.2; }

          .meta-info { text-align: right; font-size: 9px; }
          .asesor-text { font-weight: bold; text-transform: uppercase; }

          /* DATOS DEL VEHÍCULO (ESTILO BADGE) */
          .v-data-bar { 
            display: flex; justify-content: center; gap: 15px; 
            background: #f1f5f9; padding: 6px; border-radius: 4px; 
            margin-bottom: 15px; border: 1px solid #e2e8f0;
          }
          .v-item { font-size: 9px; }
          .v-item strong { color: #0047ba; }

          /* TABLA L18 */
          .main-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          .main-table th { background-color: #0047ba; color: white; padding: 8px; border: 1px solid #0047ba; text-transform: uppercase; }
          .main-table td { border: 1px solid #ddd; padding: 7px; text-align: center; }
          .text-left { text-align: left !important; }
          .text-right { text-align: right !important; }

          .footer-layout { display: flex; justify-content: space-between; margin-top: 15px; }
          .obs-box { width: 65%; border: 1px solid #000; padding: 10px; font-size: 9px; min-height: 50px; }
          .totals-box { width: 30%; font-size: 11px; }
          .total-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee; }
          .grand-total { font-weight: bold; font-size: 14px; color: #0047ba; border-top: 2px solid #0047ba; margin-top: 5px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="qr-placeholder">QR</div>
          
          <div class="brand-info">
            <h1 class="brand-name">Autoservicio D y G</h1>
            <p class="slogan">Profesionales al servicio de su automóvil</p>
            <p class="address">
              32370, Av Valentín Fuentes Varela 1779, La Fuente,<br>
              32370 Juárez, Chih. Tel: (656) ***-****
            </p>
          </div>

          <div class="meta-info">
            <div class="asesor-text">ASESOR: ${orden.asesor || 'admin'}</div>
            <div style="margin-top: 10px; color: red; font-weight: bold; font-size: 14px;">
              FOLIO: L-${orden._id.toString().slice(-4).toUpperCase()}
            </div>
            <div>${fechaActual}</div>
          </div>
        </div>

        <div class="v-data-bar">
          <div class="v-item"><strong>PLACAS:</strong> ${orden.placas || 'N/A'}</div>
          <div class="v-item"><strong>UNIDAD:</strong> ${orden.marca} ${orden.modelo}</div>
          <div class="v-item"><strong>KM:</strong> ${orden.kilometraje || '0'}</div>
          <div class="v-item"><strong>COLOR:</strong> ${orden.color || 'N/A'}</div>
        </div>

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