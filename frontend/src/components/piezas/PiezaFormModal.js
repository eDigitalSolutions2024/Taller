import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';

const UNIDADES = ['PZA', 'PAR', 'JGO', 'LT', 'ML', 'KG', 'GR', 'MT', 'CM', 'OTRO'];
const ESTATUSES = [
  { valor: 'disponible',      etiqueta: 'Disponible',      color: '#22c55e' },
  { valor: 'bajo_inventario', etiqueta: 'Bajo Inventario', color: '#f59e0b' },
  { valor: 'agotado',         etiqueta: 'Agotado',         color: '#ef4444' },
  { valor: 'descontinuado',   etiqueta: 'Descontinuado',   color: '#6b7280' },
];
const VACIO = {
  codigo: '', nombrePieza: '', numeroPieza: '', proveedor: '',
  marca: '', unidadMedida: 'PZA',
  cantidad: '', cantidadMinima: '', cantidadMaxima: '',
  precioUnitario: '', estatus: 'disponible', notas: '',
};

const calcularEstatus = (cantidad, cantidadMinima) => {
  const cant = Number(cantidad);
  const min  = Number(cantidadMinima) || 0;
  if (cant === 0) return 'agotado';
  if (min > 0 && cant <= min) return 'bajo_inventario';
  return 'disponible';
};

const construirCodigo = (nombrePieza, numeroPieza, marca, proveedor) => {
  const limpiar = (str, len) =>
    (str || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, len).toUpperCase();
  const partes = [];
  const pNombre = limpiar(nombrePieza, 3);
  if (pNombre) partes.push(pNombre);
  const pMarca = limpiar(marca || proveedor, 2);
  if (pMarca) partes.push(pMarca);
  const pNumero = limpiar(numeroPieza, 8);
  if (pNumero) {
    partes.push(pNumero);
  } else {
    const hoy = new Date();
    partes.push(`${String(hoy.getFullYear()).slice(-2)}${String(hoy.getMonth()+1).padStart(2,'0')}`);
  }
  return partes.join('-');
};

// ── Alerta visual de inventario ────────────────────────────────────────────
const AlertaInventario = memo(({ cantidad, cantidadMinima, cantidadMaxima }) => {
  const cant = Number(cantidad);
  const min  = Number(cantidadMinima);
  const max  = Number(cantidadMaxima);

  if (!cantidad && cantidad !== 0) return null;

  const alertas = [];

  if (min > 0 && cant <= min && cant > 0) {
    alertas.push({ color: '#f59e0b', bg: '#fefce8', border: '#fde68a', msg: `⚠️ Stock bajo — hay ${cant} unidades, el mínimo es ${min}` });
  }
  if (cant === 0) {
    alertas.push({ color: '#dc2626', bg: '#fef2f2', border: '#fecaca', msg: `❌ Sin stock — cantidad en 0` });
  }
  if (max > 0 && cant > max) {
    alertas.push({ color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', msg: `📦 Excede el máximo — hay ${cant}, el máximo es ${max}` });
  }
  if (alertas.length === 0 && min > 0 && cant > min) {
    alertas.push({ color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', msg: `✅ Stock OK — ${cant} unidades (mínimo: ${min}${max > 0 ? `, máximo: ${max}` : ''})` });
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {alertas.map((a, i) => (
        <div key={i} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: `1px solid ${a.border}`, background: a.bg, color: a.color, fontWeight: 600 }}>
          {a.msg}
        </div>
      ))}
    </div>
  );
});

// ── Campos memoizados ──────────────────────────────────────────────────────
const Campo = memo(({ label, name, value, onChange, error, req, type = 'text', placeholder, hint, ...rest }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={ls.label}>{label}{req && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}</label>
    <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
      style={{ ...ls.input, ...(error ? { borderColor: '#ef4444', background: '#fef2f2' } : {}) }} {...rest} />
    {hint && <span style={ls.hint}>{hint}</span>}
    {error && <span style={ls.errMsg}>{error}</span>}
  </div>
));

const SelectCampo = memo(({ label, name, value, onChange, options }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={ls.label}>{label}</label>
    <select name={name} value={value} onChange={onChange} style={ls.input}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
));

const EstatusSelector = memo(({ value, onChange, cantidad, cantidadMinima }) => {
  const toggleDescontinuado = () => {
    if (value === 'descontinuado') {
      onChange(calcularEstatus(cantidad, cantidadMinima));
    } else {
      onChange('descontinuado');
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={ls.label}>Estatus de Inventario</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {ESTATUSES.map(({ valor, etiqueta, color }) => {
          const esDescontinuado = valor === 'descontinuado';
          const activo = value === valor;
          return (
            <button key={valor} type="button"
              style={{
                border: `2px solid ${color}`, borderRadius: 20, padding: '4px 14px',
                fontSize: 12, fontWeight: 600,
                cursor: esDescontinuado ? 'pointer' : 'default',
                background: activo ? color : 'transparent',
                color: activo ? '#fff' : color,
                opacity: !esDescontinuado && !activo ? 0.4 : 1,
              }}
              onClick={esDescontinuado ? toggleDescontinuado : undefined}
            >{etiqueta}</button>
          );
        })}
      </div>
    </div>
  );
});

// ── Modal principal ────────────────────────────────────────────────────────
export default function PiezaFormModal({ abierto, onCerrar, onGuardar, piezaEditar }) {
  const [form, setForm]           = useState(VACIO);
  const [errores, setErrores]     = useState({});
  const [guardando, setGuardando] = useState(false);
  const inputCodigoRef            = useRef(null);
  const esEdicion                 = Boolean(piezaEditar);

  useEffect(() => {
    if (!abierto) return;
    setForm(piezaEditar ? { ...VACIO, ...piezaEditar } : VACIO);
    setErrores({});
  }, [abierto, piezaEditar]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if ((name === 'cantidad' || name === 'cantidadMinima') && prev.estatus !== 'descontinuado') {
        const cant = name === 'cantidad'       ? value : prev.cantidad;
        const min  = name === 'cantidadMinima' ? value : prev.cantidadMinima;
        next.estatus = calcularEstatus(cant, min);
      }
      return next;
    });
    setErrores(prev => prev[name] ? { ...prev, [name]: '' } : prev);
  }, []);

  const handleEstatusChange = useCallback((valor) => {
    setForm(prev => ({ ...prev, estatus: valor }));
  }, []);

  const handleGenerarCodigo = useCallback(() => {
    setForm(prev => {
      if (!prev.nombrePieza.trim()) {
        setErrores(e => ({ ...e, nombrePieza: 'Escribe el nombre para generar el código' }));
        return prev;
      }
      const codigo = construirCodigo(prev.nombrePieza, prev.numeroPieza, prev.marca, prev.proveedor);
      setErrores(e => ({ ...e, codigo: '' }));
      return { ...prev, codigo };
    });
    setTimeout(() => inputCodigoRef.current?.focus(), 50);
  }, []);

  const validar = () => {
    const e = {};
    if (!form.codigo.trim())      e.codigo      = 'El código es requerido';
    if (!form.nombrePieza.trim()) e.nombrePieza = 'El nombre es requerido';
    if (!form.proveedor.trim())   e.proveedor   = 'El proveedor es requerido';
    if (form.cantidad === '' || Number(form.cantidad) < 0) e.cantidad = 'Cantidad válida requerida';
    if (form.precioUnitario === '' || Number(form.precioUnitario) < 0) e.precioUnitario = 'Precio válido requerido';
    const min = Number(form.cantidadMinima);
    const max = Number(form.cantidadMaxima);
    if (form.cantidadMinima !== '' && form.cantidadMaxima !== '' && max > 0 && min > max) {
      e.cantidadMinima = 'El mínimo no puede ser mayor que el máximo';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    try {
      await onGuardar({
        ...form,
        cantidad:       Number(form.cantidad),
        cantidadMinima: form.cantidadMinima !== '' ? Number(form.cantidadMinima) : 0,
        cantidadMaxima: form.cantidadMaxima !== '' ? Number(form.cantidadMaxima) : 0,
        precioUnitario: Number(form.precioUnitario),
      });
      onCerrar();
    } catch (err) {
      setErrores(prev => ({ ...prev, general: err.response?.data?.mensaje || 'Error al guardar' }));
    } finally {
      setGuardando(false);
    }
  };

  // ── useMemo ANTES del return ──────────────────────────────────────────────
  const alertaInventario = useMemo(() => (
    <AlertaInventario
      cantidad={form.cantidad}
      cantidadMinima={form.cantidadMinima}
      cantidadMaxima={form.cantidadMaxima}
    />
  ), [form.cantidad, form.cantidadMinima, form.cantidadMaxima]);

  if (!abierto) return null;

  return (
    <div style={ls.overlay}>
      <div style={ls.modal}>

        <div style={ls.header}>
          <div>
            <h2 style={ls.titulo}>{esEdicion ? 'Editar Pieza' : 'Nueva Pieza'}</h2>
            <p style={ls.subtitulo}>{esEdicion ? `Editando: ${piezaEditar.codigo}` : 'Catálogo de piezas'}</p>
          </div>
          <button style={ls.btnX} onClick={onCerrar}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px' }}>
          {errores.general && <div style={ls.errGeneral}>{errores.general}</div>}

          <Seccion titulo="Identificación" />

          {/* Código */}
          <div style={{ marginBottom: 12 }}>
            <label style={ls.label}>Código <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputCodigoRef}
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                placeholder="Escribe o usa ⚡ Generar"
                style={{ ...ls.input, flex: 1, fontFamily: 'monospace', fontSize: 14, ...(errores.codigo ? { borderColor: '#ef4444', background: '#fef2f2' } : {}) }}
              />
              <button type="button" style={ls.btnGenerar} onClick={handleGenerarCodigo}>⚡ Generar</button>
            </div>
            {errores.codigo && <span style={ls.errMsg}>{errores.codigo}</span>}
          </div>

          <div style={ls.g2}>
            <Campo label="Nombre de Pieza" name="nombrePieza" value={form.nombrePieza} onChange={handleChange} error={errores.nombrePieza} req placeholder="Ej: Bujía" />
            <Campo label="Número de Pieza" name="numeroPieza" value={form.numeroPieza} onChange={handleChange} placeholder="Ej: NGK-BP6ES" />
          </div>

          <Seccion titulo="Proveedor & Marca" />
          <div style={ls.g2}>
            <Campo label="Proveedor" name="proveedor" value={form.proveedor} onChange={handleChange} error={errores.proveedor} req placeholder="Ej: Distribuidora Norte" />
            <Campo label="Marca"     name="marca"     value={form.marca}     onChange={handleChange} placeholder="Ej: NGK, Bosch" />
          </div>

          <Seccion titulo="Inventario & Precio" />

          <div style={ls.g2}>
            <SelectCampo label="Unidad de Medida" name="unidadMedida" value={form.unidadMedida} onChange={handleChange} options={UNIDADES} />
            <Campo label="Precio Unitario ($)" name="precioUnitario" value={form.precioUnitario} onChange={handleChange} error={errores.precioUnitario} req type="number" min="0" step="0.01" placeholder="0.00" />
          </div>

          <div style={ls.g3}>
            <Campo label="Cantidad Actual" name="cantidad" value={form.cantidad} onChange={handleChange} error={errores.cantidad} req type="number" min="0" placeholder="0" />
            <Campo
              label="Cantidad Mínima"
              name="cantidadMinima"
              value={form.cantidadMinima}
              onChange={handleChange}
              error={errores.cantidadMinima}
              type="number" min="0" placeholder="0"
              hint="Alerta de stock bajo"
            />
            <Campo
              label="Cantidad Máxima"
              name="cantidadMaxima"
              value={form.cantidadMaxima}
              onChange={handleChange}
              type="number" min="0" placeholder="0"
              hint="0 = sin límite"
            />
          </div>

          {/* Alerta visual — ya memoizada arriba */}
          {alertaInventario}

          <div style={{ marginTop: 12 }}>
            <EstatusSelector
              value={form.estatus}
              cantidad={form.cantidad}
              cantidadMinima={form.cantidadMinima}
              onChange={handleEstatusChange}
            />
          </div>

          <Campo label="Notas" name="notas" value={form.notas} onChange={handleChange}
            placeholder="Notas adicionales, compatibilidad, observaciones..." />

          <div style={ls.footer}>
            <button type="button" style={ls.btnCancel} onClick={onCerrar}>Cancelar</button>
            <button type="submit" style={ls.btnSave} disabled={guardando}>
              {guardando ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Crear Pieza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const Seccion = ({ titulo }) => (
  <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: 4, marginBottom: 12, marginTop: 8 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>{titulo}</span>
  </div>
);

const ls = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  modal:      { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', margin: '0 16px' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' },
  titulo:     { margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' },
  subtitulo:  { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  btnX:       { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' },
  g2:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  g3:         { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  label:      { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 },
  input:      { width: '100%', padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  hint:       { fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block', lineHeight: 1.5 },
  errMsg:     { fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' },
  errGeneral: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 },
  btnGenerar: { border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '0 16px', cursor: 'pointer', whiteSpace: 'nowrap' },
  footer:     { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' },
  btnCancel:  { padding: '9px 20px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  btnSave:    { padding: '9px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
};