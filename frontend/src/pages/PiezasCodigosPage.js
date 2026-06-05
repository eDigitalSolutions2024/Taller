import React, { useState, useEffect, useCallback } from 'react';
import PiezaFormModal from '../components/piezas/PiezaFormModal';
import {
  getPiezas,
  crearPieza,
  actualizarPieza,
  eliminarPieza,
  getEstadisticas,
} from '../api/piezasCodigosApi';

// ── Configuración de colores por estatus ───────────────────────────────────
const ESTATUS_CONFIG = {
  disponible:      { color: '#16a34a', bg: '#dcfce7', etiqueta: 'Disponible' },
  bajo_inventario: { color: '#d97706', bg: '#fef3c7', etiqueta: 'Bajo Stock' },
  agotado:         { color: '#dc2626', bg: '#fee2e2', etiqueta: 'Agotado' },
  descontinuado:   { color: '#4b5563', bg: '#f3f4f6', etiqueta: 'Descontinuado' },
};

export default function PiezasCodigosPage() {
  const [piezas, setPiezas]           = useState([]);
  const [total, setTotal]             = useState(0);
  const [pagina, setPagina]           = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando]       = useState(false);
  const [busqueda, setBusqueda]       = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [stats, setStats]             = useState([]);
  const [totalPiezas, setTotalPiezas] = useState(0);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [piezaEditar, setPiezaEditar]   = useState(null);

  // Confirmación eliminar
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const LIMITE = 15;

  // ── Cargar datos ───────────────────────────────────────────────────────
  const cargarPiezas = useCallback(async () => {
    setCargando(true);
    try {
      const data = await getPiezas({
        pagina,
        limite: LIMITE,
        busqueda,
        estatus: filtroEstatus,
      });
      setPiezas(data.piezas);
      setTotal(data.total);
      setTotalPaginas(data.totalPaginas);
    } catch (err) {
      console.error('Error al cargar piezas:', err);
    } finally {
      setCargando(false);
    }
  }, [pagina, busqueda, filtroEstatus]);

  const cargarStats = useCallback(async () => {
    try {
      const data = await getEstadisticas();
      setStats(data.estadisticas);
      setTotalPiezas(data.totalPiezas);
    } catch (err) {
      console.error('Error stats:', err);
    }
  }, []);

  useEffect(() => { cargarPiezas(); }, [cargarPiezas]);
  useEffect(() => { cargarStats(); }, [cargarStats]);

  // Reset página al cambiar filtros
  useEffect(() => { setPagina(1); }, [busqueda, filtroEstatus]);

  // ── Acciones CRUD ──────────────────────────────────────────────────────
  const handleGuardar = async (datos) => {
    if (piezaEditar) {
      await actualizarPieza(piezaEditar._id, datos);
    } else {
      await crearPieza(datos);
    }
    await cargarPiezas();
    await cargarStats();
  };

  const handleEditar = (pieza) => {
    setPiezaEditar(pieza);
    setModalAbierto(true);
  };

  const handleNuevo = () => {
    setPiezaEditar(null);
    setModalAbierto(true);
  };

  const handleEliminar = async (id) => {
    try {
      await eliminarPieza(id);
      setConfirmarEliminar(null);
      await cargarPiezas();
      await cargarStats();
    } catch (err) {
      alert('Error al eliminar: ' + (err.response?.data?.mensaje || err.message));
    }
  };

  // ── Calcular valor total del inventario ────────────────────────────────
  const valorInventario = piezas.reduce(
    (acc, p) => acc + (p.cantidad * p.precioUnitario), 0
  );

  return (
    <div style={estilos.pagina}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={estilos.header}>
        <div>
          <h1 style={estilos.titulo}>
            🔧 Códigos de Piezas
            <span style={estilos.badgePrueba}>PRUEBA</span>
          </h1>
          <p style={estilos.subtitulo}>
            Catálogo de refacciones — {totalPiezas} piezas registradas
          </p>
        </div>
        <button style={estilos.btnNuevo} onClick={handleNuevo}>
          + Nueva Pieza
        </button>
      </div>

      {/* ── Tarjetas de estadísticas ─────────────────────────────────── */}
      <div style={estilos.statsGrid}>
        <TarjetaStat
          titulo="Total Piezas"
          valor={totalPiezas}
          icono="📦"
          color="#2563eb"
        />
        {stats.map(s => {
          const cfg = ESTATUS_CONFIG[s._id] || {};
          return (
            <TarjetaStat
              key={s._id}
              titulo={cfg.etiqueta || s._id}
              valor={s.total}
              icono={s._id === 'disponible' ? '✅' : s._id === 'agotado' ? '❌' : s._id === 'bajo_inventario' ? '⚠️' : '🔒'}
              color={cfg.color}
              subtexto={`Cant: ${s.cantidadTotal}`}
            />
          );
        })}
        <TarjetaStat
          titulo="Valor Inventario"
          valor={`$${valorInventario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
          icono="💰"
          color="#059669"
        />
      </div>

      {/* ── Filtros y búsqueda ──────────────────────────────────────────── */}
      <div style={estilos.filtrosBar}>
        <div style={estilos.searchWrap}>
          <span style={estilos.searchIcon}>🔍</span>
          <input
            style={estilos.searchInput}
            placeholder="Buscar por código, nombre, proveedor, marca..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button style={estilos.clearBtn} onClick={() => setBusqueda('')}>✕</button>
          )}
        </div>

        <select
          style={estilos.selectFiltro}
          value={filtroEstatus}
          onChange={e => setFiltroEstatus(e.target.value)}
        >
          <option value="">Todos los estatus</option>
          {Object.entries(ESTATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.etiqueta}</option>
          ))}
        </select>

        <span style={estilos.totalLabel}>{total} resultado{total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
      <div style={estilos.tablaWrap}>
        {cargando ? (
          <div style={estilos.cargando}>Cargando piezas...</div>
        ) : piezas.length === 0 ? (
          <div style={estilos.vacio}>
            <div style={{ fontSize: 48 }}>🔩</div>
            <p>No se encontraron piezas</p>
            <button style={estilos.btnNuevo} onClick={handleNuevo}>
              + Agregar primera pieza
            </button>
          </div>
        ) : (
          <table style={estilos.tabla}>
            <thead>
              <tr>
                {['Código', 'Nombre', 'N° Pieza', 'Proveedor', 'Marca', 'UM', 'Cant.', 'Precio Unit.', 'Estatus', 'Acciones'].map(h => (
                  <th key={h} style={estilos.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {piezas.map((p, i) => {
                const cfg = ESTATUS_CONFIG[p.estatus] || {};
                return (
                  <tr key={p._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={estilos.td}>
                      <span style={estilos.codigo}>{p.codigo}</span>
                    </td>
                    <td style={estilos.td}>{p.nombrePieza}</td>
                    <td style={{ ...estilos.td, color: '#64748b', fontSize: 12 }}>{p.numeroPieza || '—'}</td>
                    <td style={estilos.td}>{p.proveedor}</td>
                    <td style={estilos.td}>{p.marca || '—'}</td>
                    <td style={{ ...estilos.td, textAlign: 'center' }}>{p.unidadMedida}</td>
                    <td style={{ ...estilos.td, textAlign: 'center', fontWeight: 700,
                      color: p.cantidad === 0 ? '#dc2626' : p.cantidad <= 5 ? '#d97706' : '#16a34a' }}>
                      {p.cantidad}
                    </td>
                    <td style={{ ...estilos.td, textAlign: 'right' }}>
                      ${p.precioUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={estilos.td}>
                      <span style={{
                        ...estilos.badge,
                        background: cfg.bg,
                        color: cfg.color,
                      }}>
                        {cfg.etiqueta}
                      </span>
                    </td>
                    <td style={{ ...estilos.td, whiteSpace: 'nowrap' }}>
                      <button style={estilos.btnEditar} onClick={() => handleEditar(p)} title="Editar">
                        ✏️
                      </button>
                      <button style={estilos.btnEliminar}
                        onClick={() => setConfirmarEliminar(p)} title="Eliminar">
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Paginación ──────────────────────────────────────────────────── */}
      {totalPaginas > 1 && (
        <div style={estilos.paginacion}>
          <button
            style={estilos.btnPag}
            disabled={pagina === 1}
            onClick={() => setPagina(p => p - 1)}
          >
            ← Anterior
          </button>
          <span style={estilos.paginaInfo}>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            style={estilos.btnPag}
            disabled={pagina === totalPaginas}
            onClick={() => setPagina(p => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── Modal Formulario ────────────────────────────────────────────── */}
      <PiezaFormModal
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setPiezaEditar(null); }}
        onGuardar={handleGuardar}
        piezaEditar={piezaEditar}
      />

      {/* ── Confirmación Eliminar ────────────────────────────────────────── */}
      {confirmarEliminar && (
        <div style={estilos.overlayConfirm}>
          <div style={estilos.dialogConfirm}>
            <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>⚠️ Eliminar Pieza</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
              ¿Eliminar <strong>{confirmarEliminar.codigo}</strong> — {confirmarEliminar.nombrePieza}?
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={estilos.btnCancelar} onClick={() => setConfirmarEliminar(null)}>
                Cancelar
              </button>
              <button style={estilos.btnEliminarConfirm}
                onClick={() => handleEliminar(confirmarEliminar._id)}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponente TarjetaStat ──────────────────────────────────────────────
function TarjetaStat({ titulo, valor, icono, color, subtexto }) {
  return (
    <div style={{ ...estilos.statCard, borderTopColor: color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={estilos.statTitulo}>{titulo}</p>
          <p style={{ ...estilos.statValor, color }}>{valor}</p>
          {subtexto && <p style={estilos.statSub}>{subtexto}</p>}
        </div>
        <span style={{ fontSize: 28 }}>{icono}</span>
      </div>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const estilos = {
  pagina: { padding: '24px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  titulo: { margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 },
  badgePrueba: { fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: 1 },
  subtitulo: { margin: 0, color: '#64748b', fontSize: 14 },
  btnNuevo: {
    padding: '10px 20px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  statCard: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    borderTop: '4px solid', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
  },
  statTitulo: { margin: '0 0 4px', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValor: { margin: 0, fontSize: 26, fontWeight: 800 },
  statSub: { margin: '4px 0 0', fontSize: 11, color: '#94a3b8' },
  filtrosBar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  searchWrap: { position: 'relative', flex: 1, minWidth: 220 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14 },
  searchInput: {
    width: '100%', padding: '9px 36px 9px 32px', border: '1.5px solid #d1d5db',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  clearBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' },
  selectFiltro: { padding: '9px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff' },
  totalLabel: { fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' },
  tablaWrap: { background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0',
    background: '#f8fafc', whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  codigo: { fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1d4ed8', letterSpacing: 0.5 },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  btnEditar: { background: '#eff6ff', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', marginRight: 4, fontSize: 14 },
  btnEliminar: { background: '#fef2f2', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 14 },
  cargando: { textAlign: 'center', padding: 48, color: '#64748b', fontSize: 15 },
  vacio: { textAlign: 'center', padding: '48px 24px', color: '#64748b' },
  paginacion: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 },
  btnPag: { padding: '8px 16px', border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  paginaInfo: { fontSize: 13, color: '#64748b' },
  overlayConfirm: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  dialogConfirm: { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' },
  btnCancelar: { padding: '8px 16px', border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnEliminarConfirm: { padding: '8px 16px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
};