// src/api/configuracion.js
// Versión mínima: solo el tipo de cambio (ver backend/routes/configuracion.js).
import http from './http';

export const getTiposCambio = () =>
  http.get('/configuracion/tipo-cambio').then((r) => r.data.data);

export const crearTipoCambio = (payload) =>
  http.post('/configuracion/tipo-cambio', payload).then((r) => r.data.data);

export const getUltimoTipoCambio = () =>
  http.get('/configuracion/tipo-cambio/ultimo').then((r) => r.data.data);

// Referencia informativa (nunca se usa en cálculos, ver backend/routes/configuracion.js)
export const getTipoCambioSie = () =>
  http.get('/configuracion/tipo-cambio/sie').then((r) => r.data.data);

export const getHistorialComparadoTipoCambio = () =>
  http.get('/configuracion/tipo-cambio/historial-comparado').then((r) => r.data.data);

export const getFondoCaja = () =>
  http.get('/configuracion/fondo-caja').then((r) => r.data.data);

export const actualizarFondoCaja = (valor) =>
  http.put('/configuracion/fondo-caja', { valor }).then((r) => r.data.data);

export const getFolioOrdenServicio = () =>
  http.get('/configuracion/folio-orden-servicio').then((r) => r.data.data);

export const actualizarFolioOrdenServicio = (ultimo) =>
  http.put('/configuracion/folio-orden-servicio', { ultimo }).then((r) => r.data.data);
