// src/api/vehiculos.js
import http from "./http";

// Crear una nueva "entrada de vehículo" para un cliente
export const createVehiculo = (clienteId, data) =>
  http.post("/vehiculos", { clienteId, ...data });

// (opcional) listar vehículos de un cliente
export const listVehiculosByCliente = (clienteId) =>
  http.get(`/vehiculos/cliente/${clienteId}`);
