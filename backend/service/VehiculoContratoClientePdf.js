// backend/service/VehiculoContratoClientePdf.js
// Contrato de Orden de Servicio que se entrega al cliente al recibir el vehículo.

const puppeteer = require('puppeteer');
const dayjs = require('dayjs');

// ─── Constantes de empresa ────────────────────────────────────────────────────
const EMPRESA = {
  nombre:    'AUTOSERVICIO D Y G, S. DE R.L. DE C.V.',
  rfc:       'ADG200101XXX',
  regProfeco:'4948-2023',
  direccion1:'Calle Ramón Rayón No. 1854, Col. Praderas del Sur',
  direccion2:'C.P. 32579, Cd. Juárez, Chihuahua',
  tels:      'TEL. 656 591-5922  /  TEL. 656 884-3861  /  TEL. 656 171-7407',
  horario:   'Lunes a Viernes y Sábado · Domingo Cerrado',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const esc  = (v) => (v ?? '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const chk  = (v) => v ? '&#x2611;' : '&#x2610;';                  // ☑ / ☐
const siNo = (v) => v === 'SI' ? '<b>SI</b> / NO' : v === 'NO' ? 'SI / <b>NO</b>' : 'SI / NO';
const fmtFecha = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';
const td   = (label, val, w = '') =>
  `<td class="lbl" ${w ? `style="width:${w}"` : ''}>${label}</td><td ${w ? '' : ''}>${esc(val)}</td>`;

function clienteNombre(c) {
  if (!c) return '';
  return c.gobierno?.nombreGobierno ||
    [c.nombre, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ');
}
function clienteTel(c) {
  if (!c) return '';
  const tel = (c.telefonos || [])[0] || {};
  const cel = (c.celulares || [])[0] || {};
  return [tel.lada, tel.numero].filter(Boolean).join(' ') ||
         [cel.lada, cel.numero].filter(Boolean).join(' ') || '';
}
function clienteEmail(c) {
  if (!c) return '';
  return (c.emails || [])[0] || '';
}
function clienteDireccion(c, v) {
  if (c?.direccion?.calle) {
    const d = c.direccion;
    return [d.calle, d.numeroExterior, d.numeroInterior, d.colonia].filter(Boolean).join(' ');
  }
  return '';
}
function clienteCiudad(c) {
  if (!c?.direccion) return '';
  const d = c.direccion;
  return [d.ciudad, d.estado].filter(Boolean).join(', ');
}

// ─── SVG medidor de gasolina ──────────────────────────────────────────────────
function svgGasolina(nivel) {
  const CX = 100, CY = 100, R = 70, SD = 210, ED = 330;
  const NV = [
    {pct:0,label:'E'},{pct:0.125,label:'1/8'},{pct:0.25,label:'1/4'},
    {pct:0.375,label:'3/8'},{pct:0.5,label:'1/2'},{pct:0.625,label:'5/8'},
    {pct:0.75,label:'3/4'},{pct:0.875,label:'7/8'},{pct:1,label:'F'},
  ];
  const toRad = d => d * Math.PI / 180;
  const pA    = p => toRad(SD + p * (ED - SD));
  const pXY   = (p, r) => ({ x: CX + r * Math.cos(pA(p)), y: CY + r * Math.sin(pA(p)) });
  const arc   = (p0, p1, r) => {
    const s = pXY(p0, r), e = pXY(p1, r);
    const sw = (p1 - p0) * toRad(ED - SD);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${sw > Math.PI ? 1 : 0} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  };
  const cn = NV.find(n => n.label === nivel);
  const cp = cn ? cn.pct : null;
  const nc = cp === null ? '#888' : cp <= 0.25 ? '#E24B4A' : cp <= 0.5 ? '#BA7517' : '#1D9E75';
  const na = pA(cp !== null ? cp : 0);
  const nx = (CX + 58 * Math.cos(na)).toFixed(1);
  const ny = (CY + 58 * Math.sin(na)).toFixed(1);
  const dots = NV.map(n => {
    const pos = pXY(n.pct, R);
    const active = nivel === n.label;
    return `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${active ? 5 : 3}" fill="${active ? nc : '#bbb'}"/>`;
  }).join('');
  return `<svg width="160" height="110" viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:2px auto 0;">
    <path d="${arc(0,1,R)}" fill="none" stroke="#ddd" stroke-width="4" stroke-linecap="round"/>
    ${cp !== null && cp > 0 ? `<path d="${arc(0,cp,R)}" fill="none" stroke="${nc}" stroke-width="4" stroke-linecap="round"/>` : ''}
    ${dots}
    <line x1="${CX}" y1="${CY}" x2="${nx}" y2="${ny}" stroke="${nc}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="5" fill="${nc}"/>
    <text x="18" y="112" font-size="12" font-weight="500" fill="#888" text-anchor="middle">E</text>
    <text x="182" y="112" font-size="12" font-weight="500" fill="#888" text-anchor="middle">F</text>
  </svg>`;
}

// ─── Página 1: Frente del contrato ───────────────────────────────────────────
function paginaFrente(v) {
  const c    = v.cliente || {};
  const insp = v.inspeccionFisica || {};
  const sr   = v.servicioReparacion || {};

  const nombre    = clienteNombre(c) || esc(v.nombreGobierno) || '';
  const telefono  = clienteTel(c)    || esc(v.celular || v.telefonoFijo || '');
  const email     = clienteEmail(c)  || '';
  const direccion = clienteDireccion(c, v);
  const ciudad    = clienteCiudad(c);
  const rfc       = c.rfc || v.rfc || '';
  const cp        = c.direccion?.codigoPostal || '';

  const nivel = insp.nivelGasolina || '';

  const danoImg = insp.danoVehiculo || null;

  return `
<!-- ═══════════════════ PÁGINA 1 ═══════════════════ -->
<div class="page page-break">

  <!-- ── ENCABEZADO ─────────────────────────────────────────── -->
  <table class="no-border" style="margin-bottom:3px;">
    <tr>
      <td style="width:60%;vertical-align:top;">
        <div style="font-size:14px;font-weight:900;color:#1D4ED8;letter-spacing:0.5px;">${esc(EMPRESA.nombre)}</div>
        <div style="font-size:9px;color:#374151;margin-top:2px;">
          RFC: ${esc(EMPRESA.rfc)} &nbsp;|&nbsp; REG. PROFECO ${esc(EMPRESA.regProfeco)}
        </div>
        <div style="font-size:9px;color:#374151;">${esc(EMPRESA.direccion1)}</div>
        <div style="font-size:9px;color:#374151;">${esc(EMPRESA.direccion2)}</div>
        <div style="font-size:9px;color:#374151;">${esc(EMPRESA.tels)}</div>
        <div style="font-size:9px;color:#374151;">Horario: ${esc(EMPRESA.horario)}</div>
      </td>
      <td style="width:40%;vertical-align:top;text-align:right;">
        <div style="font-size:23px;font-weight:900;color:#DC2626;letter-spacing:2px;">ORDEN DE SERVICIO</div>
        <div style="font-size:13px;font-weight:700;color:#DC2626;">${esc(v.ordenServicio||'')}</div>
        <div style="font-size:9px;margin-top:3px;">
          CONTRATO: &nbsp;
          <span style="border:1px solid #000;padding:0 4px;">${esc(v.tipoContrato||'IMPRESO')}</span>
        </div>
        <div style="font-size:9px;margin-top:2px;">
          FECHA: <b>${fmtFecha(v.fechaRecepcion)}</b> &nbsp; HORA: <b>${esc(v.horaRecepcion||'')}</b>
        </div>
      </td>
    </tr>
  </table>

  <!-- ── DATOS DEL CONSUMIDOR ───────────────────────────────── -->
  <div class="sec-title">DATOS DEL CONSUMIDOR Y/O FACTURACIÓN</div>
  <table>
    <tr>
      <td class="lbl" style="width:18%;">NOMBRE / RAZÓN SOCIAL</td>
      <td colspan="3" style="font-weight:600;">${esc(nombre)}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA DE INGRESO</td>
      <td style="width:22%;">${fmtFecha(v.fechaRecepcion)}</td>
      <td class="lbl" style="width:18%;">HORA</td>
      <td>${esc(v.horaRecepcion||'')}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td colspan="3">${esc(direccion)}</td>
    </tr>
    <tr>
      <td class="lbl">ALCALDÍA / MUNICIPIO</td>
      <td>${esc(ciudad)}</td>
      <td class="lbl">C.P.</td>
      <td>${esc(cp)}</td>
    </tr>
    <tr>
      <td class="lbl">EMAIL</td>
      <td>${esc(email)}</td>
      <td class="lbl">R.F.C.</td>
      <td>${esc(rfc)}</td>
    </tr>
    <tr>
      <td class="lbl">FORMA DE PAGO</td>
      <td>${esc(v.formaPago||'')}</td>
      <td class="lbl">MÉTODO DE PAGO</td>
      <td>${esc(v.metodoPago||'')}</td>
    </tr>
    <tr>
      <td class="lbl">ASEGURADORA</td>
      <td>${esc(v.aseguradora||'')}</td>
      <td class="lbl">PÓLIZA / SEGURO</td>
      <td>${esc(v.polizaSeguro||'')}</td>
    </tr>
  </table>

  <!-- ── DATOS DEL VEHÍCULO ─────────────────────────────────── -->
  <div class="sec-title" style="margin-top:4px;">DATOS DEL VEHÍCULO</div>
  <table>
    <tr>
      <td class="lbl" style="width:10%;">MARCA</td>
      <td style="width:15%;">${esc(v.marca||'')}</td>
      <td class="lbl" style="width:12%;">MODELO / AÑO</td>
      <td style="width:18%;">${esc(v.modelo||'')} ${esc(v.anio||'')}</td>
      <td class="lbl" style="width:10%;">COLOR</td>
      <td style="width:10%;">${esc(v.color||'')}</td>
      <td class="lbl" style="width:10%;">PLACAS</td>
      <td>${esc(v.placas||'')}</td>
    </tr>
    <tr>
      <td class="lbl">VIN / SERIE</td>
      <td colspan="3">${esc(v.serie||'')}</td>
      <td class="lbl">KMS / MILLAS</td>
      <td>${esc(v.kmsMillas||'')}</td>
      <td class="lbl">GRÚA</td>
      <td>${esc(insp.grua||'')}</td>
    </tr>
    <tr>
      <td class="lbl">TRANSMISIÓN</td>
      <td>${siNo(v.transmision==='AUT'?'SI':'NO')} AUT &nbsp; ${siNo(v.transmision==='STD'?'SI':'NO')} STD</td>
      <td class="lbl">CILINDROS</td>
      <td>${esc(v.cilindros||'')}</td>
      <td class="lbl">COMBUSTIÓN</td>
      <td colspan="3">${esc(v.combustion||'')}</td>
    </tr>
    <tr>
      <td class="lbl">LLAVES C/CONTROL</td>
      <td>${siNo(v.llavesControl)}</td>
      <td class="lbl">SEGURO RINES</td>
      <td>${siNo(v.seguroRines)}</td>
      <td class="lbl">TEL. CLIENTE</td>
      <td colspan="3">${esc(telefono)}</td>
    </tr>
  </table>

  <!-- ── INVENTARIO DEL VEHÍCULO ────────────────────────────── -->
  <div class="sec-title" style="margin-top:4px;">INVENTARIO DEL VEHÍCULO</div>
  <table>
    <tr>
      <!-- Exterior / Interior -->
      <td style="width:22%;vertical-align:top;padding:2px;">
        <div class="sub-lbl">EXTERIOR</div>
        <div class="chk-row">${chk(insp.cristalesExt)} Cristales</div>
        <div class="chk-row">${chk(insp.limpiadoresExt)} Limpiadores</div>
        <div class="chk-row">${chk(insp.espejoLateralIzq)} Espejo Lat. Izq.</div>
        <div class="chk-row">${chk(insp.espejoLateralDer)} Espejo Lat. Der.</div>
        <div class="chk-row">${chk(insp.focosDel)} Focos Delanteros</div>
        <div class="chk-row">${chk(insp.focosTras)} Focos Traseros</div>
        <div style="margin-top:4px;" class="sub-lbl">INTERIOR</div>
        <div class="chk-row">${chk(insp.cristalesInt)} Cristales Int.</div>
        <div class="chk-row">${chk(insp.limpiadoresInt)} Limpiadores Int.</div>
        <div class="chk-row">${chk(insp.espejoInt)} Espejo Interior</div>
        <div class="chk-row">${chk(insp.tapetesDelanterosIzq)} Tapetes Del. Izq.</div>
        <div class="chk-row">${chk(insp.tapetesDelanterosDer)} Tapetes Del. Der.</div>
        <div class="chk-row">${chk(insp.tapetesTraserosIzq)} Tapetes Tras. Izq.</div>
        <div class="chk-row">${chk(insp.tapetesTraserosDer)} Tapetes Tras. Der.</div>
        <div class="chk-row">${chk(insp.estereo)} Estéreo</div>
        <div class="chk-row">${chk(insp.encendedor)} Encendedor</div>
      </td>
      <!-- Accesorios -->
      <td style="width:22%;vertical-align:top;padding:2px;">
        <div class="sub-lbl">ACCESORIOS</div>
        <div class="chk-row">${chk(insp.copasDelanterasIzq)} Copas Del. Izq.</div>
        <div class="chk-row">${chk(insp.copasDelanterasDer)} Copas Del. Der.</div>
        <div class="chk-row">${chk(insp.copasTraserasIzq)} Copas Tras. Izq.</div>
        <div class="chk-row">${chk(insp.copasTraserasDer)} Copas Tras. Der.</div>
        <div class="chk-row">${chk(insp.micas)} Micas</div>
        <div class="chk-row">${chk(insp.antena)} Antena</div>
        <div class="chk-row">${chk(insp.gato)} Gato</div>
        <div class="chk-row">${chk(insp.bateria)} Batería</div>
        <div class="chk-row">${chk(insp.llaveRueda)} Llave de Rueda</div>
        <div class="chk-row">${chk(insp.extintor)} Extintor</div>
        <div class="chk-row">${chk(insp.llantaExtra)} Llanta Extra</div>
        <div class="chk-row">${chk(insp.cablesCorrente)} Cables Corriente</div>
        <div class="chk-row">${chk(insp.cruceta)} Cruceta</div>
        <div class="chk-row">${chk(insp.extra)} Extra</div>
        <div style="margin-top:4px;">
          <span class="sub-lbl">PARABRISAS:</span>
          <span style="margin-left:4px;">${esc(insp.parabrisas||'')}</span>
        </div>
      </td>
      <!-- Nivel gasolina + testigos tablero -->
      <td style="width:28%;vertical-align:top;padding:2px;">
        <div class="sub-lbl" style="display:flex;justify-content:space-between;align-items:center;">
          <span>NIVEL DE COMBUSTIBLE</span>
          ${nivel ? `<span style="font-size:11px;font-weight:900;color:${['E','1/8','1/4'].includes(nivel)?'#E24B4A':['3/8','1/2'].includes(nivel)?'#BA7517':'#1D9E75'};">${nivel}</span>` : '<span style="font-size:9px;font-weight:400;color:#9CA3AF;">Sin capturar</span>'}
        </div>
        ${svgGasolina(nivel)}
        ${v.combustion ? `<div style="text-align:center;font-size:9px;margin-top:3px;color:#374151;">Tipo: <b>${esc(v.combustion)}</b></div>` : ''}

        <div class="sub-lbl" style="margin-top:8px;">TESTIGOS DEL TABLERO</div>
        <table style="margin-top:3px;font-size:10px;">
          <tr>
            <td class="center" style="background:#E5E7EB;font-weight:600;">INDICADOR</td>
            <td class="center" style="background:#E5E7EB;font-weight:600;">ESTADO</td>
          </tr>
          <tr><td>Check Engine</td><td class="center">${esc(insp.checkEngine||'')}</td></tr>
          <tr><td>ABS</td><td class="center">${esc(insp.abs||'')}</td></tr>
          <tr><td>Air Bag</td><td class="center">${esc(insp.airBag||'')}</td></tr>
          <tr><td>Frenos</td><td class="center">${esc(insp.frenos||'')}</td></tr>
          <tr><td>Aceite</td><td class="center">${esc(insp.aceite||'')}</td></tr>
          <tr><td>Alternador</td><td class="center">${esc(insp.alternador||'')}</td></tr>
          ${insp.otros ? `<tr><td>Otros</td><td class="center">${esc(insp.otros)}</td></tr>` : ''}
        </table>
        ${insp.observaciones ? `<div style="margin-top:4px;font-size:10px;"><b>Obs.:</b> ${esc(insp.observaciones)}</div>` : ''}
      </td>
      <!-- Daños del vehículo -->
      <td style="width:28%;vertical-align:top;padding:2px;">
        <div class="sub-lbl">DAÑOS DEL VEHÍCULO</div>
        ${danoImg
          ? `<img src="${danoImg}" style="width:100%;height:auto;border:1px solid #ddd;border-radius:3px;margin-top:3px;display:block;" />`
          : `<div style="width:100%;height:160px;border:1px solid #ddd;border-radius:3px;background:#f9f9f9;margin-top:3px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:9px;">Sin daños registrados</div>`
        }
      </td>
    </tr>
  </table>

  <!-- ── INSPECCIÓN TÉCNICA A-E ─────────────────────────────── -->
  <div class="sec-title" style="margin-top:4px;">INSPECCIÓN TÉCNICA</div>
  <table>
    <tr>
      <!-- A) Llantas -->
      <td style="width:20%;vertical-align:top;padding:3px;">
        <div class="sub-lbl">A) LLANTAS</div>
        <div style="font-size:9px;">Medida: <span style="border-bottom:1px solid #000;display:inline-block;width:55px;">&nbsp;</span></div>
        <table style="font-size:9px;margin-top:2px;">
          <tr><th></th><th class="center">DEL</th><th class="center">TRAS</th></tr>
          <tr><td>Alineación</td><td class="center">&#x2610;</td><td class="center">&#x2610;</td></tr>
          <tr><td>Balanceo</td><td class="center">&#x2610;</td><td class="center">&#x2610;</td></tr>
          <tr><td>Montajes</td><td class="center">&#x2610;</td><td class="center">&#x2610;</td></tr>
          <tr><td>Válvulas</td><td class="center">&#x2610;</td><td class="center">&#x2610;</td></tr>
          <tr><td>Rotación</td><td class="center" colspan="2">&#x2610;</td></tr>
        </table>
        <div style="font-size:9px;margin-top:2px;">
          Rep. Llanta: NOR &#x2610; DEP &#x2610;<br/>
          Testigo TPMS: SI &#x2610; NO &#x2610;<br/>
          Obs.: <span style="border-bottom:1px solid #000;display:inline-block;width:80px;">&nbsp;</span>
        </div>
      </td>
      <!-- B) Suspensión -->
      <td style="width:20%;vertical-align:top;padding:3px;">
        <div class="sub-lbl">B) SUSPENSIÓN Y DIRECCIÓN</div>
        <table style="font-size:9px;margin-top:2px;">
          <tr><th></th><th class="center">DEL</th><th class="center">TRAS</th></tr>
          <tr><td>Amortiguadores</td>
            <td class="center"><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
            <td class="center"><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
          </tr>
          <tr><td>Partes/Ruidos</td>
            <td class="center"><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
            <td class="center"><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
          </tr>
          <tr><td>Dirección</td>
            <td class="center" colspan="2"><span style="border-bottom:1px solid #000;display:inline-block;width:55px;">&nbsp;</span></td>
          </tr>
        </table>
        <div style="font-size:9px;margin-top:2px;">Obs.: <span style="border-bottom:1px solid #000;display:inline-block;width:80px;">&nbsp;</span></div>
      </td>
      <!-- C) Afinación -->
      <td style="width:20%;vertical-align:top;padding:3px;">
        <div class="sub-lbl">C) AFINACIÓN</div>
        <table style="font-size:9px;margin-top:2px;">
          <tr><td>Cilindros:</td><td>4&#x2610; 6&#x2610; 8&#x2610;</td></tr>
          <tr><td>Carbs/Inyec/Turbo:</td><td>&#x2610;</td></tr>
          <tr><td>Check Engine:</td><td>SI&#x2610; NO&#x2610;</td></tr>
          <tr><td>Falla Motor:</td><td>SI&#x2610; NO&#x2610;</td></tr>
          <tr><td>Reset Aceite:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span></td></tr>
          <tr><td>Reset Mant.:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span></td></tr>
          <tr><td>Cambio Aceite:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span></td></tr>
          <tr><td>Lavado/Engr.:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span></td></tr>
          <tr><td>Verif. Veh.:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span></td></tr>
          <tr><td>Diag. Scanner:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span></td></tr>
        </table>
      </td>
      <!-- D) Frenos -->
      <td style="width:20%;vertical-align:top;padding:3px;">
        <div class="sub-lbl">D) FRENOS</div>
        <table style="font-size:9px;margin-top:2px;">
          <tr><th></th><th class="center">DEL</th><th class="center">TRAS</th></tr>
          <tr><td>Estado</td>
            <td><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
            <td><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
          </tr>
          <tr><td>Limpieza/Ajuste</td>
            <td><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
            <td><span style="border-bottom:1px solid #000;display:inline-block;width:22px;">&nbsp;</span></td>
          </tr>
          <tr><td>Conformado</td><td class="center">&#x2610;</td><td class="center">&#x2610;</td></tr>
        </table>
        <div style="font-size:9px;margin-top:2px;">
          ABS: SI&#x2610; NO&#x2610;<br/>
          Liq. Frenos: <span style="border-bottom:1px solid #000;display:inline-block;width:40px;">&nbsp;</span><br/>
          Cambio/Purgado: <span style="border-bottom:1px solid #000;display:inline-block;width:30px;">&nbsp;</span><br/>
          Obs.: <span style="border-bottom:1px solid #000;display:inline-block;width:60px;">&nbsp;</span>
        </div>
      </td>
      <!-- E) Motor -->
      <td style="width:20%;vertical-align:top;padding:3px;">
        <div class="sub-lbl">E) MOTOR</div>
        <table style="font-size:9px;margin-top:2px;">
          <tr><td>Ajuste Motor:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:45px;">&nbsp;</span></td></tr>
          <tr><td>Transmisión:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:45px;">&nbsp;</span></td></tr>
          <tr><td>Embrague/Clutch:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:45px;">&nbsp;</span></td></tr>
          <tr><td>Sist. Enfriamiento:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:45px;">&nbsp;</span></td></tr>
          <tr><td>Liq. Frenos:</td><td><span style="border-bottom:1px solid #000;display:inline-block;width:45px;">&nbsp;</span></td></tr>
        </table>
        <div style="font-size:9px;margin-top:2px;">Obs.: <span style="border-bottom:1px solid #000;display:inline-block;width:80px;">&nbsp;</span></div>
      </td>
    </tr>
  </table>

  <!-- ── PRESTADOR / AVISO / FIRMAS ─────────────────────────── -->
  <table style="margin-top:4px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding:3px;font-size:9px;">
        <b>PRESTADOR DEL SERVICIO:</b>
        <div style="border-bottom:1px solid #000;height:24px;margin-top:3px;">&nbsp;</div>
        <div style="margin-top:3px;">RAMÓN RAYÓN No. 1854, COL. PRADERAS DEL SUR, CP 32579, JUÁREZ, CHIHUAHUA</div>
        <div style="margin-top:5px;font-weight:700;font-size:10px;">INDISPENSABLE PRESENTAR ESTE TALÓN PARA LA ENTREGA DE SU VEHÍCULO</div>
        <div style="margin-top:3px;">DÍAS Y HORARIOS DE ATENCIÓN AL PÚBLICO: LUNES A VIERNES Y SÁBADO</div>
        <div style="margin-top:3px;font-size:9px;color:#374151;">(NO NOS HACEMOS RESPONSABLES POR OBJETOS OLVIDADOS)</div>
      </td>
      <td style="width:50%;vertical-align:top;padding:3px;font-size:9px;">
        <b>CONSUMIDOR:</b> Aceptando el presupuesto, el prestador del servicio se obliga a devolver el automóvil en las condiciones del diagnóstico.
        <div style="margin-top:8px;text-align:center;">
          <div style="display:inline-block;width:45%;border-top:1px solid #000;text-align:center;padding-top:2px;font-size:10px;">FIRMA CONSUMIDOR</div>
          &nbsp;&nbsp;
          <div style="display:inline-block;width:45%;border-top:1px solid #000;text-align:center;padding-top:2px;font-size:10px;">FIRMA PRESTADOR</div>
        </div>
        <table style="margin-top:8px;font-size:10px;border:none;">
          <tr>
            <td style="border:none;">FECHA: ___/___/______</td>
            <td style="border:none;">DÍA ____ MES ____ AÑO ____</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</div>`;
}

// ─── Página 2: Cláusulas ─────────────────────────────────────────────────────
function paginaCláusulas() {
  return `
<!-- ═══════════════════ PÁGINA 2 ═══════════════════ -->
<div class="page">

  <div style="text-align:center;font-weight:900;font-size:13px;margin-bottom:7px;letter-spacing:1px;">
    ADEMÁS DE LOS ELEMENTOS CONTENIDOS EN EL REVERSO DEL PRESENTE CONTRATO DE PRESTACIÓN DE SERVICIOS DE REPARACIÓN Y/O MANTENIMIENTO DE VEHÍCULOS, LAS PARTES SE SUJETAN A LAS SIGUIENTES:
  </div>

  <div style="font-size:9px;font-weight:900;text-align:center;margin-bottom:5px;letter-spacing:2px;background:#1D4ED8;color:#fff;padding:3px;">
    C L Á U S U L A S
  </div>

  <div class="clausulas">

    <p><b>PRIMERA.-</b> EL PRESTADOR DEL SERVICIO realizará todas las operaciones y servicios solicitados por EL CONSUMIDOR que se asientan en el anverso del presente contrato, a las que se someten a las restricciones que operan de la comercialización de este servicio, debiendo EL PRESTADOR DEL SERVICIO no condicionar la prestación de los servicios al CONSUMIDOR para que suscriba el presente contrato.</p>

    <p><b>SEGUNDA.-</b> El precio total de los servicios contratados se establece en el presupuesto que forma parte del presente y se describe en el anverso del mismo. EL PRESTADOR DEL SERVICIO no condicionará el precio total al consumidor para que firme el contrato y se compromete a realizar el servicio solicitado al costo que se indica en el anverso del presente contrato, ya sea en efectivo, cheque, tarjeta de crédito o débito o transferencia bancaria. El pago será en el momento de la entrega del vehículo, salvo que las partes acuerden otra forma distinta o acepten un pago en favor del establecimiento.</p>

    <p><b>TERCERA.-</b> EL PRESTADOR DEL SERVICIO pondrá a disposición de EL CONSUMIDOR los precios de llantas, cámaras, servicios de mano de obra, refacciones y materiales que sean autorizados por EL CONSUMIDOR. El tiempo de que se trata la cláusula anterior podrá ser avalado por el prestador conforme a los PUNTOS DE VERIFICACIÓN que determine el propio establecimiento.</p>

    <p><b>CUARTA.-</b> La entrega del vehículo se realizará siempre y cuando los costos incurridos exceda al 20% del presupuesto. Si el incremento excede al importe del presupuesto aceptado, se deberá modificar la fecha contemplada en la fecha contemplada en el anverso del presente contrato. Para el caso de que EL CONSUMIDOR sea el que proporcione las refacciones, la cantidad del servicio será el que se especifique en el presupuesto, el costo de las refacciones será el acordado previamente.</p>

    <p><b>QUINTA.-</b> EL PRESTADOR DEL SERVICIO utilizará exclusivamente para los trabajos objeto de este contrato, materiales, partes nuevas y apropiadas, mismas que serán enunciadas en el presupuesto expreso y por escrito. EL PRESTADOR DEL SERVICIO autoriza expresamente a que el servicio sea utilizado en el presupuesto directamente de uso sin otras. Si EL PRESTADOR DEL SERVICIO sustituye materiales y/o partes distintas a las utilizadas, contará en los casos en los casos en los siguientes casos: a) cuando EL CONSUMIDOR lo autorice expresamente; b) cuando los precios de los refacciones sean sustituidos en la reparación y/o mantenimiento del vehículo, en consecuencia de acuerdo a las disposiciones legales aplicables.</p>

    <p><b>SÉPTIMA.-</b> Las reparaciones a que se refiere el presente contrato, tienen una garantía de 90 días contados a partir de la fecha de entrega del vehículo, de conformidad con las especificaciones del fabricante, de las partes y/o refacciones, esto en cuanto a la mano de obra. Si el vehículo es intervenido por un tercero EL PRESTADOR DEL SERVICIO, deberá presentar al CONSUMIDOR comprobante para hacer efectiva la garantía otorgada. Para tal efecto EL PRESTADOR DEL SERVICIO entregará al CONSUMIDOR comprobante de garantía en el anverso del presente contrato.</p>

    <p><b>OCTAVA.-</b> Si el vehículo es intervenido por un tercero EL PRESTADOR DEL SERVICIO, deberá presentar al CONSUMIDOR comprobante de los trabajos realizados, asimismo EL CONSUMIDOR deberá presentar al PRESTADOR DEL SERVICIO, para lo cual EL CONSUMIDOR deberá presentar al servicio de garantía el vehículo, en cumplimiento a la garantía del plazo de garantía, en el tiempo que dure la reparación y/o mantenimiento del vehículo en EL SERVICIO, en garantía de la misma. Los gastos enunciados en EL PRESTADOR DEL SERVICIO, para lo cual EL CONSUMIDOR deberá hacer válida la garantía en los domicilios que se indiquen al contrario para cursar por este motivo.</p>

    <p><b>NOVENA.-</b> EL PRESTADOR DEL SERVICIO hace constar que en un domicilio diverso al de EL SERVICIO, deberán desistirse en el lugar que se indique en el contrato, en cuyo caso deberá autorizar EL CONSUMIDOR, autoriza al PRESTADOR DEL SERVICIO para realizar pruebas de manejo o de verificación de las reparaciones en los vehículos de paro por sus empleados. Los daños causados al vehículo de EL CONSUMIDOR, cuando EL CONSUMIDOR, o el empleado de EL SERVICIO, cuando EL CONSUMIDOR, solicite que dicha persona que dure el recorrido será de cuenta de EL CONSUMIDOR.</p>

    <p><b>DÉCIMA.-</b> Cuando se preste el servicio a domicilio, EL PRESTADOR DEL SERVICIO, se hace responsable de los daños a terceros que surjan con la realización del mismo, siempre que tales daños hayan surgido con relación al vehículo. EL PRESTADOR DEL SERVICIO, se obliga a expedir la factura o comprobante del servicio a EL CONSUMIDOR, aún con la suma que se le adeude por los trabajos efectuados, en la que se especificará, en la que se le especificará un costo, con la suma de los cargos correspondientes, así como los danos que se puedan adeudarse en el incumplimiento de las partes a las obligaciones contratadas en el presente contrato, el 15% del precio total de la operación.</p>

    <p><b>DÉCIMA PRIMERA.-</b> Se establece como importe mínimo el que se encuentre vigente en el lugar que tenga EL SERVICIO cuando se trate de servicios a domicilio como pena convencional por el incumplimiento de cualesquiera de las partes a las obligaciones contraídas en el presente contrato.</p>

    <p><b>DÉCIMA SEGUNDA.-</b> El anticipo que EL CONSUMIDOR pague a EL PRESTADOR DEL SERVICIO en el momento de la contratación del servicio de reparación y/o mantenimiento del vehículo, en la que deberá desistir en el lugar donde se vaya a realizar el servicio, importe del precio contratado al retiro del vehículo, incluida las partes, refacciones y otros materiales utilizados.</p>

    <p><b>DÉCIMA TERCERA.-</b> El precio contratado para el servicio de reparación y/o mantenimiento es en Pesos Mexicanos Moneda Nacional. Sin embargo, si hubiere incremento en el precio del mismo, las partes acuerdan que se someterán a la jurisdicción de los tribunales competentes de la Ciudad de Juárez, Chihuahua, o cualquier otra razón.</p>

    <p><b>DÉCIMA CUARTA.-</b> EL PRESTADOR DEL SERVICIO podrá llevar a cabo la reparación y/o mantenimiento solicitado, así como hacer efectiva la garantía otorgada, con la compañía que tenga capacidad para ello, siempre y cuando, previa autorización de EL CONSUMIDOR, de lo anterior deberá responsabilizarse de resguardar el vehículo en todo momento.</p>

    <p><b>DÉCIMA QUINTA.-</b> EL PRESTADOR DEL SERVICIO notificará a EL CONSUMIDOR de la terminación del servicio en cualquier momento durante el día en que haya notificado de servicio que EL CONSUMIDOR, haya notificado el vehículo, mientras se encuentren en su poder el vehículo bajo su responsabilidad, hasta que EL CONSUMIDOR recoja el vehículo. EL PRESTADOR DEL SERVICIO se hace responsable de los daños parciales o totales imputables a él o a sus empleados que sufra el vehículo, el equipo, y aditamentos de EL CONSUMIDOR.</p>

    <p><b>DÉCIMA SEXTA.-</b> La responsabilidad que el CONSUMIDOR, tiene en lo relativo a información y publicidad, promociones y/o servicios que le sean proporcionados, así como el pago o abonos a la información que se brinde a terceros, su responsabilidad queda con relación al origen, propiedad, posesión o cualquier otro derecho inherente al vehículo o componentes del mismo.</p>

    <p><b>DÉCIMA SÉPTIMA.-</b> EL PRESTADOR DEL SERVICIO declara que cuenta con medidas de seguridad administrativas, técnicas y físicas que permiten su protección contra daños, alteración, pérdida, destrucción o uso indebido de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y con las diversas disposiciones legales sobre confidencialidad y protección de datos.</p>

    <p><b>DÉCIMA OCTAVA.-</b> La Procuraduría Federal del Consumidor es competente en la vía administrativa para resolver cualquier controversia que se suscite sobre la interpretación o cumplimiento del presente Contrato. Sin perjuicio de lo anterior, las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de Juárez, Chihuahua, o de su domicilio correspondiente, por razón de su domicilio o de cualquier otra razón.</p>

    <p><b>DÉCIMA NONA.-</b> EL PRESTADOR DEL SERVICIO declara que conoce y se obliga a observar en lo relativo a información y publicidad, las disposiciones previstas en los capítulos II y IV de la Ley Federal del Consumidor.</p>

    <p><b>VIGÉSIMA.-</b> En caso de violaciones a los derechos del CONSUMIDOR o incumplimiento del presente contrato, el CONSUMIDOR puede presentar su queja ante la PROCURADURÍA FEDERAL DEL CONSUMIDOR, BAJO EL NÚMERO 4948-2023, DE FECHA 18 DE MAYO DE 2023. CUALQUIER VARIACIÓN DEL CONTRATO DE ADHESIÓN REGISTRADO ANTE EL PROFECO, SETENDERÁ POR NO PUESTA.</p>

  </div>

  <!-- Firmas finales -->
  <table style="margin-top:10px;">
    <tr>
      <td style="width:50%;text-align:center;padding:6px;font-size:9px;vertical-align:bottom;">
        <div style="border-top:1px solid #000;padding-top:3px;margin-top:30px;">
          EL CONSUMIDOR
        </div>
      </td>
      <td style="width:50%;text-align:center;padding:6px;font-size:9px;vertical-align:bottom;">
        <div style="border-top:1px solid #000;padding-top:3px;margin-top:30px;">
          EL PRESTADOR DEL SERVICIO
        </div>
      </td>
    </tr>
  </table>

  <div style="margin-top:10px;font-size:9px;text-align:center;color:#374151;">
    QUEJAS Y RECLAMACIONES A LOS TELÉFONOS, DOMICILIO Y EN LOS HORARIOS QUE SE ASIENTAN EN EL ANVERSO DE ESTE CONTRATO.<br/>
    A los teléfonos, domicilio y en los horarios que se asientan en el anverso del contrato.
  </div>

  <div style="margin-top:8px;font-size:9px;text-align:center;border-top:1px solid #ccc;padding-top:5px;">
    ATENDIDO POR: ___________________________________
  </div>

</div>`;
}

// ─── HTML completo ────────────────────────────────────────────────────────────
function buildHtml(vehiculo) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Contrato OS ${esc(vehiculo.ordenServicio||'')}</title>
<style>
  * { box-sizing:border-box; font-family:Arial,sans-serif; }
  body { margin:0; padding:0; font-size:10.5px; }

  .page {
    width:210mm; min-height:297mm;
    padding:6mm 7mm 7mm 7mm;
    margin:0 auto; position:relative;
  }
  .page-break { page-break-after:always; }

  table { border-collapse:collapse; width:100%; }
  td, th { border:0.8px solid #000; padding:2px 4px; vertical-align:middle; }
  .no-border td, .no-border th { border:none; }

  .sec-title {
    background:#1D4ED8; color:#fff;
    font-weight:700; font-size:10.5px;
    text-align:center; padding:2px 0;
    letter-spacing:1px; margin-top:4px;
  }
  .sub-lbl {
    font-weight:700; font-size:9.5px;
    background:#E5E7EB; padding:1px 3px;
    margin-bottom:2px;
  }
  .lbl { background:#F3F4F6; font-weight:600; white-space:nowrap; }
  .center { text-align:center; }
  .right { text-align:right; }
  .chk-row { font-size:9.5px; line-height:1.65; }

  .clausulas { font-size:9px; line-height:1.48; text-align:justify; columns:2; column-gap:8mm; }
  .clausulas p { margin:0 0 5px 0; }
</style>
</head>
<body>
${paginaFrente(vehiculo)}
${paginaCláusulas()}
</body>
</html>`;
}

// ─── Función principal ────────────────────────────────────────────────────────
async function streamVehiculoContratoClientePdf(res, vehiculo) {
  const html = buildHtml(vehiculo);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '4mm', bottom: '4mm', left: '5mm', right: '5mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="contrato_${vehiculo.ordenServicio||'orden'}.pdf"`
    );
    res.send(pdfBuffer);
  } finally {
    await browser.close();
  }
}

module.exports = { streamVehiculoContratoClientePdf };
