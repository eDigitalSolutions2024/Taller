import { getUser, logout } from '../auth';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css';
import { canSeeModule } from '../utils/roles';

export default function Navbar({ collapsed, onToggle }) {
  const user = getUser();
  const navigate = useNavigate();
  const location = useLocation();

  // === FACTURACION ===
const [factOpen, setFactOpen] = useState(
  location.pathname.startsWith("/facturacion")
);
useEffect(() => {
  if (location.pathname.startsWith("/facturacion")) setFactOpen(true);
}, [location.pathname]);

const [cajasOpen, setCajasOpen] = useState(
  location.pathname.startsWith("/cajas")
);
useEffect(() => {
  if (location.pathname.startsWith("/cajas")) setCajasOpen(true);
}, [location.pathname]);


  // === CLIENTES ===
  const [clientesOpen, setClientesOpen] = useState(
    location.pathname.startsWith('/clientes')
  );
  useEffect(() => {
    if (location.pathname.startsWith('/clientes')) setClientesOpen(true);
  }, [location.pathname]);

  // === REFACCIONARIA ===
  const [refaOpen, setRefaOpen] = useState(
    location.pathname.startsWith('/refaccionaria')
  );
  useEffect(() => {
    if (location.pathname.startsWith('/refaccionaria')) setRefaOpen(true);
  }, [location.pathname]);



  // arriba de todo, junto a otros useState:
const [ordenesOpen, setOrdenesOpen] = useState(
  location.pathname.startsWith("/ordenes")
  || location.pathname.startsWith("/ordenes-compra")
);

useEffect(() => {
  if (
    location.pathname.startsWith("/ordenes") ||
    location.pathname.startsWith("/ordenes-compra")
  ) {
    setOrdenesOpen(true);
  }
}, [location.pathname]);




  // === PROVEEDORES ===
const [provOpen, setProvOpen] = useState(
  location.pathname.startsWith('/proveedores')
);
useEffect(() => {
  if (location.pathname.startsWith('/proveedores')) setProvOpen(true);
}, [location.pathname]);

  // === NUEVO: VEHÍCULO ===
  const [vehiculoOpen, setVehiculoOpen] = useState(
    location.pathname.startsWith('/vehiculo')
  );
  useEffect(() => {
    if (location.pathname.startsWith('/vehiculo')) setVehiculoOpen(true);
  }, [location.pathname]);

  // === ADMINISTRACIÓN ===
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/empleados')
  );
  useEffect(() => {
    if (location.pathname.startsWith('/empleados')) setAdminOpen(true);
  }, [location.pathname]);



  // Devolución de Refacciones / Consulta Devoluciones viven dentro de
  // Refaccionaria: asegura que el grupo padre se abra al navegar ahí.
  useEffect(() => {
    if (location.pathname.startsWith('/refaccionaria/devoluciones') ||
        location.pathname.startsWith('/refaccionaria/consulta-devoluciones')) {
      setRefaOpen(true);
    }
  }, [location.pathname]);


  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>



      {/* Top: brand + toggle */}
      <div className="sidebar__top">
        <button
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label="Abrir/cerrar menú"
          title={collapsed ? "Expandir" : "Colapsar"}
          type="button"
        >
          ☰
        </button>


        <div className="sidebar__brand">
          {!collapsed && <span className="brand-text">🔧{user?.workshopName || "Taller"}</span>}
        </div>
      </div>





      {/* Links — mismo orden que en edigitaltaller: Inicio, Órdenes de compra,
          Cajas, Clientes, Proveedores, Vehículo, Facturación, Refaccionaria,
          Administración (propio de Taller, sin equivalente en la referencia),
          Reportes/Ajustes. */}
      <nav className="sidebar__nav">


        <NavLink to="/dashboard" className="sidebar__link" title="Inicio">
          <span className="emoji">🏠</span><span className="label">Inicio</span>
        </NavLink>



        {canSeeModule(user?.role, 'ordenesCompra') && (
          <NavLink to="/ordenes-compra" className="sidebar__link" title="Órdenes">
            <span className="emoji">📋</span><span className="label">Órdenes de compra</span>
          </NavLink>
        )}

        {/* === GRUPO: CAJAS === */}
        {canSeeModule(user?.role, 'cajas') && (
        <div className={`sidebar__group ${cajasOpen ? "open" : ""}`}>
          <button
            type="button"
            className="sidebar__link sidebar__group-toggle"
            onClick={() => setCajasOpen((o) => !o)}
            aria-expanded={cajasOpen}
            aria-controls="submenu-cajas"
            title="Cajas"
          >
            <span className="emoji">💰</span>
            <span className="label">Cajas</span>
            {!collapsed && <span className="chev" aria-hidden>▾</span>}
          </button>

          <div id="submenu-cajas" className="sidebar__sublinks">
            <NavLink to="/cajas/buscar" className={({ isActive }) => `sidebar__sublink ${isActive ? "active" : ""}`}>
              <span className="label">Buscar Orden</span>
            </NavLink>
            <NavLink to="/cajas/gestion" className={({ isActive }) => `sidebar__sublink ${isActive ? "active" : ""}`}>
              <span className="label">Gestión de Caja</span>
            </NavLink>
          </div>
        </div>
        )}
        {/* === FIN GRUPO CAJAS === */}


        {/* === GRUPO: CLIENTES === */}
        {canSeeModule(user?.role, 'clientes') && (
        <div className={`sidebar__group ${clientesOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="sidebar__link sidebar__group-toggle"
            onClick={() => setClientesOpen(o => !o)}
            aria-expanded={clientesOpen}
            aria-controls="submenu-clientes"
            title="Clientes"
          >
            <span className="emoji">👤</span>
            <span className="label">Clientes</span>
            {!collapsed && <span className="chev" aria-hidden>▾</span>}
          </button>

          <div id="submenu-clientes" className="sidebar__sublinks">
            <NavLink
              to="/clientes/alta"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="emoji">➕</span><span className="label">Alta</span>
            </NavLink>
            <NavLink
              to="/clientes/consulta"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="emoji">🔎</span><span className="label">Consulta</span>
            </NavLink>
          </div>
        </div>
        )}
        {/* === FIN GRUPO CLIENTES === */}



        {/* === GRUPO: PROVEEDORES === */}
        {canSeeModule(user?.role, 'proveedores') && (
          <div className={`sidebar__group ${provOpen ? 'open' : ''}`}>
            <button
              type="button"
              className="sidebar__link sidebar__group-toggle"
              onClick={() => setProvOpen(o => !o)}
              aria-expanded={provOpen}
              aria-controls="submenu-proveedores"
              title="Proveedores"
            >
              <span className="emoji">🏺</span>
              <span className="label">Proveedores</span>
              {!collapsed && <span className="chev" aria-hidden>▾</span>}
            </button>

            <div id="submenu-proveedores" className="sidebar__sublinks">
              <NavLink
                to="/proveedores/alta"
                className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              >
                <span className="label">Alta</span>
              </NavLink>
              <NavLink
                to="/proveedores/consultar"
                className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              >
                <span className="label">Consultar</span>
              </NavLink>
            </div>
          </div>
        )}
          {/* === FIN GRUPO PROVEEDORES === */}


         {/* === NUEVO GRUPO: VEHÍCULO === */}
        <div className={`sidebar__group ${vehiculoOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="sidebar__link sidebar__group-toggle"
            onClick={() => setVehiculoOpen(o => !o)}
            aria-expanded={vehiculoOpen}
            aria-controls="submenu-vehiculo"
            title="Vehículo"
          >
            <span className="emoji">🚗</span>
            <span className="label">Vehículo</span>
            {!collapsed && <span className="chev" aria-hidden>▾</span>}
          </button>

          <div id="submenu-vehiculo" className="sidebar__sublinks">
            <NavLink
              to="/vehiculo/entrada"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Entrada</span>
            </NavLink>

            <NavLink
              to="/vehiculo/consulta-ordenes"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Consulta Órdenes</span>
            </NavLink>

            <NavLink
              to="/vehiculo/consulta-ordenes-cerradas"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Consulta Órdenes Cerradas</span>
            </NavLink>

            <NavLink
              to="/vehiculo/consulta-ordenes-canceladas"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Canceladas</span>
            </NavLink>

            <NavLink
              to="/vehiculo/garantias"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Solicitudes de Garantías</span>
            </NavLink>

            <NavLink
              to="/vehiculo/garaje"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Garaje</span>
            </NavLink>

            
          </div>
        </div>
        {/* === FIN GRUPO VEHÍCULO === */}


        {/* === GRUPO: FACTURACIÓN === */}
        {canSeeModule(user?.role, 'facturacion') && (
          <div className={`sidebar__group ${factOpen ? "open" : ""}`}>
            <button
              type="button"
              className="sidebar__link sidebar__group-toggle"
              onClick={() => setFactOpen(o => !o)}
              aria-expanded={factOpen}
              aria-controls="submenu-facturacion"
              title="Facturación"
            >
              <span className="emoji">🧾</span>
              <span className="label">Facturación</span>
              {!collapsed && <span className="chev" aria-hidden>▾</span>}
            </button>

            <div id="submenu-facturacion" className="sidebar__sublinks">
              <NavLink to="/facturacion" end className={({isActive}) => `sidebar__sublink ${isActive ? "active": ""}`}>
                <span className="label">Panel</span>
              </NavLink>
              <NavLink to="/facturacion/nueva" className={({isActive}) => `sidebar__sublink ${isActive ? "active": ""}`}>
                <span className="label">Nueva factura</span>
              </NavLink>
              <NavLink to="/facturacion/consultar" className={({isActive}) => `sidebar__sublink ${isActive ? "active": ""}`}>
                <span className="label">Consultar</span>
              </NavLink>
            </div>
          </div>
        )}
          {/* === FIN GRUPO FACTURACIÓN === */}


        {/* === GRUPO: REFACCIONARIA === */}
        {canSeeModule(user?.role, 'refaccionaria') && (
        <div className={`sidebar__group ${refaOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="sidebar__link sidebar__group-toggle"
            onClick={() => setRefaOpen(o => !o)}
            aria-expanded={refaOpen}
            aria-controls="submenu-refaccionaria"
            title="Refaccionaria"
          >
            <span className="emoji">🧰</span>
            <span className="label">Refaccionaria</span>
            {!collapsed && <span className="chev" aria-hidden>▾</span>}
          </button>

          <div id="submenu-refaccionaria" className="sidebar__sublinks">
            <NavLink
              to="/refaccionaria/entrada"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Entrada Inventario</span>
            </NavLink>
            <NavLink
              to="/refaccionaria/salida"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Salida Refacción</span>
            </NavLink>

           { /*✅ Agregar DESPUÉS de "Salida Refacción" y ANTES del submenú Devoluciones*/}

              <NavLink
                to="/refaccionaria/solicitudes-taller"
                className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              >
                <span className="label">Solicitudes Taller</span>
              </NavLink>

              <NavLink
                to="/refaccionaria/por-surtir"
                className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              >
                <span className="label">Por Surtir</span>
              </NavLink>



            {/* Devolución de Refacciones (formato impreso único) */}
            <NavLink
              to="/refaccionaria/devoluciones"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Devolución de Refacciones</span>
            </NavLink>
            <NavLink
              to="/refaccionaria/consulta-devoluciones"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Consulta Devoluciones</span>
            </NavLink>



            <NavLink
              to="/refaccionaria/consultar"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Consultar Inventario</span>
            </NavLink>
            <NavLink
              to="/refaccionaria/factura-proveedor"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              title="Consultar Factura Proveedor"
            >
              <span className="label" style={{display:'block'}}>Consultar Factura</span>
              <span className="label" style={{display:'block'}}>Proveedor</span>
            </NavLink>
            {/* <NavLink
              to="/refaccionaria/bd-codigos"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">BD Codigos</span>
            </NavLink> */}

            <NavLink
              to="/refaccionaria/piezas-codigos"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Códigos de Piezas</span>
            </NavLink>
            <NavLink
              to="/refaccionaria/servicios-catalogo"
              className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
            >
              <span className="label">Servicios</span>
            </NavLink>
          </div>
        </div>
        )}
        {/* === FIN GRUPO REFACCIONARIA === */}


                {/* === GRUPO: ADMINISTRACIÓN (solo admin) === */}
        {user?.role === 'admin' && (
          <div className={`sidebar__group ${adminOpen ? 'open' : ''}`}>
            <button
              type="button"
              className="sidebar__link sidebar__group-toggle"
              onClick={() => setAdminOpen(o => !o)}
              aria-expanded={adminOpen}
              aria-controls="submenu-admin"
              title="Administración"
            >
              <span className="emoji">🛡️</span>
              <span className="label">Administración</span>
              {!collapsed && <span className="chev" aria-hidden>▾</span>}
            </button>

            <div id="submenu-admin" className="sidebar__sublinks">
              <NavLink
                to="/empleados"
                className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              >
                <span className="label">Personal</span>
              </NavLink>
              <NavLink
                to="/configuracion"
                className={({ isActive }) => `sidebar__sublink ${isActive ? 'active' : ''}`}
              >
                <span className="label">Configuración</span>
              </NavLink>
            </div>
          </div>
        )}
        {/* === FIN GRUPO ADMINISTRACIÓN === */}
      </nav>

      {/* Bottom */}
      <div className="sidebar__bottom">
        {!collapsed && <div className="sidebar__user">{user?.name || "Usuario"}</div>}
        <button className="sidebar__logout" onClick={handleLogout}>Salir</button>
      </div>
    </aside>
  );
}
