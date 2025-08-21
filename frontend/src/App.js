import React from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import ClientesLayout from "./pages/clientes/ClientesLayout";
import AltaCliente from "./pages/clientes/AltaCliente";
import ConsultaClientes from "./pages/clientes/ConsultaClientes";
// importa tus otras páginas si ya existen
// import Ordenes from "./pages/Ordenes";
// import Clientes from "./pages/Clientes";
// import Inventario from "./pages/Inventario";
// import Reportes from "./pages/Reportes";
// import Ajustes from "./pages/Ajustes";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Público */}
        <Route path="/login" element={<LoginPage />} />

        {/* Zona privada: el layout envuelve TODAS las rutas con wildcard */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          {/* index de la zona privada → /dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Tus rutas ABSOLUTAS del navbar funcionan así: */}
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="clientes/*" element={<ClientesLayout />}>
            <Route index element={<Navigate to="consulta" replace />} />
            <Route path="alta" element={<AltaCliente />} />
            <Route path="consulta" element={<ConsultaClientes />} />
          </Route>
          {/* <Route path="ordenes" element={<Ordenes />} /> */}
          {/* <Route path="clientes" element={<Clientes />} /> */}
          {/* <Route path="inventario" element={<Inventario />} /> */}
          {/* <Route path="reportes" element={<Reportes />} /> */}
          {/* <Route path="ajustes" element={<Ajustes />} /> */}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
