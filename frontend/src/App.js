// src/App.js
import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { getUser } from "./auth";
import { canSeeModule } from "./utils/roles";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";

// Facturación
import FacturacionLayout from "./pages/facturacion/FacturacionLayout";
import FacturacionPanel from "./pages/facturacion/FacturacionPanel";
import NuevaFactura from "./pages/facturacion/NuevaFactura";
import ConsultarFacturas from "./pages/facturacion/ConsultarFacturas";
import ConfiguracionFiscal from "./pages/facturacion/ConfiguracionFiscal";
// Clientes
import ClientesLayout from "./pages/clientes/ClientesLayout";
import AltaCliente from "./pages/clientes/AltaCliente";
import ConsultaClientes from "./pages/clientes/ConsultaClientes";

// Refaccionaria
import RefaccionariaLayout from "./pages/refaccionaria/RefaccionariaLayout";
import EntradaInventario from "./pages/refaccionaria/EntradaInventario";
import SalidaRefaccion from "./pages/refaccionaria/SalidaRefaccion";
import ConsultarInventario from "./pages/refaccionaria/ConsultarInventario";
import ConsultarFacturaProveedor from "./pages/refaccionaria/ConsultarFacturaProveedor.jsx";
import BDCodigos from "./pages/refaccionaria/BDCodigos";
import ServiciosCatalogo from "./pages/refaccionaria/ServiciosCatalogo";
import PiezasCodigosPage from './pages/PiezasCodigosPage';


import SolicitudesTaller from "./pages/refaccionaria/SolicitudesTaller";
import SolicitudTallerDetalle from "./pages/refaccionaria/SolicitudTallerDetalle";
import PorSurtir from "./pages/refaccionaria/PorSurtir";

// Proveedores
import ProveedoresLayout from "./pages/proveedores/ProveedoresLayout";
import AltaProveedor from "./pages/proveedores/AltaProveedor";
import ConsultaProveedores from "./pages/proveedores/ConsultaProveedores";

// Vehículo
import VehiculosLayout from "./pages/vehiculo/VehiculosLayout";
import VehiculoEntrada from "./pages/vehiculo/VehiculosEntrada";
import VehiculoConsultaOrdenes from "./pages/vehiculo/VehiculosConsultaOrdenes";
import VehiculoConsultaCerradas from "./pages/vehiculo/VehiculosConsultaCerradas";
import VehiculoConsultaCanceladas from "./pages/vehiculo/VehiculosConsultaCanceladas";
import VehiculoConsultaGarantias from "./pages/vehiculo/VehiculosConsultaGarantias";
import GarageAdminPage from "./pages/vehiculo/GarageAdminPage";
import VehiculoExportar from "./pages/vehiculo/VehiculosExportar";
import VehiculoOrdenDetalle from "./pages/vehiculo/VehiculoOrdenDetalle";

// Cajas
import CajasLayout from "./pages/cajas/CajasLayout";
import CajasBuscarOrden from "./pages/cajas/CajasBuscarOrden";
import CajaOrdenDetalle from "./pages/cajas/CajaOrdenDetalle";
import GestionCaja from "./pages/cajas/GestionCaja";

// Devolución de Refacciones (formato impreso único, reemplaza las pantallas
// separadas de dinero/pieza/vale que llamaban a endpoints inexistentes)
import DevolucionRefaccion from "./pages/refaccionaria/devoluciones/DevolucionRefaccion";
import ConsultaDevoluciones from "./pages/refaccionaria/devoluciones/ConsultaDevoluciones";

import Empleados from "./pages/Empleados";
import Configuracion from "./pages/Configuracion";
import OrdenesCompraList from "./pages/OrdenesCompraList";
import OrdenesCompraNueva from "./pages/OrdenesCompraNueva";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
};

// El Navbar ya oculta el grupo "Administración" a quien no es admin, pero
// eso no bloquea entrar por URL directa — este guard cierra ese hueco.
const AdminRoute = ({ children }) => {
  const isAdmin = getUser()?.role === "admin";
  return isAdmin ? children : <Navigate to="/dashboard" replace />;
};

// El Navbar ya oculta estos grupos a roles restringidos, pero eso no bloquea
// entrar por URL directa — este guard cierra ese hueco a nivel de ruta.
const RoleRoute = ({ module, children }) => {
  const puede = canSeeModule(getUser()?.role, module);
  return puede ? children : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Público */}
        <Route path="/login" element={<LoginPage />} />

        {/* Zona privada (CON Navbar / AppLayout) */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          {/* index → /dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* Clientes */}
          <Route
            path="clientes/*"
            element={
              <RoleRoute module="clientes">
                <ClientesLayout />
              </RoleRoute>
            }
          >
            <Route index element={<Navigate to="consulta" replace />} />
            <Route path="alta" element={<AltaCliente />} />
            <Route path="alta/:id" element={<AltaCliente />} />
            <Route path="consulta" element={<ConsultaClientes />} />
          </Route>

          {/* Proveedores */}
          <Route
            path="proveedores/*"
            element={
              <RoleRoute module="proveedores">
                <ProveedoresLayout />
              </RoleRoute>
            }
          >
            <Route index element={<Navigate to="alta" replace />} />
            <Route path="alta" element={<AltaProveedor />} />
            <Route path="alta/:id" element={<AltaProveedor />} />
            <Route path="consultar" element={<ConsultaProveedores />} />
          </Route>

          {/* Vehículo */}
          <Route path="vehiculo/*" element={<VehiculosLayout />}>
            <Route index element={<Navigate to="entrada" replace />} />
            <Route path="entrada" element={<VehiculoEntrada />} />
            <Route path="consulta-ordenes" element={<VehiculoConsultaOrdenes />} />
            <Route
              path="consulta-ordenes-cerradas"
              element={<VehiculoConsultaCerradas />}
            />
            <Route
              path="consulta-ordenes-canceladas"
              element={<VehiculoConsultaCanceladas />}
            />
            <Route path="garantias" element={<VehiculoConsultaGarantias />} />
            <Route
              path="garaje"
              element={
                <AdminRoute>
                  <GarageAdminPage />
                </AdminRoute>
              }
            />
            <Route path="exportar" element={<VehiculoExportar />} />
            <Route path="orden/:id" element={<VehiculoOrdenDetalle />} />
          </Route>

          {/* Cajas */}
          <Route
            path="cajas/*"
            element={
              <RoleRoute module="cajas">
                <CajasLayout />
              </RoleRoute>
            }
          >
            <Route index element={<Navigate to="buscar" replace />} />
            <Route path="buscar" element={<CajasBuscarOrden />} />
            <Route path="gestion" element={<GestionCaja />} />
            <Route path="orden/:id" element={<CajaOrdenDetalle />} />
          </Route>

          {/* Refaccionaria */}
          <Route
            path="refaccionaria/*"
            element={
              <RoleRoute module="refaccionaria">
                <RefaccionariaLayout />
              </RoleRoute>
            }
          >
            <Route index element={<Navigate to="entrada" replace />} />
            <Route path="entrada" element={<EntradaInventario />} />
            <Route path="salida" element={<SalidaRefaccion />} />

            <Route path="solicitudes-taller" element={<SolicitudesTaller />} />
            <Route path="solicitudes-taller/:id" element={<SolicitudTallerDetalle />} />
            <Route path="por-surtir" element={<PorSurtir />} />

            {/* Devolución de Refacciones (formato impreso) */}
            <Route path="devoluciones" element={<DevolucionRefaccion />} />
            <Route path="consulta-devoluciones" element={<ConsultaDevoluciones />} />

            <Route path="consultar" element={<ConsultarInventario />} />
            <Route
              path="factura-proveedor"
              element={<ConsultarFacturaProveedor />}
            />
            <Route path="bd-codigos" element={<BDCodigos />} />
            <Route path="registar-codigos" element={<BDCodigos />} />
            <Route path="piezas-codigos" element={<PiezasCodigosPage />} />
            <Route path="servicios-catalogo" element={<ServiciosCatalogo />} />

          </Route>

          {/* Empleados (solo admin) */}
          <Route
            path="empleados"
            element={
              <AdminRoute>
                <Empleados />
              </AdminRoute>
            }
          />

          {/* Configuración (solo admin) */}
          <Route
            path="configuracion"
            element={
              <AdminRoute>
                <Configuracion />
              </AdminRoute>
            }
          />

          {/* Órdenes de compra */}
          <Route
            path="ordenes-compra"
            element={
              <RoleRoute module="ordenesCompra">
                <OrdenesCompraList />
              </RoleRoute>
            }
          />
          <Route
            path="ordenes-compra/nueva"
            element={
              <RoleRoute module="ordenesCompra">
                <OrdenesCompraNueva />
              </RoleRoute>
            }
          />

          {/* ✅ Facturación (DENTRO del layout privado) */}
          <Route
            path="facturacion/*"
            element={
              <RoleRoute module="facturacion">
                <FacturacionLayout />
              </RoleRoute>
            }
          >
            <Route index element={<FacturacionPanel />} />
            <Route path="nueva" element={<NuevaFactura />} />
            <Route path="consultar" element={<ConsultarFacturas />} />
            <Route path="configuracion-fiscal" element={<ConfiguracionFiscal />} />
          </Route>

          {/* Si quieres, fallback interno privado */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Fallback global */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
