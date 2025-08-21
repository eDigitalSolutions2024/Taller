import { getUser, logout } from '../auth';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/Navbar.css';

export default function Navbar({ collapsed, onToggle }) {
  const user = getUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [clientesOpen, setClientesOpen] = useState(
    location.pathname.startsWith('/clientes')
  );
  useEffect(() => {
    if (location.pathname.startsWith('/clientes')) setClientesOpen(true);
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
          <span className="emoji">🔧</span>
          {!collapsed && <span className="brand-text">{user?.workshopName || "Taller"}</span>}
        </div>
      </div>

      {/* Links */}
      <nav className="sidebar__nav">
        <NavLink to="/dashboard" className="sidebar__link" title="Inicio">
          <span className="emoji">🏠</span><span className="label">Inicio</span>
        </NavLink>

        <NavLink to="/ordenes" className="sidebar__link" title="Órdenes">
          <span className="emoji">📋</span><span className="label">Órdenes</span>
        </NavLink>

        {/* === GRUPO: CLIENTES con submenú === */}
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

          {/* Submenú */}
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
        {/* === FIN GRUPO CLIENTES === */}

        <NavLink to="/inventario" className="sidebar__link" title="Inventario">
          <span className="emoji">🧰</span><span className="label">Inventario</span>
        </NavLink>

        <NavLink to="/reportes" className="sidebar__link" title="Reportes">
          <span className="emoji">📈</span><span className="label">Reportes</span>
        </NavLink>

        <NavLink to="/ajustes" className="sidebar__link" title="Ajustes">
          <span className="emoji">⚙️</span><span className="label">Ajustes</span>
        </NavLink>
      </nav>

      {/* Bottom */}
      <div className="sidebar__bottom">
        {!collapsed && <div className="sidebar__user">{user?.name || "Usuario"}</div>}
        <button className="sidebar__logout" onClick={handleLogout}>Salir</button>
      </div>
    </aside>
  );
}
