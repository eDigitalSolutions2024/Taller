import axios from 'axios';

const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
const API  = `${BASE}/api/piezas-codigos`;

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getPiezas = async (params = {}) => {
  const response = await axios.get(API, { params, headers: authHeader() });
  return response.data;
};

export const getPieza = async (id) => {
  const response = await axios.get(`${API}/${id}`, { headers: authHeader() });
  return response.data;
};

export const crearPieza = async (datos) => {
  const response = await axios.post(API, datos, { headers: authHeader() });
  return response.data;
};

export const actualizarPieza = async (id, datos) => {
  const response = await axios.put(`${API}/${id}`, datos, { headers: authHeader() });
  return response.data;
};

export const eliminarPieza = async (id) => {
  const response = await axios.delete(`${API}/${id}`, { headers: authHeader() });
  return response.data;
};

export const getEstadisticas = async () => {
  const response = await axios.get(`${API}/estadisticas`, { headers: authHeader() });
  return response.data;
};