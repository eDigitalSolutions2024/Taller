import http from "./http";

// Usuarios activos (para el typeahead de "Comprador" en Devolución de
// Refacciones). Taller no tiene un rol "refaccionario" propio, así que se
// listan todos los usuarios activos.
export const getUsuariosActivos = async () => {
  const { data } = await http.get("/users/activos");
  return data;
};

// Gestión de accesos (Personal → solo admin)
export const listarUsuarios = () => http.get("/users").then((r) => r.data.data);

export const crearUsuario = (payload) => http.post("/users", payload).then((r) => r.data.data);

export const actualizarUsuario = (id, payload) => http.put(`/users/${id}`, payload).then((r) => r.data.data);

export const restablecerPasswordUsuario = (id, password) =>
  http.put(`/users/${id}/password`, { password }).then((r) => r.data);
