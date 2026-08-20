import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { getStatsDashboard } from "../api/vehiculos";
import { getUser } from "../auth";
import { canSeeModule } from "../utils/roles";
import "../styles/dashboard.css";

// module: null → visible para todos los roles (mismo criterio que Navbar.jsx
// para el grupo Vehículo). module: "admin" → solo user.role === 'admin'
// (Empleados/Configuración no pasan por canSeeModule, son AdminRoute puro).
const ALL_TILES = [
  { key: "vehiculo-entrada",  title: "Entrada de Vehículo", desc: "Nueva orden de servicio",       to: "/vehiculo/entrada",         emoji: "🚗", module: null },
  { key: "vehiculo-ordenes",  title: "Consulta de Órdenes", desc: "Seguimiento de órdenes activas", to: "/vehiculo/consulta-ordenes", emoji: "📋", module: null },
  { key: "vehiculo-garantias",title: "Garantías",           desc: "Solicitudes y resoluciones",     to: "/vehiculo/garantias",        emoji: "🛡️", module: null },
  { key: "cajas",        title: "Cajas",           desc: "Cobros, pagos y cierre de caja",   to: "/cajas/buscar",           emoji: "💰", module: "cajas" },
  { key: "clientes",     title: "Clientes",        desc: "Altas, historial y contacto",      to: "/clientes/consulta",      emoji: "👤", module: "clientes" },
  { key: "proveedores",  title: "Proveedores",     desc: "Altas y consulta de proveedores",  to: "/proveedores/consultar",  emoji: "🏺", module: "proveedores" },
  { key: "refaccionaria",title: "Refaccionaria",   desc: "Inventario, entradas y solicitudes", to: "/refaccionaria/consultar", emoji: "🧰", module: "refaccionaria" },
  { key: "facturacion",  title: "Facturación",     desc: "CFDI y consulta de facturas",      to: "/facturacion",            emoji: "🧾", module: "facturacion" },
  { key: "ordenesCompra",title: "Órdenes de Compra", desc: "Solicitudes a proveedores",      to: "/ordenes-compra",         emoji: "📦", module: "ordenesCompra" },
  { key: "empleados",    title: "Personal",        desc: "Usuarios y acceso al sistema",     to: "/empleados",              emoji: "🧑‍💼", module: "admin" },
  { key: "configuracion",title: "Configuración",   desc: "Tipo de cambio, fondo, folios",    to: "/configuracion",          emoji: "⚙️", module: "admin" },
];

const ROLE_LABELS = {
  admin: "Administrador",
  staff: "Staff",
  mecanico: "Mecánico",
  recepcion: "Recepción",
  contabilidad: "Contabilidad",
  consulta: "Consulta",
};

const PERIODOS = [
  { key: "hoy", label: "Hoy" },
  { key: "mes", label: "Este mes" },
  { key: "todas", label: "Todas" },
];
const PERIODO_LABELS = { hoy: "Hoy", mes: "Este mes", todas: "Todas" };

export default function Dashboard() {
  const [periodo, setPeriodo] = useState("hoy");
  const [stats, setStats] = useState({ ordenes: 0, enProceso: 0, entregadas: 0, personal: false });
  const user = getUser();

  const tiles = useMemo(() => {
    return ALL_TILES.filter((t) => {
      if (t.module === null) return true;
      if (t.module === "admin") return user?.role === "admin";
      return canSeeModule(user?.role, t.module);
    });
  }, [user?.role]);

  const puedeVerClientes = canSeeModule(user?.role, "clientes");

  useEffect(() => {
    let abort = false;
    getStatsDashboard(periodo)
      .then((res) => {
        if (!abort && res.data?.data) setStats(res.data.data);
      })
      .catch((err) => console.error("Error cargando estadísticas del dashboard:", err));
    return () => { abort = true; };
  }, [periodo]);

  return (
    <div className="dash-wrap">
      {/* Encabezado / Hero */}
      <header className="dash-hero">
        <div className="dash-hero__left">
          <h1 className="dash-title">Bienvenido{user?.name ? `, ${user.name}` : ""} 👋</h1>
          <p className="dash-subtitle">
            AutoServicio D y G · Panel principal
            {user?.role && (
              <span className="dash-role-badge">{ROLE_LABELS[user.role] || user.role}</span>
            )}
          </p>
          <div className="dash-actions">
            <NavLink to="/vehiculo/entrada" className="btn btn-primary">Nueva orden</NavLink>
            {puedeVerClientes && (
              <NavLink to="/clientes/alta" className="btn btn-ghost">Nuevo cliente</NavLink>
            )}
          </div>
        </div>
        <div className="dash-hero__right">
          <div className="dash-period-toggle">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`dash-period-btn ${periodo === p.key ? "active" : ""}`}
                onClick={() => setPeriodo(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="dash-stat">
            <div className="dash-stat__label">
              {stats.personal ? "Mis órdenes" : "Órdenes"} · {PERIODO_LABELS[periodo]}
            </div>
            <div className="dash-stat__value">{stats.ordenes}</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__label">En proceso</div>
            <div className="dash-stat__value">{stats.enProceso}</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__label">Entregadas · {PERIODO_LABELS[periodo]}</div>
            <div className="dash-stat__value">{stats.entregadas}</div>
          </div>
        </div>
      </header>
      {stats.personal && (
        <p className="dash-stats-note">Estos números son de tus propias órdenes, no del taller completo.</p>
      )}

      {/* Buscador */}
      <section className="dash-toolbar">
        <input className="dash-search" placeholder="Buscar cliente, orden, placa..." />
      </section>

      {/* Secciones — filtradas según los módulos que el rol puede ver
          (mismo criterio que Navbar.jsx / RoleRoute en App.js). */}
      <section className="dash-grid">
        {tiles.map((it) => (
          <NavLink key={it.key} to={it.to} className="tile">
            <div className="tile__emoji">{it.emoji}</div>
            <div className="tile__title">{it.title}</div>
            <div className="tile__desc">{it.desc}</div>
          </NavLink>
        ))}
      </section>
    </div>
  );
}
