import http from "./http";

export const generarVistaPreviaPDF = (payload) =>
  http.post("/facturacion/preview", payload, { responseType: "arraybuffer" });
