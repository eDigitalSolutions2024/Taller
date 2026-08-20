const { TERMINALES_KEYS } = require('../models/CierreCaja');

// Espejo de utils/cajaTotales.js: los totales del cierre nunca se persisten,
// siempre se recalculan a partir de los conteos/capturas guardadas.
function calcularTotalesCierre(cierre) {
  const totalBilletes = (cierre.billetes || []).reduce(
    (s, b) => s + Number(b.denominacion || 0) * Number(b.cantidad || 0),
    0
  );
  const totalMonedas = (cierre.monedas || []).reduce(
    (s, m) => s + Number(m.denominacion || 0) * Number(m.cantidad || 0),
    0
  );

  const terminales = cierre.terminales || {};
  const totalTerminales = TERMINALES_KEYS.reduce((s, k) => s + Number(terminales[k] || 0), 0);

  const totalDolares = Number(cierre.dolares?.cantidad || 0) * Number(cierre.dolares?.tipoCambio || 0);

  const totalCobrado = totalBilletes + totalMonedas + totalTerminales + totalDolares;

  const totalReportes = Number(cierre.totalReportes || 0);
  const fondoCaja = Number(cierre.fondoCaja || 0);
  const diferencia = totalCobrado - totalReportes - fondoCaja;

  return {
    totalBilletes,
    totalMonedas,
    totalTerminales,
    totalDolares,
    totalCobrado,
    diferencia,
  };
}

module.exports = { calcularTotalesCierre, TERMINALES_KEYS };
