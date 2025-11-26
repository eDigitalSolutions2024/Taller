import http from "./http"; // ya lo tienes
export const createCustomer = (data) => http.post("/clientes", data);
export const listCustomers = (params) => http.get("/clientes", { params });

// 👇 NUEVA: obtener todos los clientes sin filtros
export const getClientes = () => http.get("/clientes");
