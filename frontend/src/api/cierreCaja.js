// src/api/cierreCaja.js
import http from "./http";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

export const getCierreCaja = (fecha) => http.get("/cierre-caja", { params: { fecha } });

export const guardarCierreCaja = (payload) => http.post("/cierre-caja", payload);

export const cerrarCierreCaja = (fecha) => http.post("/cierre-caja/cerrar", { fecha });

export const restablecerCierreCaja = (fecha) => http.post("/cierre-caja/restablecer", { fecha });

export const getCierreCajaPdfUrl = (fecha) => `${API}/cierre-caja/pdf?fecha=${fecha}`;
