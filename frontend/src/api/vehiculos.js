// src/api/vehiculos.js
import http from "./http";
import axios from "axios"
const API = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

// Crear una nueva "entrada de vehículo" para un cliente
export const createVehiculo = (clienteId, data) =>
  http.post("/vehiculos", { clienteId, ...data });

// (opcional) listar vehículos de un cliente
export const listVehiculosByCliente = (clienteId) =>
  http.get(`/vehiculos/cliente/${clienteId}`);

// NUEVO: consulta general de órdenes
export const listOrdenesServicio = (params) =>
  http.get("/vehiculos/ordenes", { params });

export const getVehiculoById = (id) =>
  http.get(`/vehiculos/${id}`);

export const getStatsDashboard = (periodo = "hoy") =>
  http.get("/vehiculos/stats/dashboard", { params: { periodo } });

export const updateServicioReparacion = (id, servicioReparacion) =>
  http.put(`/vehiculos/${id}/servicio`, { servicioReparacion });

export const saveRequisicionDiagnostico = (id, payload) =>
  http.put(`/vehiculos/${id}/requisicion-diagnostico`, payload);

export const updateHistorialDiagnostico = (id, entryId, texto) =>
  http.put(`/vehiculos/${id}/historial-diagnostico/${entryId}`, { texto });

// Continuar sin refacciones: los servicios capturados entran al presupuesto
// (cada uno puede traer ya su mecánico/carrocero asignado); serviciosCatalogo
// son bundles del catálogo de Servicios (con sus refacciones incluidas/
// excluidas). En ambos casos la orden no pasa por refaccionaria.
export const omitirRefacciones = (id, { servicios = [], serviciosCatalogo = [] } = {}) =>
  http.put(`/vehiculos/${id}/omitir-refacciones`, { servicios, serviciosCatalogo });

// 🔹 NUEVO: guardar presupuesto + venta al cliente
export const savePresupuestoVenta = (id, payload) =>
  http.put(`/vehiculos/${id}/presupuesto-venta`, payload);

// 👇 nuevo ayudante — papel: 'a4' | 'carta' | 'oficio'
export const openOperativoPdf = (id, papel = 'a4') => {
  const url = `${API}/vehiculos/${id}/operativo-pdf?papel=${papel}`;
  window.open(url, "_blank", "noopener");
};

// 👇 abre el PDF de impresión / contrato
export const openImprimirPdf = (id) => {
  const url = `${API}/vehiculos/${id}/orden-pdf`;
  window.open(url, "_blank", "noopener");
};

export async function generarOrdenCompra(ordenId, refaccion) {
  const { data } = await http.post(`/vehiculos/${ordenId}/orden-compra`, {
    refaccion,
  });
  return data;
};

// Agrega esto si no lo tienes
export const getEmpleados = () => axios.get(`${API}/empleados`);

export const openPresupuestoPdf = (id) => {
  const url = `${API}/vehiculos/${id}/presupuesto-pdf`;
  window.open(url, "_blank", "noopener");
};

// Cerrar orden
export const closeOrden = (id) =>
  http.put(`/vehiculos/${id}/cerrar`);

// Restablecer orden cerrada/cancelada a su estado anterior (solo admin)
export const restoreOrden = (id) =>
  http.put(`/vehiculos/${id}/restablecer`);

// ✅ Agregado de edigitaltaller
export const openVentaClientePdf = (id) => {
  const url = `${API}/vehiculos/${id}/venta-cliente-pdf`;
  window.open(url, "_blank", "noopener");
};

// ✅ Agregado de edigitaltaller
export const marcarSurtidas = (id, presupuesto) =>
  http.put(`/vehiculos/${id}/surtir`, { presupuesto });

// ✅ Agregado de edigitaltaller
export const updateDatosOrden = (id, payload) =>
  http.put(`/vehiculos/${id}/datos`, payload);

// Subir una o más imágenes (fotos del vehículo, daños, etc.) adjuntas a la orden.
export const subirImagenesOrden = (id, files, subidoPor = "") => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("imagenes", file));
  if (subidoPor) formData.append("subidoPor", subidoPor);
  return http.post(`/vehiculos/${id}/imagenes`, formData);
};

export const eliminarImagenOrden = (id, imagenId) =>
  http.delete(`/vehiculos/${id}/imagenes/${imagenId}`);

// Imágenes subidas antes de guardar la orden (aún no existe el folio real):
// viven en una carpeta temporal identificada por tempId y se migran a la
// orden definitiva al crearla (ver createVehiculo).
export const subirImagenesTemp = (tempId, files) => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("imagenes", file));
  return http.post(`/vehiculos/imagenes/temp/${tempId}`, formData);
};

export const eliminarImagenTemp = (tempId, filename) =>
  http.delete(`/vehiculos/imagenes/temp/${tempId}/${encodeURIComponent(filename)}`);

export const descartarImagenesTemp = (tempId) =>
  http.delete(`/vehiculos/imagenes/temp/${tempId}`);

export const getMisOrdenes = () =>
  http.get('/vehiculos/mis-ordenes');

// Filtro que define lo que queda realmente por surtir: órdenes con al menos
// una refacción autorizada y sin surtir.
export const filtrosPorSurtir = () => ({ conPendientesSurtir: true });

export const getRefaccionariaAlerts = () => {
  const surtir = filtrosPorSurtir();
  return Promise.all([
    http.get('/vehiculos/ordenes', { params: { estado: 'PENDIENTE_REFACCIONARIA', limit: 1 } }),
    http.get('/vehiculos/ordenes', { params: { ...surtir, estado: 'PENDIENTE_SURTIR', limit: 1 } }),
    http.get('/vehiculos/ordenes', { params: { ...surtir, estado: 'REPARACION_EN_CURSO', limit: 1 } }),
  ]).then(([sol, ps, ric]) => ({
    solicitudes: sol.data.total ?? 0,
    porSurtir: (ps.data.total ?? 0) + (ric.data.total ?? 0),
  }));
};

// Registrar un pago/abono contra la orden
export const registrarPago = (id, payload) =>
  http.post(`/vehiculos/${id}/pagos`, payload);

export const agregarDescuento = (id, payload) =>
  http.post(`/vehiculos/${id}/descuentos`, payload);

export const actualizarDescuento = (id, descuentoId, payload) =>
  http.put(`/vehiculos/${id}/descuentos/${descuentoId}`, payload);

export const eliminarDescuento = (id, descuentoId) =>
  http.delete(`/vehiculos/${id}/descuentos/${descuentoId}`);
