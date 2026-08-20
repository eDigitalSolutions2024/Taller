import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMisOrdenes } from "../api/vehiculos";
import { getUser } from "../auth";
import "../styles/OSFlotante.css";

const ESTADO_LABEL = {
  INGRESO: "Ingreso",
  PENDIENTE_REFACCIONARIA: "Refaccionaria",
  PENDIENTE_AUTORIZACION_CLIENTE: "Aut. Cliente",
  PENDIENTE_SURTIR: "Por surtir",
  PENDIENTE_CIERRE: "Pdte. cierre",
  REPARACION_EN_CURSO: "En reparación",
  PENDIENTE_CERRAR: "Por cerrar",
  CERRADA: "Cerrada",
  CANCELADA: "Cancelada",
};

const ESTADO_COLOR = {
  INGRESO: "#6c757d",
  PENDIENTE_REFACCIONARIA: "#0d6efd",
  PENDIENTE_AUTORIZACION_CLIENTE: "#fd7e14",
  PENDIENTE_SURTIR: "#6610f2",
  PENDIENTE_CIERRE: "#dc3545",
  REPARACION_EN_CURSO: "#198754",
  PENDIENTE_CERRAR: "#ffc107",
  CERRADA: "#343a40",
  CANCELADA: "#dc3545",
};

function tiempoTranscurrido(fechaCreacion) {
  const diff = Date.now() - new Date(fechaCreacion).getTime();
  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) return `${dias}d ${horas % 24}h`;
  if (horas > 0) return `${horas}h ${minutos % 60}m`;
  return `${minutos}m`;
}

// El snapshot del cliente vive plano en la propia orden.
function nombreCliente(orden) {
  return (
    orden.nombreGobierno ||
    [orden.nombreCliente, orden.apellidoPaterno, orden.apellidoMaterno].filter(Boolean).join(" ") ||
    "—"
  );
}

// Widget flotante y arrastrable con las órdenes activas creadas por el
// usuario actual. Se oculta solo mientras no ha terminado de cargar o si no
// tiene ninguna orden activa (no estorba a roles que no levantan órdenes).
export default function OSFlotante() {
  const user = getUser();
  const navigate = useNavigate();

  const [ordenes, setOrdenes] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [, setTick] = useState(0);

  // Posición inicial: esquina superior derecha
  const [pos, setPos] = useState({ x: window.innerWidth - 300, y: 20 });
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);
  const intervalRef = useRef(null);

  const cargar = async () => {
    try {
      const { data } = await getMisOrdenes();
      if (data?.ok) setOrdenes(data.data);
    } catch {
      // silencioso
    } finally {
      setCargado(true);
    }
  };

  useEffect(() => {
    if (!user) return;
    cargar();
    intervalRef.current = setInterval(cargar, 30000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresca al volver a la pestaña/ventana para mostrar el estado actualizado
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const onNuevaOrden = () => cargar();
    window.addEventListener("orden-creada", onNuevaOrden);
    return () => window.removeEventListener("orden-creada", onNuevaOrden);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Drag handlers ──────────────────────────────────────────
  const startDrag = useCallback((clientX, clientY) => {
    dragging.current = true;
    hasDragged.current = false;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
  }, [pos]);

  const onMouseDown = useCallback((e) => {
    if (e.target.closest(".os-flotante__toggle")) return;
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  }, [startDrag]);

  const onTouchStart = useCallback((e) => {
    if (e.target.closest(".os-flotante__toggle")) return;
    const t = e.touches[0];
    if (!t) return;
    startDrag(t.clientX, t.clientY);
  }, [startDrag]);

  useEffect(() => {
    const moveTo = (clientX, clientY) => {
      hasDragged.current = true;
      const newX = clientX - offset.current.x;
      const newY = clientY - offset.current.y;
      const maxX = window.innerWidth - (widgetRef.current?.offsetWidth || 280);
      const maxY = window.innerHeight - (widgetRef.current?.offsetHeight || 50);
      setPos({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };
    const onMouseMove = (e) => { if (dragging.current) moveTo(e.clientX, e.clientY); };
    const onMouseUp = () => { dragging.current = false; };
    const onTouchMove = (e) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      if (!t) return;
      moveTo(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onTouchEnd = () => { dragging.current = false; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  // Al girar la tablet cambia window.innerWidth/innerHeight pero `pos` se
  // mantiene con las coordenadas viejas: si el widget vivía pegado a la
  // esquina derecha en horizontal, queda fuera de la vista en vertical.
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => {
        const maxX = Math.max(0, window.innerWidth - (widgetRef.current?.offsetWidth || 280));
        const maxY = Math.max(0, window.innerHeight - (widgetRef.current?.offsetHeight || 50));
        return { x: Math.min(prev.x, maxX), y: Math.min(prev.y, maxY) };
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  if (!user || !cargado || ordenes.length === 0) return null;

  return (
    <div ref={widgetRef} className="os-flotante" style={{ left: pos.x, top: pos.y }}>
      <div
        className="os-flotante__header"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={() => { if (!hasDragged.current) setMinimizado((m) => !m); }}
      >
        <span className="os-flotante__titulo">
          ⠿ Mis OS
          <span className="os-flotante__badge">{ordenes.length}</span>
        </span>
        <button
          className="os-flotante__toggle"
          title={minimizado ? "Expandir" : "Minimizar"}
          onClick={(e) => { e.stopPropagation(); setMinimizado((m) => !m); }}
        >
          {minimizado ? "▲" : "▼"}
        </button>
      </div>

      {!minimizado && (
        <div className="os-flotante__body">
          <ul className="os-flotante__lista">
            {ordenes.map((os) => (
              <li
                key={os._id}
                className="os-flotante__item os-flotante__item--clickable"
                onClick={() => navigate(`/vehiculo/orden/${os._id}`)}
              >
                <div className="os-flotante__item-top">
                  <span className="os-flotante__num">{os.ordenServicio}</span>
                  <span
                    className="os-flotante__estado"
                    style={{ backgroundColor: ESTADO_COLOR[os.estadoOrden] || "#6c757d" }}
                  >
                    {ESTADO_LABEL[os.estadoOrden] || os.estadoOrden}
                  </span>
                </div>
                <div className="os-flotante__cliente">
                  {nombreCliente(os)}
                  {os.cliente?.esEmpleado && (
                    <div><span className="badge bg-warning text-dark">Empleado</span></div>
                  )}
                </div>
                <div className="os-flotante__vehiculo">
                  {[os.marca, os.modelo, os.anio].filter(Boolean).join(" ")}
                  {os.color && <span className="os-flotante__color"> · {os.color}</span>}
                </div>
                <div className="os-flotante__timer">⏱ {tiempoTranscurrido(os.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
