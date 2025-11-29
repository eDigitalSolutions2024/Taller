// backend/services/vehiculoOperativoPdf.js
// Genera el PDF "Operativo" de la orden usando Puppeteer

const puppeteer = require('puppeteer');
const dayjs = require('dayjs');

// Colores acordes a tu sistema (azules tipo Tailwind)
const PRIMARY = '#2563EB';      // azul principal (tabs / botones)
const PRIMARY_DARK = '#1D4ED8'; // azul un poquito más oscuro
const PRIMARY_TEXT = '#FFFFFF';

// ---------- HELPERS DE FORMATO ----------

function fmtFecha(fechaISO) {
  if (!fechaISO) return '';
  return dayjs(fechaISO).format('DD/MM/YYYY');
}

function fmtHora(fechaISO) {
  if (!fechaISO) return '';
  return dayjs(fechaISO).format('HH:mm');
}

function esc(str) {
  return (str ?? '').toString();
}

// Evitamos "[object Object]" en dirección
function fmtDireccionFull(v, extra = {}) {
  if (!v) {
    const { numeroExt, numeroInt, colonia, ciudad, estado } = extra;
    return [numeroExt, numeroInt, colonia, ciudad, estado]
      .filter(Boolean)
      .join(' ');
  }

  if (typeof v === 'string') return v;

  if (typeof v === 'object') {
    const {
      calle,
      numero,
      numeroExt,
      numeroInt,
      colonia,
      ciudad,
      estado,
      cp,
    } = v;
    return [
      calle,
      numero,
      numeroExt,
      numeroInt,
      colonia,
      ciudad,
      estado,
      cp,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return String(v);
}

// ---------- HTML DEL PDF ----------

function buildOperativoHtml(vehiculo) {
  const {
    ordenServicio,
    nombreGobierno,
    rfc,
    telefonoFijo,
    celular,
    direccion,
    numeroExt,
    numeroInt,
    colonia,
    ciudad,
    estado,
    correo,
    grua,
    marca,
    modelo,
    anio,
    color,
    serie,
    placas,
    kmsMillas,
    nacionalidad,
    motor,
    numeroEconomico,
    checkEngine,
    abs,
    airBag,
    frenos,
    aceite,
    alternador,
    observaciones,
  } = vehiculo;

  const fechaRecepcion = fmtFecha(vehiculo.fechaRecepcion);
  const horaRecepcion =
    vehiculo.horaRecepcion || fmtHora(vehiculo.fechaRecepcion);

  const direccionCompleta = fmtDireccionFull(direccion, {
    numeroExt,
    numeroInt,
    colonia,
    ciudad,
    estado,
  });

  // Por ahora está fijo, luego podemos leerlo de servicioReparacion
  const serviciosTexto = `
    ALINEACIÓN POR COMPUTADORA<br/>
    BALANCEO EN LAS 4 RUEDAS<br/>
    MONTAJE DE LLANTA<br/>
    LIMPIEZA Y AJUSTE FRENOS<br/>
    REVISIÓN FRENOS 2 RUEDAS<br/>
    CAMBIO DE BRAZO
  `;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Orden Operativa ${esc(ordenServicio)}</title>
<style>
  * { box-sizing: border-box; font-family: Arial, sans-serif; }
  body { margin: 0; padding: 0; font-size: 9.5px; }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 8mm 8mm 10mm 8mm;
    margin: 0 auto;
    position: relative;
  }
  .page-break { page-break-after: always; }

  table { border-collapse: collapse; width: 100%; }
  th, td {
    border: 0.8px solid #000;
    padding: 2px 3px;
    vertical-align: middle;
  }
  .no-border td, .no-border th { border: none; }

  .small { font-size: 8.5px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .label { font-weight: bold; }

  .brand-name {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.6px;
    color: ${PRIMARY_DARK};
  }
  .brand-slogan {
    font-size: 9px;
    margin-top: 2px;
    color: #4B5563;
  }

  .header-address {
    font-size: 8px;
    margin-top: 2px;
    color: #6B7280;
  }

  .orden-label {
    background: #F3F4F6;
    font-weight: bold;
    text-align: center;
  }
  .orden-num {
    color: #DC2626;
    font-weight: 800;
    font-size: 14px;
  }

  .grey-header {
    background: #E5E7EB;
    font-weight: bold;
  }

  .qr-box {
    border: 1px solid #6B7280;
    width: 32mm;
    height: 32mm;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #6B7280;
  }

  .section-title {
    background: ${PRIMARY_DARK};
    color: ${PRIMARY_TEXT};
    font-weight: bold;
    text-align: center;
    padding: 2px 0;
    margin-top: 4px;
    letter-spacing: 1px;
  }

  .sub-title {
    background: #E5E7EB;
    font-weight: bold;
    text-align: center;
    padding: 1px 0;
  }

  .obs-cell { height: 40px; }
  .medium-cell { height: 60px; }
  .large-cell { height: 80px; }

</style>
</head>
<body>

<!-- =================== PÁGINA 1 =================== -->
<div class="page page-break">

  <!-- ENCABEZADO con estilo del sistema -->
  <table class="no-border">
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

  <!-- DATOS DEL CLIENTE / ORDEN -->
  <table style="margin-top: 4px;">
    <tr>
      <td class="grey-header" style="width: 23%;">NOMBRE DEL CLIENTE:</td>
      <td style="width: 47%;">${esc(nombreGobierno)}</td>
      <td class="orden-label" style="width: 15%;">ORDEN DE SERVICIO:</td>
      <td class="orden-label" style="width: 15%;"><span class="orden-num">${esc(
        ordenServicio
      )}</span></td>
    </tr>
    <tr>
      <td class="grey-header">FECHA DE RECEPCIÓN:</td>
      <td>${esc(fechaRecepcion)} A LAS ${esc(horaRecepcion)} hrs</td>
      <td class="grey-header">CORREO</td>
      <td>${esc(correo)}</td>
    </tr>
    <tr>
      <td class="grey-header">RFC:</td>
      <td>${esc(rfc)}</td>
      <td class="grey-header">TELÉFONO</td>
      <td>${esc(telefonoFijo)}</td>
    </tr>
    <tr>
      <td class="grey-header">DIRECCIÓN:</td>
      <td colspan="3">${esc(direccionCompleta)}</td>
    </tr>
  </table>

  <!-- DATOS DE LA UNIDAD -->
  <table>
    <tr>
      <td class="grey-header" style="width: 12%;">MARCA</td>
      <td style="width: 13%;">${esc(marca)}</td>
      <td class="grey-header" style="width: 12%;">MODELO</td>
      <td style="width: 13%;">${esc(modelo)}</td>
      <td class="grey-header" style="width: 12%;">AÑO</td>
      <td style="width: 13%;">${esc(anio)}</td>
      <td class="grey-header" style="width: 12%;">COLOR</td>
      <td style="width: 13%;">${esc(color)}</td>
    </tr>
    <tr>
      <td class="grey-header">PLACAS</td>
      <td>${esc(placas)}</td>
      <td class="grey-header">MOTOR</td>
      <td>${esc(motor)}</td>
      <td class="grey-header">KMS/MILLAS</td>
      <td>${esc(kmsMillas)}</td>
      <td class="grey-header">NACIONALIDAD</td>
      <td>${esc(nacionalidad)}</td>
    </tr>
    <tr>
      <td class="grey-header">NO. ECONÓMICO</td>
      <td>${esc(numeroEconomico)}</td>
      <td class="grey-header">SERIE</td>
      <td colspan="3">${esc(serie)}</td>
      <td class="grey-header">GRÚA</td>
      <td>${esc(grua)}</td>
    </tr>
  </table>

  <!-- INDICADORES DEL TABLERO -->
  <div class="section-title" style="margin-top: 4px;">INDICADORES DEL TABLERO</div>
  <table>
    <tr>
      <th class="center">CHECK ENGINE</th>
      <th class="center">ABS</th>
      <th class="center">AIR BAG</th>
      <th class="center">FRENOS</th>
      <th class="center">ACEITE</th>
      <th class="center">ALTERNADOR</th>
    </tr>
    <tr>
      <td class="center">${esc(checkEngine || '')}</td>
      <td class="center">${esc(abs || '')}</td>
      <td class="center">${esc(airBag || '')}</td>
      <td class="center">${esc(frenos || '')}</td>
      <td class="center">${esc(aceite || '')}</td>
      <td class="center">${esc(alternador || '')}</td>
    </tr>
  </table>

  <!-- OTROS -->
  <div class="section-title" style="margin-top: 3px;">OTROS</div>
  <table>
    <tr><td class="medium-cell">&nbsp;</td></tr>
  </table>

  <!-- SERVICIO -->
  <div class="section-title" style="margin-top: 3px;">S E R V I C I O</div>
  <div class="sub-title">MANTENIMIENTO</div>
  <table>
    <tr>
      <th class="center" style="width:25%;">MOTOR</th>
      <th class="center" style="width:25%;">LUBRICACIÓN</th>
      <th class="center" style="width:25%;">REVISIÓN</th>
      <th class="center" style="width:25%;">OTROS SERVICIOS</th>
    </tr>
    <tr>
      <td class="large-cell"></td>
      <td class="large-cell"></td>
      <td class="large-cell"></td>
      <td class="large-cell">${serviciosTexto}</td>
    </tr>
  </table>

  <!-- FALLAS REPORTADAS -->
  <div class="section-title" style="margin-top: 3px;">FALLAS REPORTADAS POR EL CLIENTE</div>
  <table>
    <tr><td class="medium-cell">&nbsp;</td></tr>
  </table>

  <!-- INFORMACIÓN LLANTAS -->
  <div class="section-title" style="margin-top: 3px;">INFORMACIÓN DE LLANTAS</div>
  <table>
    <tr><td class="medium-cell">&nbsp;</td></tr>
  </table>

  <!-- OBSERVACIONES -->
  <div class="section-title" style="margin-top: 3px;">OBSERVACIONES</div>
  <table>
    <tr><td class="medium-cell">${esc(observaciones)}</td></tr>
  </table>

</div>

<!-- =================== PÁGINA 2 =================== -->
<div class="page">

  <div class="small center" style="margin-bottom: 4px; color:${PRIMARY_DARK}; font-weight:bold;">
    AUTOSERVICIO D Y G - ORDEN DE SERVICIO ${esc(ordenServicio)}
  </div>

  <!-- Diagnóstico del técnico -->
  <div class="section-title">DIAGNÓSTICO DEL TÉCNICO</div>
  <table>
    <tr>
      <td class="large-cell">${esc(vehiculo.diagnosticoTecnico || '')}</td>
    </tr>
  </table>

  <!-- Refacciones solicitadas -->
  <div class="section-title" style="margin-top: 3px;">TÉCNICO "REFACCIONES SOLICITADAS"</div>
  <table>
    <tr>
      <th class="center" style="width:18%;">FECHA SOLICITUD</th>
      <th class="center" style="width:12%;">CANTIDAD</th>
      <th class="center" style="width:40%;">NOMBRE DE REFACCIÓN</th>
      <th class="center" style="width:30%;">OBSERVACIONES</th>
    </tr>
    ${
      (vehiculo.refaccionesSolicitadas || [])
        .map(r => `
          <tr>
            <td class="center">${fmtFecha(
              r.fechaSolicitud || vehiculo.fechaRecepcion
            )}</td>
            <td class="center">${esc(r.cant || r.cantidad || '')}</td>
            <td>${esc(r.refaccion || r.nombre || '')}</td>
            <td>${esc(r.observaciones || '')}</td>
          </tr>
        `)
        .join('')
    }
    ${Array.from({ length: 10 }).map(() => `
      <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
    `).join('')}
  </table>

  <!-- Diagnóstico de calidad -->
  <div class="section-title" style="margin-top: 6px;">DIAGNÓSTICO DE CALIDAD</div>
  <table>
    <tr>
      <td class="label" style="width:10%;">Fecha:</td>
      <td style="width:20%;">&nbsp;</td>
      <td class="label" style="width:10%;">Hora:</td>
      <td style="width:20%;">&nbsp;</td>
      <td style="width:40%;">&nbsp;</td>
    </tr>
    <tr>
      <td colspan="5" class="large-cell">&nbsp;</td>
    </tr>
    <tr>
      <td class="label">Nombre:</td>
      <td colspan="2">&nbsp;</td>
      <td class="label">Firma:</td>
      <td>&nbsp;</td>
    </tr>
  </table>

</div>

</body>
</html>
`;
}

// ---------- FUNCIÓN PRINCIPAL PARA STREAM ----------

async function streamVehiculoOperativoPdf(res, vehiculo) {
  const html = buildOperativoHtml(vehiculo);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
  });

  await browser.close();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="orden_operativa_${vehiculo.ordenServicio}.pdf"`
  );
  res.send(pdfBuffer);
}

module.exports = { streamVehiculoOperativoPdf };
