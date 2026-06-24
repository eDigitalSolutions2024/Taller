// src/pages/vehiculo/VehiculoOrdenDetalle.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  getVehiculoById,
  getEmpleados,
} from "../../api/vehiculos";
import VehiculoNuevoForm from "./VehiculoNuevoForm";
import ServicioReparacionTab from "./ServicioReparacionTab";
import VehiculoRequisicionDiagnostico from "./VehiculoRequisicionDiagnostico";
import VehiculoPresupuestoVenta from "./VehiculoPresupuestoVenta";
import VehiculoReparacionEnCurso from "./VehiculoReparacionEnCurso";
import VehiculoOrdenGeneral from "./VehiculoOrdenGeneral";

// Navegación automática al abrir la orden según su estado
const ESTADO_TO_TAB = {
  PENDIENTE_CAPTURA:              "datos",
  PENDIENTE_REFACCIONARIA:        "req",
  PENDIENTE_AUTORIZACION_CLIENTE: "req",
  PENDIENTE_SURTIR:               "presupuesto",
  REPARACION_EN_CURSO:            "reparacion",
  PENDIENTE_CIERRE:               "general",
  PENDIENTE_CERRAR:               "general",
  CERRADA:                        "general",
};

const TAB_STEP = { datos: 0, servicio: 1, req: 2, presupuesto: 3, reparacion: 4, general: 5 };
const ESTADO_STEP = {
  PENDIENTE_CAPTURA:              0,
  PENDIENTE_REFACCIONARIA:        2,
  PENDIENTE_AUTORIZACION_CLIENTE: 3,
  PENDIENTE_SURTIR:               3,
  REPARACION_EN_CURSO:            4,
  PENDIENTE_CIERRE:               5,
  PENDIENTE_CERRAR:               5,
  CERRADA:                        5,
};

// El presupuesto siempre es visible desde estos estados sin necesitar el botón
const ESTADOS_PRESUPUESTO_SIEMPRE = [
  "PENDIENTE_SURTIR",
  "PENDIENTE_CIERRE",
  "PENDIENTE_CERRAR",
  "REPARACION_EN_CURSO",
];

const ESTADOS_REPARACION = ["REPARACION_EN_CURSO", "PENDIENTE_CIERRE", "PENDIENTE_CERRAR", "CERRADA"];

export default function VehiculoOrdenDetalle() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empleados, setEmpleados] = useState([]);

  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState(tabFromUrl || "datos");

  // Persiste el tab en la URL para que el refresh restaure la posición correcta
  const changeTab = useCallback((newTab) => {
    setTab(newTab);
    navigate(`?tab=${newTab}`, { replace: true });
  }, [navigate]);

  // El tab de presupuesto se desbloquea cuando el asesor pulsa "Continuar a Presupuesto"
  // o cuando ya hay partidas guardadas en orden.presupuesto
  const [presupuestoDesbloqueado, setPresupuestoDesbloqueado] = useState(false);

  const ordenIniciada = !!orden?.ordenIniciada;

  const presupuestoHabilitado =
    ordenIniciada &&
    (ESTADOS_PRESUPUESTO_SIEMPRE.includes(orden?.estadoOrden) || presupuestoDesbloqueado);

  const reparacionHabilitada = ESTADOS_REPARACION.includes(orden?.estadoOrden);

  const currentStep = ESTADO_STEP[orden?.estadoOrden] ?? 0;
  const isPast = (tabKey) => !orden ? false : TAB_STEP[tabKey] < currentStep;

  // Carga inicial
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await getVehiculoById(id);
        const v = res.data.vehiculo;
        setOrden(v);

        // Si ya hay presupuesto guardado, desbloquear el tab directamente
        if ((v?.presupuesto?.length ?? 0) > 0) {
          setPresupuestoDesbloqueado(true);
        }

        // Navegar al tab correspondiente al estado (solo si no viene tab en la URL)
        if (!tabFromUrl && v?.estadoOrden && ESTADO_TO_TAB[v.estadoOrden]) {
          changeTab(ESTADO_TO_TAB[v.estadoOrden]);
        }

        // Cargar empleados para la sección de Mano de Obra en Presupuesto
        try {
          const resEmp = await getEmpleados();
          setEmpleados(resEmp.data.empleados || resEmp.data || []);
        } catch {
          // opcional: mano de obra funciona aunque no se carguen
        }
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la orden.");
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Polling — refresca la orden cada 8 seg cuando el asesor está en el tab "req"
  // esperando las opciones de la refaccionaria
  useEffect(() => {
    if (tab !== "req") return;
    const interval = setInterval(async () => {
      try {
        const res = await getVehiculoById(id);
        setOrden(res.data.vehiculo);
      } catch (err) {
        console.error("Error al refrescar la orden:", err);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [tab, id]);

  // Cuando se guarda Servicio o Reparación → avanzar al tab de requisición
  const handleServicioSaved = (vehiculoActualizado) => {
    setOrden(vehiculoActualizado);
    changeTab("req");
  };

  // Llamado desde VehiculoRequisicionDiagnostico al pulsar "Continuar a Presupuesto"
  const handleGoPresupuesto = () => {
    setPresupuestoDesbloqueado(true);
    changeTab("presupuesto");
  };

  const handleOrdenSaved = (vActualizado) => {
    setOrden(vActualizado);
    if ((vActualizado?.presupuesto?.length ?? 0) > 0) {
      setPresupuestoDesbloqueado(true);
    }
  };

  // ── Renders de carga / error ──────────────────────────────────────────────
  if (loading) return <p className="text-center mt-4">Cargando orden...</p>;
  if (error)   return <p className="text-center text-danger mt-4">{error}</p>;
  if (!orden)  return <p className="text-center mt-4">Orden no encontrada.</p>;

  // Estilo para tabs ya completados (paso anterior al actual)
  const pastStyle = { backgroundColor: "#e9ecef", color: "#6c757d" };

  return (
    <div className="container-fluid">
      <h2 className="text-center fw-bold my-3" style={{ letterSpacing: "2px" }}>
        DETALLE DE ORDEN DE SERVICIO
      </h2>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <ul className="nav nav-tabs mb-3">

        <li className="nav-item">
          <button
            type="button"
            className={"nav-link" + (tab === "datos" ? " active" : "")}
            style={tab !== "datos" && isPast("datos") ? pastStyle : {}}
            onClick={() => changeTab("datos")}
          >
            Datos del Cliente
          </button>
        </li>

        <li className="nav-item">
          <button
            type="button"
            className={"nav-link" + (tab === "servicio" ? " active" : "")}
            style={tab !== "servicio" && isPast("servicio") ? pastStyle : {}}
            onClick={() => changeTab("servicio")}
          >
            Servicio o Reparación
          </button>
        </li>

        {ordenIniciada && (
          <li className="nav-item">
            <button
              type="button"
              className={"nav-link" + (tab === "req" ? " active" : "")}
              style={tab !== "req" && isPast("req") && presupuestoDesbloqueado ? pastStyle : {}}
              onClick={() => changeTab("req")}
            >
              Requisición y Diagnóstico
            </button>
          </li>
        )}

        {presupuestoHabilitado && (
          <li className="nav-item">
            <button
              type="button"
              className={"nav-link" + (tab === "presupuesto" ? " active" : "")}
              style={tab !== "presupuesto" && isPast("presupuesto") ? pastStyle : {}}
              onClick={() => changeTab("presupuesto")}
            >
              Presupuesto y Venta al Cliente
            </button>
          </li>
        )}

        {reparacionHabilitada && (
          <li className="nav-item">
            <button
              type="button"
              className={"nav-link" + (tab === "reparacion" ? " active" : "")}
              style={tab !== "reparacion" && isPast("reparacion") ? pastStyle : {}}
              onClick={() => changeTab("reparacion")}
            >
              Reparación en Curso
            </button>
          </li>
        )}

        {ordenIniciada && (
          <li className="nav-item ms-auto">
            <button
              type="button"
              className={"nav-link" + (tab === "general" ? " active" : "")}
              style={tab !== "general" && isPast("general") ? pastStyle : {}}
              onClick={() => changeTab("general")}
            >
              General
            </button>
          </li>
        )}
      </ul>

      {/* ── CONTENIDO DE TABS ────────────────────────────────────────────── */}

      {tab === "datos" && (
        <VehiculoNuevoForm cliente={null} initialData={orden} readOnly />
      )}

      {tab === "servicio" && (
        <ServicioReparacionTab
          ordenId={orden._id}
          initialData={orden.servicioReparacion}
          onSaved={handleServicioSaved}
          yaCerrada={orden.estadoOrden === "CERRADA"}
        />
      )}

      {tab === "req" && ordenIniciada && (
        orden.estadoOrden === "PENDIENTE_REFACCIONARIA" ? (
          <div className="card">
            <div className="card-body text-center py-5">
              <div
                className="spinner-border text-warning mb-3"
                role="status"
                style={{ width: "3rem", height: "3rem" }}
              >
                <span className="visually-hidden">Espera...</span>
              </div>
              <h4 className="fw-bold text-warning">EN ESPERA DE OPCIONES</h4>
              <p className="text-muted mb-1">
                La solicitud fue enviada al refaccionario. En cuanto cotice las opciones, podrás seleccionarlas aquí.
              </p>
              <p className="text-muted small">
                Esta pantalla se actualiza automáticamente cada 8 segundos.
              </p>
              <div className="mt-4">
                <h6 className="fw-semibold mb-2">Refacciones solicitadas:</h6>
                <ul
                  className="list-group list-group-flush d-inline-block text-start"
                  style={{ minWidth: 280 }}
                >
                  {(orden.refaccionesSolicitadas || []).map((r, i) => (
                    <li
                      key={i}
                      className="list-group-item d-flex justify-content-between align-items-center"
                    >
                      <span>{r.refaccion}</span>
                      <span className="badge bg-secondary ms-3">Cant: {r.cant}</span>
                    </li>
                  ))}
                  {(orden.refaccionesSolicitadas || []).length === 0 && (
                    <li className="list-group-item text-muted">Sin refacciones registradas.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <VehiculoRequisicionDiagnostico
            orden={orden}
            onSaved={(vActualizado) => setOrden(vActualizado)}
            onGoPresupuesto={handleGoPresupuesto}
          />
        )
      )}

      {tab === "presupuesto" && presupuestoHabilitado && (
        <VehiculoPresupuestoVenta
          orden={orden}
          empleados={empleados}
          onSaved={handleOrdenSaved}
          onGoPreparacion={() => changeTab("reparacion")}
        />
      )}

      {tab === "reparacion" && reparacionHabilitada && (
        <VehiculoReparacionEnCurso
          orden={orden}
          onSaved={(vActualizado) => setOrden(vActualizado)}
          onGoGeneral={() => changeTab("general")}
        />
      )}

      {tab === "general" && ordenIniciada && (
        <VehiculoOrdenGeneral orden={orden} onClosed={(vActualizado) => setOrden(vActualizado)} />
      )}
    </div>
  );
}
