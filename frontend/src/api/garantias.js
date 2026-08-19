// src/api/garantias.js
import http from "./http";

// Listar solicitudes de garantía (params: estado, searchOs, page, limit)
export const listGarantias = (params) => http.get("/garantias", { params });

// Editar motivo / autorización mientras está PENDIENTE
export const updateGarantia = (id, payload) => http.put(`/garantias/${id}`, payload);

// Aprobar o negar: payload { accion: 'APROBAR' | 'NEGAR', motivo, autorizaCarreon }
export const resolverGarantia = (id, payload) =>
  http.put(`/garantias/${id}/resolver`, payload);

// Cuáles de esas órdenes ya fueron usadas como origen de una garantía
export const getGarantiasUsadas = (ordenIds) =>
  http.get("/garantias/usadas", { params: { ordenIds: (ordenIds || []).join(",") } });

// Cancela la orden nueva de una solicitud marcada "No aplica" (solo admin)
export const cancelarGarantia = (id) => http.put(`/garantias/${id}/cancelar`);
