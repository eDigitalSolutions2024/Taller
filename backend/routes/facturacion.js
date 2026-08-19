// backend/routes/facturacion.js
// Vista previa en PDF de los 3 tipos de comprobante:
//  - factura          (CFDI de Ingreso)
//  - notaCredito      (CFDI de Egreso)
//  - complementoPago  (CFDI de Pago / Recibo electrónico de pago)
const express = require("express");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const path = require("path");
const FiscalConfig = require("../models/FiscalConfig");
const FacturaCfdi = require("../models/FacturaCfdi");
const Vehiculo = require("../models/Vehiculo");

const router = express.Router();

/* =========================
   HELPERS
========================= */
function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function safe(s) {
  return String(s || "").trim();
}
/* Domicilio fiscal del receptor en 2 líneas: calle/número/colonia y ciudad/estado/CP/país */
function formatDireccion(direccion, pais) {
  const d = direccion || {};
  const linea1 = [
    safe(d.calle),
    safe(d.numeroExterior) && `# ${safe(d.numeroExterior)}`,
    safe(d.numeroInterior) && `Int. ${safe(d.numeroInterior)}`,
    safe(d.colonia) && `${safe(d.colonia)}`,
  ]
    .filter(Boolean)
    .join(", ");
  const linea2 = [
    safe(d.ciudad),
    safe(d.estado),
    safe(d.codigoPostal) && `C.P. ${safe(d.codigoPostal)}`,
    safe(pais),
  ]
    .filter(Boolean)
    .join(", ");
  return { linea1: linea1 || "—", linea2: linea2 || "—" };
}
// Domicilio impreso del emisor: no vive en FiscalConfig (que solo guarda el CP
// de expedición), así que se usa el mismo domicilio fijo que ya imprimen las
// demás plantillas del sistema (orden de compra, vales de salida, reportes).
const EMISOR_DIRECCION_LINEA1 = "PASEO TRIUNFO DE LA REPÚBLICA #322-B";
const EMISOR_DIRECCION_LINEA2 = "COL. SAN LORENZO, C.P. 32320, CD. JUÁREZ, CHIH.";

function fechaHora(d = new Date()) {
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const FORMA_PAGO_LABELS = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito",
  "05": "Monedero electrónico",
  "06": "Dinero electrónico",
  "08": "Vales de despensa",
  "12": "Dación en pago",
  "13": "Pago por subrogación",
  "14": "Pago por consignación",
  "15": "Condonación",
  "17": "Compensación",
  "23": "Novación",
  "24": "Confusión",
  "25": "Remisión de deuda",
  "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor",
  "28": "Tarjeta de débito",
  "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos",
  "31": "Intermediario pagos",
  "99": "Por definir",
};

function formaPagoLabel(code) {
  const c = safe(code);
  return c ? `${c} - ${FORMA_PAGO_LABELS[c] || ""}`.trim() : "—";
}

/* Textos variables del comprobante: por defecto los de la vista previa
   (sin folio ni sellos); el PDF de una factura ya guardada los sobreescribe. */
function buildMeta(overrides = {}) {
  return {
    folio: "(se asigna al generar)",
    fechaEmision: fechaHora(),
    fechaCertificacion: "— (sin timbrar)",
    uuid: "— (se asigna al timbrar)",
    sello: "— disponible al generar/timbrar el XML —",
    selloSat: "— disponible al timbrar —",
    cadena: "— disponible al timbrar —",
    pieSufijo: " — VISTA PREVIA SIN TIMBRADO",
    ...overrides,
  };
}

/* Cantidad con letra: "DOS MIL SETECIENTOS CINCUENTA PESOS 00/100 M.N." */
const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DIECES = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const DECENAS = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function tresDigitosALetras(n) {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let out = "";
  const c = Math.floor(n / 100);
  const du = n % 100;
  const d = Math.floor(du / 10);
  const u = du % 10;
  if (c) out += CENTENAS[c] + " ";
  if (du >= 10 && du <= 19) out += DIECES[du - 10];
  else if (du === 20) out += "VEINTE";
  else if (du > 20 && du < 30) out += "VEINTI" + UNIDADES[u];
  else {
    if (d) out += DECENAS[d] + (u ? " Y " : "");
    if (u) out += UNIDADES[u];
  }
  return out.trim();
}

function numeroALetras(monto) {
  const abs = Math.abs(Number(monto || 0));
  const entero = Math.floor(abs);
  const cents = Math.round((abs - entero) * 100);

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;

  let letras = "";
  if (millones) letras += (millones === 1 ? "UN MILLON" : `${tresDigitosALetras(millones)} MILLONES`) + " ";
  if (miles) letras += (miles === 1 ? "MIL" : `${tresDigitosALetras(miles)} MIL`) + " ";
  if (resto) letras += tresDigitosALetras(resto);
  if (!letras.trim()) letras = "CERO";

  return `${letras.trim().replace(/\s+/g, " ")} PESOS ${String(cents).padStart(2, "0")}/100 M.N.`;
}

/* =========================
   PRIMITIVAS DE DIBUJO
   Estilo propio: acentos en rojo marca (el mismo BRAND_RED que usaba la
   vista previa original de Taller antes de este formato), tarjetas con
   franja superior en vez de una sola caja con divisiones, y una tabla de
   conceptos de un solo renglón por partida (sin el sub-renglón de impuesto).
========================= */
const PAGE_W = 612;
const PAGE_H = 792;
const M = 24;
const W = PAGE_W - M * 2; // 564

const ACCENT = "#8f1d1d";
const INK = "#1f2937";
const MUTED = "#6b7280";
const HAIRLINE = "#d9d9d9";
const ZEBRA = "#f8f3f3";
const TOTALS_BG = "#faf5f5";

function makeUi(doc) {
  const ui = {};

  ui.fillRect = (x, y, w, h, color) => {
    doc.save();
    doc.fillColor(color).rect(x, y, w, h).fill();
    doc.restore();
  };

  ui.rule = (x, y, w, color = HAIRLINE, lineW = 0.75) => {
    doc.moveTo(x, y).lineTo(x + w, y).strokeColor(color).lineWidth(lineW).stroke();
  };

  // Tarjeta con franja de color arriba (en vez de la caja con divisiones
  // verticales de otros formatos).
  ui.card = (x, y, w, h, fill = "#ffffff") => {
    ui.fillRect(x, y, w, h, fill);
    doc.strokeColor(HAIRLINE).lineWidth(0.6).rect(x, y, w, h).stroke();
    ui.fillRect(x, y, w, 3, ACCENT);
  };

  // Etiqueta pequeña en mayúsculas, color de acento (encabezado de sección)
  ui.sectionLabel = (text, x, y, w) => {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ACCENT);
    doc.text(String(text || "").toUpperCase(), x, y, { width: w });
    doc.fillColor(INK).font("Helvetica");
  };

  // "Etiqueta: valor" en una línea (etiqueta muted, valor en tinta normal)
  ui.kv = (x, y, label, value, labelW, totalW, fontSize = 8) => {
    doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(MUTED).text(label, x, y, { width: labelW });
    doc.font("Helvetica").fontSize(fontSize).fillColor(INK).text(safe(value) || "—", x + labelW, y, {
      width: totalW - labelW,
    });
    doc.fillColor(INK);
  };

  // Texto en un solo renglón: recorta con "…" lo que no quepa en el ancho dado
  // (sellos y cadena original son cadenas muy largas).
  ui.oneLine = (text, x, y, w, fontSize = 6.5) => {
    doc.fontSize(fontSize);
    let t = safe(text);
    if (doc.widthOfString(t) > w) {
      while (t.length > 1 && doc.widthOfString(`${t}…`) > w) t = t.slice(0, -1);
      t += "…";
    }
    doc.text(t, x, y, { width: w, lineBreak: false });
  };

  // Dibuja el logo dentro de una caja maxW x maxH, respetando su proporción
  // (nunca lo estira ni deja que domine el encabezado). Devuelve el tamaño
  // real dibujado para poder acomodar el texto junto a él.
  ui.logo = (x, y, maxW, maxH) => {
    const logoPath = path.join(__dirname, "..", "assets", "logo.png");
    try {
      const img = doc.openImage(logoPath);
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      doc.image(img, x, y, { width: w, height: h });
      return { w, h };
    } catch (e) {
      return { w: 0, h: 0 };
    }
  };

  ui.qrPlaceholder = (x, y, size) => {
    doc.strokeColor(HAIRLINE).lineWidth(0.6).rect(x, y, size, size).stroke();
    doc.font("Helvetica").fontSize(6).fillColor(MUTED);
    doc.text("QR\n(al timbrar)", x, y + size / 2 - 7, { width: size, align: "center" });
    doc.fillColor(INK);
  };

  return ui;
}

const LOGO_MAX_W = 52;
const LOGO_MAX_H = 46;

/* Encabezado común de factura / nota de crédito: logo chico + datos del
   emisor a la izquierda, título grande en color de acento + folio/fecha a la
   derecha, y una franja de color como separador (sin la caja-con-barra-negra
   de otros formatos). El UUID/fecha de certificación quedan junto a los
   sellos en el pie, que es donde de verdad importan una vez que exista
   timbrado real. */
function drawHeaderComprobante(doc, ui, { emisor, tipoLabel, meta }) {
  const m = meta || buildMeta();
  const headerY = M;

  const logo = ui.logo(M, headerY, LOGO_MAX_W, LOGO_MAX_H);

  const rightColW = 190;
  const textX = M + (logo.w || LOGO_MAX_W) + 12;
  const textW = W - (logo.w || LOGO_MAX_W) - 12 - rightColW - 10;

  let ty = headerY;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
  doc.text(safe(emisor.nombre) || "EMISOR (configura la Configuración Fiscal)", textX, ty, { width: textW });
  ty += 15;
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
  doc.text(`RFC ${safe(emisor.rfc) || "—"}  ·  Régimen ${safe(emisor.regimenFiscal) || "—"}`, textX, ty, { width: textW });
  ty += 11;
  doc.text(EMISOR_DIRECCION_LINEA1, textX, ty, { width: textW });
  ty += 10;
  doc.text(EMISOR_DIRECCION_LINEA2, textX, ty, { width: textW });
  ty += 10;
  doc.text(`Tel ${safe(emisor.telefono) || "—"}  ·  Cert. ${safe(emisor.noCertificado) || "—"}`, textX, ty, { width: textW });

  // Derecha: título grande + folio/fecha
  const rightX = M + W - rightColW;
  const tituloTexto = tipoLabel === "Egreso" ? "NOTA DE CRÉDITO" : "FACTURA";
  doc.font("Helvetica-Bold").fontSize(19).fillColor(ACCENT);
  doc.text(tituloTexto, rightX, headerY, { width: rightColW, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(`Folio ${m.folio}`, rightX, headerY + 25, { width: rightColW, align: "right" });
  doc.text(m.fechaEmision, rightX, headerY + 37, { width: rightColW, align: "right" });
  doc.fillColor(INK);

  const headerBottom = headerY + Math.max(58, (logo.h || LOGO_MAX_H));
  ui.fillRect(M, headerBottom, W, 2, ACCENT);

  return headerBottom + 10;
}

/* Bloque receptor + vehículo + tipo de factura, como tres tarjetas lado a
   lado (en vez de una sola caja ancha con divisiones verticales). */
function drawReceptorComprobante(doc, ui, y0, { cliente, orden, ordenes, cfdi, tipoLabel, relacionadas }) {
  // Una factura puede agrupar varias órdenes y una nota de crédito aplicar a
  // varias facturas; `orden` (singular) se sigue aceptando por compatibilidad.
  const listaOrdenes = (Array.isArray(ordenes) && ordenes.length ? ordenes : orden ? [orden] : [])
    .filter((o) => safe(o?.ordenServicio));
  const ordenUnica = listaOrdenes.length === 1 ? listaOrdenes[0] : null;
  const listaRelacionadas = Array.isArray(relacionadas) ? relacionadas : [];

  const gap = 8;
  const cardW = (W - gap * 2) / 3;
  const h = 116;

  // --- Tarjeta 1: Receptor ---
  const c1x = M;
  ui.card(c1x, y0, cardW, h);
  ui.sectionLabel("Receptor", c1x + 8, y0 + 9, cardW - 16);
  let ry = y0 + 21;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK);
  doc.text(safe(cliente?.nombre) || "—", c1x + 8, ry, { width: cardW - 16 });
  ry += 13;
  doc.font("Helvetica").fontSize(7).fillColor(MUTED);
  ui.kv(c1x + 8, ry, "RFC:", cliente?.rfc, 26, cardW - 16, 7);
  ry += 10;
  ui.kv(c1x + 8, ry, "Rég.:", cliente?.regimenFiscal, 26, cardW - 16, 7);
  ry += 10;
  ui.kv(c1x + 8, ry, "CP:", cliente?.codigoPostalFiscal, 26, cardW - 16, 7);
  ry += 10;
  ui.kv(c1x + 8, ry, "Uso:", cfdi?.usoCfdi, 26, cardW - 16, 7);
  ry += 12;
  const dirReceptor = formatDireccion(cliente?.direccion, cliente?.pais);
  doc.fillColor(MUTED);
  ui.oneLine(dirReceptor.linea1, c1x + 8, ry, cardW - 16, 6.5);
  ry += 9;
  ui.oneLine(dirReceptor.linea2, c1x + 8, ry, cardW - 16, 6.5);
  doc.fillColor(INK);

  // --- Tarjeta 2: Vehículo (o factura relacionada, para nota de crédito) ---
  const c2x = c1x + cardW + gap;
  ui.card(c2x, y0, cardW, h);
  let vy = y0 + 9;

  if (ordenUnica && !ordenUnica.sinVehiculo) {
    ui.sectionLabel("Vehículo", c2x + 8, vy, cardW - 16);
    vy += 12;
    doc.fillColor(MUTED);
    ui.kv(c2x + 8, vy, "Marca:", ordenUnica.marca, 40, cardW - 16, 7);
    vy += 11;
    ui.kv(c2x + 8, vy, "Modelo:", `${safe(ordenUnica.modelo)} ${safe(ordenUnica.anio)}`.trim(), 40, cardW - 16, 7);
    vy += 11;
    ui.kv(c2x + 8, vy, "Serie:", ordenUnica.serie, 40, cardW - 16, 7);
    vy += 11;
    ui.kv(c2x + 8, vy, "Placas:", ordenUnica.placas, 40, cardW - 16, 7);
    vy += 11;
    ui.kv(c2x + 8, vy, "Kms:", ordenUnica.kmsMillas, 40, cardW - 16, 7);
  } else if (listaOrdenes.length) {
    ui.sectionLabel(`Órdenes (${listaOrdenes.length})`, c2x + 8, vy, cardW - 16);
    vy += 12;
    doc.font("Helvetica").fontSize(6.5).fillColor(MUTED);
    listaOrdenes.slice(0, 6).forEach((o) => {
      const vehiculo = o.sinVehiculo
        ? ""
        : [safe(o.marca), safe(o.modelo), safe(o.placas) && `(${safe(o.placas)})`]
            .filter(Boolean)
            .join(" ");
      doc.text(`${safe(o.ordenServicio)}${vehiculo ? ` · ${vehiculo}` : ""}`, c2x + 8, vy, { width: cardW - 16 });
      vy += 9;
    });
    if (listaOrdenes.length > 6) {
      doc.text(`+ ${listaOrdenes.length - 6} más`, c2x + 8, vy, { width: cardW - 16 });
    }
  } else if (listaRelacionadas.length) {
    ui.sectionLabel("CFDI relacionado", c2x + 8, vy, cardW - 16);
    vy += 12;
    doc.fillColor(MUTED);
    ui.kv(c2x + 8, vy, "Relación:", "01 - Nota crédito", 46, cardW - 16, 6.5);
    vy += 10;

    if (listaRelacionadas.length === 1) {
      const rel = listaRelacionadas[0];
      ui.kv(c2x + 8, vy, "Factura:", `${safe(rel.serie)}${safe(rel.folio)}`, 46, cardW - 16, 6.5);
      vy += 10;
      ui.kv(c2x + 8, vy, "UUID:", safe(rel.uuid) || "— (sin timbrar)", 46, cardW - 16, 6.5);
      vy += 10;
      ui.kv(c2x + 8, vy, "Total:", money(rel.total), 46, cardW - 16, 6.5);
    } else {
      const totalRel = listaRelacionadas.reduce((s, r) => s + Number(r.total || 0), 0);
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED);
      listaRelacionadas.slice(0, 4).forEach((r) => {
        doc.text(`${safe(r.serie)}${safe(r.folio)} · ${money(r.total)}`, c2x + 8, vy, { width: cardW - 16 });
        vy += 9;
      });
      if (listaRelacionadas.length > 4) {
        doc.text(`+ ${listaRelacionadas.length - 4} más`, c2x + 8, vy, { width: cardW - 16 });
        vy += 9;
      }
      ui.kv(c2x + 8, vy, "Total:", money(totalRel), 46, cardW - 16, 7);
    }
  }
  doc.fillColor(INK);

  // --- Tarjeta 3: Detalles (OC, condiciones, tipo de comprobante) ---
  const c3x = c2x + cardW + gap;
  ui.card(c3x, y0, cardW, h);
  ui.sectionLabel("Detalles", c3x + 8, y0 + 9, cardW - 16);
  let ty = y0 + 21;
  doc.fillColor(MUTED);
  ui.kv(c3x + 8, ty, "OC:", cfdi?.oc, 26, cardW - 16, 7);
  ty += 14;
  ui.kv(c3x + 8, ty, "Cond.:", safe(cfdi?.metodoPago) === "PPD" ? "Crédito" : "Contado", 34, cardW - 16, 7);
  ty += 20;

  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("TIPO DE COMPROBANTE", c3x + 8, ty, { width: cardW - 16 });
  ty += 11;
  const pillW = cardW - 16;
  doc.roundedRect(c3x + 8, ty, pillW, 20, 4).fillAndStroke(ACCENT, ACCENT);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
  doc.text((tipoLabel || "").toUpperCase(), c3x + 8, ty + 6, { width: pillW, align: "center" });
  doc.fillColor(INK).font("Helvetica");

  return y0 + h + 8;
}

/* Franja compacta con moneda / forma de pago / método / IVA (una sola línea,
   fondo gris claro, sin caja con bordes marcados). */
function drawFilaCfdi(doc, ui, y0, { cfdi }) {
  const h = 24;
  ui.fillRect(M, y0, W, h, "#f5f5f5");
  const y = y0 + 8;

  const item = (label, value, x, w) => {
    doc.font("Helvetica-Bold").fontSize(6.8).fillColor(MUTED);
    const labelW = doc.widthOfString(label + " ");
    doc.text(label, x, y, { width: labelW + 4 });
    doc.font("Helvetica").fontSize(7.2).fillColor(INK);
    doc.text(value, x + labelW + 2, y, { width: w - labelW - 2 });
  };

  const monedaTxt = `${safe(cfdi?.moneda) || "MXN"}${
    cfdi?.moneda === "USD" ? `  ·  T.C. ${safe(cfdi?.tipoCambio) || "—"}` : ""
  }`;

  item("MONEDA", monedaTxt, M + 10, 130);
  item("FORMA DE PAGO", formaPagoLabel(cfdi?.formaPago), M + 150, 240);
  item("MÉTODO", safe(cfdi?.metodoPago) === "PPD" ? "PPD" : "PUE", M + 400, 80);
  item("IVA", `${Math.round(Number(cfdi?.ivaRate || 0) * 100)}%`, M + 490, 60);

  doc.fillColor(INK);
  return y0 + h + 8;
}

/* Tabla de conceptos: un solo renglón por partida (sin el sub-renglón de
   impuesto), encabezado en color de acento y renglones alternados. */
function drawTablaConceptos(doc, ui, y0, { conceptos, ivaRate }) {
  const cols = [
    { label: "Cant.", w: 32, align: "center" },
    { label: "Clave / Unidad", w: 80, align: "center" },
    { label: "Descripción", w: 212, align: "left" },
    { label: "P. Unit.", w: 66, align: "right" },
    { label: "Importe", w: 66, align: "right" },
    { label: "IVA", w: 52, align: "right" },
    { label: "Total", w: 56, align: "right" },
  ];

  let y = y0;

  ui.fillRect(M, y, W, 18, ACCENT);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
  let x = M;
  cols.forEach((c) => {
    doc.text(c.label, x + 4, y + 5, { width: c.w - 8, align: c.align === "left" ? "left" : "center" });
    x += c.w;
  });
  doc.fillColor(INK).font("Helvetica");
  y += 18;

  conceptos.forEach((c, i) => {
    const qty = Number(c.cantidad || 0);
    const vu = Number(c.valorUnitario || 0);
    const imp = qty * vu;
    const ivaImp = imp * Number(ivaRate || 0);
    const total = imp + ivaImp;

    doc.fontSize(7.3);
    const claveTxt = `${safe(c.cUnidad) || "—"}\n${safe(c.cProdServ) || "—"}`;
    const descH = doc.heightOfString(safe(c.descripcion) || "—", { width: cols[2].w - 8 });
    const claveH = doc.heightOfString(claveTxt, { width: cols[1].w - 8 });
    const rowH = Math.max(18, descH + 6, claveH + 6);

    if (y + rowH > PAGE_H - 235) {
      doc.addPage();
      y = M;
    }

    if (i % 2 === 1) ui.fillRect(M, y, W, rowH, ZEBRA);

    let cx = M;
    const vals = [String(qty), claveTxt, safe(c.descripcion), money(vu), money(imp), money(ivaImp), money(total)];
    cols.forEach((col, idx) => {
      doc.font("Helvetica").fontSize(7.3).fillColor(INK);
      doc.text(vals[idx], cx + 4, y + 4, { width: col.w - 8, align: col.align });
      cx += col.w;
    });

    y += rowH;
    ui.rule(M, y, W);
  });

  doc.strokeColor(HAIRLINE).lineWidth(0.6).rect(M, y0, W, y - y0).stroke();
  return y + 8;
}

/* Pie de factura / nota de crédito: leyenda, garantía + QR (izquierda) y
   tarjeta de totales resaltada en color de acento (derecha); el UUID/fecha
   de certificación/sellos quedan en gris al final, como nota de pie. */
function drawPieComprobante(doc, ui, y0, { totales, cfdi, leyendaTipo, meta }) {
  const m = meta || buildMeta();
  let y = y0;

  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ACCENT);
  doc.text("ESTE SERVICIO INCLUYE MANO DE OBRA Y REFACCIONES", M, y, { width: W, align: "center" });
  doc.fillColor(INK);
  y += 16;

  const leftW = 328;
  const rightX = M + leftW + 12;
  const rightW = W - leftW - 12;

  // --- Izquierda: observaciones + garantía + QR ---
  doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("OBSERVACIONES / COMENTARIOS", M, y, { width: leftW });
  let ly = y + 11;
  doc.font("Helvetica").fontSize(7.3).fillColor(INK);
  const comentariosTxt = safe(cfdi?.comentarios) || "—";
  doc.text(comentariosTxt, M, ly, { width: leftW });
  ly += doc.heightOfString(comentariosTxt, { width: leftW }) + 8;

  const qrSize = 58;
  ui.qrPlaceholder(M, ly, qrSize);
  doc.font("Helvetica-Oblique").fontSize(6.3).fillColor(MUTED);
  doc.text(
    "Garantía: nuestras reparaciones están garantizadas por 90 días o 1,500 kms, en condiciones de uso normal y sin intervención de terceros. No aplica en partes eléctricas ni piezas usadas o surtidas por el cliente. Recibí el vehículo conforme a los servicios de este comprobante.",
    M + qrSize + 10,
    ly,
    { width: leftW - qrSize - 10 }
  );
  doc.fillColor(INK);
  const leftBottom = ly + qrSize;

  // --- Derecha: tarjeta de totales ---
  const rows = [
    ["Subtotal", money(totales.subtotal)],
    ["Descuento", money(0)],
    [`IVA (${Math.round(Number(cfdi?.ivaRate || 0) * 100)}%)`, money(totales.iva)],
  ];
  if (Number(totales.isr || 0) > 0) rows.push(["Retención ISR", `- ${money(totales.isr)}`]);

  const rowH = 14;
  const cardH = rows.length * rowH + 8 + 24;
  ui.fillRect(rightX, y, rightW, cardH, TOTALS_BG);
  doc.strokeColor(HAIRLINE).lineWidth(0.6).rect(rightX, y, rightW, cardH).stroke();

  let ty = y + 8;
  rows.forEach(([label, val]) => {
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(label, rightX + 10, ty, { width: rightW - 20 });
    doc.font("Helvetica").fontSize(7.5).fillColor(INK).text(val, rightX + 10, ty, { width: rightW - 20, align: "right" });
    ty += rowH;
  });

  ui.fillRect(rightX, ty, rightW, 24, ACCENT);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#ffffff").text("TOTAL", rightX + 10, ty + 7, { width: rightW - 20 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff").text(money(totales.total), rightX + 10, ty + 6, {
    width: rightW - 20,
    align: "right",
  });
  doc.fillColor(INK);

  y = Math.max(leftBottom, y + cardH) + 10;

  if (y > PAGE_H - 130) {
    doc.addPage();
    y = M;
  }

  // Cantidad con letra
  doc.font("Helvetica-Oblique").fontSize(7.5).fillColor(MUTED);
  doc.text(numeroALetras(totales.total), M, y, { width: W, align: "center" });
  doc.fillColor(INK);
  y += 16;

  ui.rule(M, y, W);
  y += 8;

  // UUID / fecha de certificación / sellos (placeholders hasta timbrar)
  const selloLine = (label, value) => {
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text(label, M, y, { width: 100 });
    doc.font("Helvetica").fillColor(MUTED);
    ui.oneLine(value, M + 100, y, W - 100, 6.5);
    y += 9;
  };
  selloLine("UUID:", m.uuid);
  selloLine("Fecha de certificación:", m.fechaCertificacion);
  selloLine("Sello digital del CFDI:", m.sello);
  selloLine("Sello digital del SAT:", m.selloSat);
  selloLine("Cadena original:", m.cadena);
  doc.fillColor(INK);

  y += 6;
  doc.font("Helvetica").fontSize(7).fillColor(MUTED);
  doc.text(`Representación impresa de un CFDI (${leyendaTipo})${m.pieSufijo}`, M, PAGE_H - 34, {
    width: W,
    align: "center",
  });
  doc.fillColor(INK);
}

/* =========================
   FORMATO 1 y 2: FACTURA (INGRESO) / NOTA DE CRÉDITO (EGRESO)
========================= */
function drawComprobanteIngresoEgreso(doc, data) {
  const ui = makeUi(doc);
  const { tipoLabel } = data;

  let y = drawHeaderComprobante(doc, ui, data);
  y = drawReceptorComprobante(doc, ui, y, data);
  y = drawFilaCfdi(doc, ui, y, data);
  y = drawTablaConceptos(doc, ui, y, { conceptos: data.conceptos, ivaRate: data.cfdi?.ivaRate });
  drawPieComprobante(doc, ui, y, {
    totales: data.totales,
    cfdi: data.cfdi,
    meta: data.meta,
    leyendaTipo: tipoLabel === "Egreso" ? "EGRESO / NOTA DE CRÉDITO" : "INGRESO",
  });
}

/* =========================
   FORMATO 3: COMPLEMENTO DE PAGO (RECIBO ELECTRÓNICO DE PAGO)
========================= */
function drawReciboElectronicoPago(doc, data) {
  const ui = makeUi(doc);
  const { emisor, cliente, pago, relacionadas, cfdi } = data;
  const m = data.meta || buildMeta();

  const monto = relacionadas.reduce((s, r) => s + Number(r.importePagado || 0), 0);

  // ===== Encabezado (mismo lenguaje visual que factura/nota de crédito) =====
  const headerY = M;
  const logo = ui.logo(M, headerY, LOGO_MAX_W, LOGO_MAX_H);

  const rightColW = 190;
  const textX = M + (logo.w || LOGO_MAX_W) + 12;
  const textW = W - (logo.w || LOGO_MAX_W) - 12 - rightColW - 10;

  let ety = headerY;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
  doc.text((safe(emisor.nombre) || "EMISOR").toUpperCase(), textX, ety, { width: textW });
  ety += 15;
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
  doc.text(`RFC ${safe(emisor.rfc) || "—"}  ·  Régimen ${safe(emisor.regimenFiscal) || "—"}`, textX, ety, { width: textW });
  ety += 11;
  doc.text(`Expedido en C.P. ${safe(emisor.lugarExpedicion) || "—"}`, textX, ety, { width: textW });
  ety += 10;
  doc.text(`Tel ${safe(emisor.telefono) || "—"}`, textX, ety, { width: textW });

  const rightX = M + W - rightColW;
  doc.font("Helvetica-Bold").fontSize(19).fillColor(ACCENT);
  doc.text("RECIBO DE PAGO", rightX, headerY, { width: rightColW, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(`Folio ${m.folio}`, rightX, headerY + 25, { width: rightColW, align: "right" });
  doc.text(m.fechaEmision, rightX, headerY + 37, { width: rightColW, align: "right" });
  doc.fillColor(INK);

  const headerBottom = headerY + Math.max(58, logo.h || LOGO_MAX_H);
  ui.fillRect(M, headerBottom, W, 2, ACCENT);
  let y = headerBottom + 10;

  // ===== Receptor + fecha de pago (dos tarjetas) =====
  const gap = 8;
  const cardH = 100;
  const recW = 360;
  const pagoW = W - recW - gap;

  ui.card(M, y, recW, cardH);
  ui.sectionLabel("Receptor", M + 8, y + 9, recW - 16);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(safe(cliente?.nombre) || "—", M + 8, y + 21, { width: recW - 16 });
  doc.font("Helvetica").fontSize(7).fillColor(MUTED);
  let ry = y + 34;
  ui.kv(M + 8, ry, "RFC:", cliente?.rfc, 28, recW - 16, 7);
  ry += 10;
  ui.kv(M + 8, ry, "Rég.:", cliente?.regimenFiscal, 28, recW - 16, 7);
  ry += 10;
  ui.kv(M + 8, ry, "CP:", cliente?.codigoPostalFiscal, 28, recW - 16, 7);
  ry += 10;
  doc.fillColor(MUTED).text("Uso de CFDI: CP01 - Pagos", M + 8, ry, { width: recW - 16 });
  ry += 12;
  const dirReceptorPago = formatDireccion(cliente?.direccion, cliente?.pais);
  ui.oneLine(dirReceptorPago.linea1, M + 8, ry, recW - 16, 6.5);
  ry += 9;
  ui.oneLine(dirReceptorPago.linea2, M + 8, ry, recW - 16, 6.5);
  doc.fillColor(INK);

  const pagoX = M + recW + gap;
  ui.card(pagoX, y, pagoW, cardH);
  ui.sectionLabel("Pago", pagoX + 8, y + 9, pagoW - 16);
  let py = y + 24;
  ui.kv(pagoX + 8, py, "Fecha:", safe(pago?.fechaPago) || "—", 40, pagoW - 16, 7);
  py += 12;
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("FORMA DE PAGO", pagoX + 8, py, { width: pagoW - 16 });
  py += 9;
  doc.font("Helvetica").fontSize(7).fillColor(INK).text(formaPagoLabel(pago?.formaPago), pagoX + 8, py, { width: pagoW - 16 });
  py += 18;
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("IMPORTE DEL PAGO", pagoX + 8, py, { width: pagoW - 16 });
  py += 10;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT).text(money(monto), pagoX + 8, py, { width: pagoW - 16 });
  doc.fillColor(INK);

  y += cardH + 8;

  // ===== Concepto fijo del CFDI de pago =====
  ui.fillRect(M, y, W, 20, "#f5f5f5");
  doc.font("Helvetica-Bold").fontSize(6.8).fillColor(MUTED);
  doc.text("CONCEPTO", M + 10, y + 6, { width: 200 });
  doc.text("CLAVE", M + 230, y + 6, { width: 100 });
  doc.text("CANTIDAD", M + 350, y + 6, { width: 90, align: "right" });
  doc.text("IMPORTE", M + 460, y + 6, { width: 80, align: "right" });
  doc.font("Helvetica").fontSize(7.3).fillColor(INK);
  y += 20;
  ui.rule(M, y, W);
  y += 6;
  doc.font("Helvetica").fontSize(7.3).fillColor(INK);
  doc.text("Pago", M + 10, y, { width: 200 });
  doc.text("84111506 · ACT", M + 230, y, { width: 100 });
  doc.text("1", M + 350, y, { width: 90, align: "right" });
  doc.text("$0.00", M + 460, y, { width: 80, align: "right" });
  y += 18;

  // ===== Detalle del pago =====
  ui.fillRect(M, y, W, 18, ACCENT);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff").text("DETALLE DEL PAGO", M + 8, y + 5, { width: W - 16 });
  doc.fillColor(INK).font("Helvetica");
  y += 18;

  const cols = [
    { label: "Serie/Folio", w: 84, align: "left" },
    { label: "UUID / Factura", w: 156, align: "left" },
    { label: "Parc.", w: 34, align: "center" },
    { label: "Método", w: 48, align: "center" },
    { label: "Saldo Ant.", w: 76, align: "right" },
    { label: "Pagado", w: 78, align: "right" },
    { label: "Insoluto", w: 88, align: "right" },
  ];

  ui.fillRect(M, y, W, 14, "#f5f5f5");
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
  let hx = M;
  cols.forEach((c) => {
    doc.text(c.label, hx + 4, y + 4, { width: c.w - 8, align: c.align });
    hx += c.w;
  });
  doc.fillColor(INK);
  y += 14;

  const tableTop = y;
  relacionadas.forEach((r, i) => {
    const saldoAnt = Number(r.saldoAnterior ?? r.total ?? 0);
    const pagado = Number(r.importePagado || 0);
    const insoluto = Math.max(saldoAnt - pagado, 0);

    if (y > PAGE_H - 200) {
      doc.addPage();
      y = M;
    }

    const rowH = 16;
    if (i % 2 === 1) ui.fillRect(M, y, W, rowH, ZEBRA);

    const vals = [
      `${safe(r.serie)}${safe(r.folio)}` || "—",
      safe(r.uuid) || `Factura ${safe(r.serie)}${safe(r.folio)} (sin timbrar)`,
      String(r.numParcialidad || 1),
      "PPD",
      money(saldoAnt),
      money(pagado),
      money(insoluto),
    ];

    let cx = M;
    doc.font("Helvetica").fontSize(7);
    cols.forEach((c, idx) => {
      doc.text(vals[idx], cx + 4, y + 4, { width: c.w - 8, align: c.align });
      cx += c.w;
    });

    y += rowH;
    ui.rule(M, y, W);
  });
  doc.strokeColor(HAIRLINE).lineWidth(0.6).rect(M, tableTop, W, y - tableTop).stroke();

  // Total del pago
  y += 8;
  ui.fillRect(M + W - 190, y, 190, 22, ACCENT);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text("MONTO TOTAL DEL PAGO", M + W - 184, y + 7, { width: 120 });
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#ffffff").text(money(monto), M + W - 190, y + 6, { width: 184, align: "right" });
  doc.fillColor(INK);
  y += 32;

  // Cantidad con letra
  doc.font("Helvetica-Oblique").fontSize(7.5).fillColor(MUTED);
  doc.text(numeroALetras(monto), M, y, { width: W, align: "center" });
  doc.fillColor(INK);
  y += 18;

  // Comentarios
  if (safe(cfdi?.comentarios)) {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("COMENTARIOS", M, y, { width: W });
    y += 10;
    doc.font("Helvetica").fontSize(7.3).fillColor(INK).text(safe(cfdi.comentarios), M, y, { width: W });
    y += doc.heightOfString(safe(cfdi.comentarios), { width: W }) + 8;
  }

  ui.rule(M, y, W);
  y += 8;

  // QR + UUID/certificado/sellos
  const qrSize = 56;
  ui.qrPlaceholder(M, y, qrSize);
  const infoX = M + qrSize + 12;
  const infoW = W - qrSize - 12;
  let iy = y + 2;
  const selloLine = (label, value) => {
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text(label, infoX, iy, { width: 100 });
    doc.font("Helvetica").fillColor(MUTED);
    ui.oneLine(value, infoX + 100, iy, infoW - 100, 6.5);
    iy += 10;
  };
  selloLine("UUID:", m.uuid);
  selloLine("Certificado:", safe(emisor.noCertificado) || "—");
  selloLine("Sello digital del CFDI:", m.sello);
  selloLine("Sello digital del SAT:", m.selloSat);
  selloLine("Cadena original:", m.cadena);
  doc.fillColor(INK);

  doc.font("Helvetica").fontSize(7).fillColor(MUTED);
  doc.text(`Representación impresa de un CFDI (COMPLEMENTO DE PAGO)${m.pieSufijo}`, M, PAGE_H - 34, {
    width: W,
    align: "center",
  });
  doc.fillColor(INK);
}

/* =========================
   ENDPOINT
   POST /api/facturacion/preview
========================= */
router.post("/preview", async (req, res) => {
  try {
    const {
      tipoFactura = "factura",
      cliente,
      conceptos = [],
      cfdi = {},
      relacionadas = [],
      pago = null,
      orden = null,
      ordenes = [],
    } = req.body;

    const esComplementoPago = tipoFactura === "complementoPago";
    const esNotaCredito = tipoFactura === "notaCredito";

    if (!cliente) {
      return res.status(400).json({ ok: false, error: "Faltan datos del receptor." });
    }

    if (!esComplementoPago && (!Array.isArray(conceptos) || !conceptos.length)) {
      return res.status(400).json({ ok: false, error: "Faltan conceptos para el PDF." });
    }

    if (esComplementoPago && (!Array.isArray(relacionadas) || !relacionadas.length || !pago)) {
      return res.status(400).json({ ok: false, error: "Faltan facturas o datos del pago." });
    }

    // Emisor real desde la configuración fiscal (si existe)
    const cfg = await FiscalConfig.findOne().sort({ updatedAt: -1 }).lean().catch(() => null);
    const emisor = {
      nombre: cfg?.nombre || "",
      rfc: cfg?.rfc || "",
      regimenFiscal: cfg?.regimenFiscal || "",
      lugarExpedicion: cfg?.lugarExpedicion || "",
      telefono: cfg?.telefono || "",
      noCertificado: cfg?.noCertificado || "",
    };

    // Totales (factura / nota de crédito)
    const subtotal = conceptos.reduce(
      (sum, c) => sum + Number(c.cantidad || 0) * Number(c.valorUnitario || 0),
      0
    );
    const ivaRate = Number(cfdi?.ivaRate || 0);
    const iva = subtotal * ivaRate;
    const isrRate = Number(cfdi?.isrRate || 0.0125);
    const isr = cfdi?.aplicarRetencionIsr ? subtotal * isrRate : 0;
    const total = subtotal + iva - isr;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=preview.pdf");

    const doc = new PDFDocument({ size: "LETTER", margin: M });
    doc.pipe(res);

    if (esComplementoPago) {
      drawReciboElectronicoPago(doc, { emisor, cliente, pago, relacionadas, cfdi });
    } else {
      drawComprobanteIngresoEgreso(doc, {
        emisor,
        cliente,
        orden,
        ordenes,
        conceptos,
        cfdi,
        relacionadas,
        tipoLabel: esNotaCredito ? "Egreso" : "Ingreso",
        totales: { subtotal, iva, isr, total },
      });
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   ENDPOINT
   GET /api/facturacion/factura/:id/pdf
   Representación impresa de una factura ya guardada en el historial.
========================= */
router.get("/factura/:id/pdf", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const f = await FacturaCfdi.findById(req.params.id).lean();
    if (!f) return res.status(404).json({ ok: false, error: "Factura no encontrada" });

    const esComplementoPago = f.tipoFactura === "complementoPago";
    const esNotaCredito = f.tipoFactura === "notaCredito";

    // Emisor: el guardado en la factura; si el snapshot viene vacío, la config actual
    let emisor = f.emisor || {};
    if (!safe(emisor.rfc)) {
      const cfg = await FiscalConfig.findOne().sort({ updatedAt: -1 }).lean().catch(() => null);
      emisor = {
        nombre: cfg?.nombre || "",
        rfc: cfg?.rfc || "",
        regimenFiscal: cfg?.regimenFiscal || "",
        lugarExpedicion: cfg?.lugarExpedicion || "",
        telefono: cfg?.telefono || "",
        noCertificado: cfg?.noCertificado || "",
      };
    }

    // La factura solo guarda la referencia de cada orden: se completan los datos
    // del vehículo. `ordenes` puede traer varias; las facturas viejas solo
    // guardaron `orden` (singular), que aquí se trata como lista de una.
    const refsOrdenes = (f.ordenes?.length ? f.ordenes : f.orden ? [f.orden] : []).filter(
      (o) => safe(o?.ordenServicio) || o?.vehiculoId
    );

    const ordenes = await Promise.all(
      refsOrdenes.map(async (ref) => {
        const base = { ordenServicio: safe(ref?.ordenServicio) };
        if (!ref?.vehiculoId) return base;

        const v = await Vehiculo.findById(ref.vehiculoId)
          .select("ordenServicio marca modelo anio serie placas kmsMillas sinVehiculo")
          .lean()
          .catch(() => null);
        if (!v) return base;

        return {
          ordenServicio: base.ordenServicio || safe(v.ordenServicio),
          marca: v.marca || "",
          modelo: v.modelo || "",
          anio: v.anio || "",
          serie: v.serie || "",
          placas: v.placas || "",
          kmsMillas: v.kmsMillas || "",
          sinVehiculo: !!v.sinVehiculo,
        };
      })
    );

    const folioTxt = [safe(f.serie), safe(f.folio)].filter(Boolean).join("-") || "—";
    const cancelada = f.estatus === "cancelada";

    const meta = buildMeta({
      folio: folioTxt,
      fechaEmision: fechaHora(new Date(f.fecha || f.createdAt || Date.now())),
      sello: safe(f.sello) || "— sin sello —",
      cadena: safe(f.cadenaOriginal) || "— sin cadena original —",
      pieSufijo: cancelada ? " — CANCELADA" : " — SIN TIMBRAR",
    });

    // Totales guardados; si el snapshot no los trae, se recalculan de los conceptos
    const conceptos = f.conceptos || [];
    let totales = f.totales;
    if (!totales || typeof totales.total !== "number") {
      const subtotal = conceptos.reduce(
        (sum, c) => sum + Number(c.cantidad || 0) * Number(c.valorUnitario || 0),
        0
      );
      const iva = subtotal * Number(f.cfdi?.ivaRate || 0);
      const isr = f.cfdi?.aplicarRetencionIsr ? subtotal * Number(f.cfdi?.isrRate || 0.0125) : 0;
      totales = { subtotal, iva, isr, total: subtotal + iva - isr };
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=factura_${folioTxt.replace(/[^\w-]/g, "") || "cfdi"}.pdf`
    );

    const doc = new PDFDocument({ size: "LETTER", margin: M });
    doc.pipe(res);

    if (esComplementoPago) {
      drawReciboElectronicoPago(doc, {
        emisor,
        cliente: f.cliente,
        pago: {
          ...f.pago,
          // La fecha se guardó como YYYY-MM-DD (medianoche UTC): se formatea en UTC
          // para que no se recorra un día según la zona horaria del servidor.
          fechaPago: f.pago?.fechaPago
            ? new Date(f.pago.fechaPago).toLocaleDateString("es-MX", {
                timeZone: "UTC",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "",
        },
        relacionadas: f.relacionadas || [],
        cfdi: f.cfdi,
        meta,
      });
    } else {
      drawComprobanteIngresoEgreso(doc, {
        emisor,
        cliente: f.cliente,
        ordenes,
        conceptos,
        cfdi: f.cfdi,
        relacionadas: f.relacionadas || [],
        tipoLabel: esNotaCredito ? "Egreso" : "Ingreso",
        totales,
        meta,
      });
    }

    doc.end();
  } catch (err) {
    console.error("GET /facturacion/factura/:id/pdf ERROR:", err);
    if (res.headersSent) return res.end();
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
