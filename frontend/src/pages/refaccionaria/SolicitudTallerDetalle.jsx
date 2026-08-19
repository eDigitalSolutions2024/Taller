import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getVehiculoById,
  saveRequisicionDiagnostico,
} from "../../api/vehiculos";
import { getUser } from "../../auth";
import useTipoCambioActual from "../../hooks/useTipoCambioActual";
import ModalBuscarCodigo from "./components/ModalBuscarCodigo";

const UNIDADES = ["Pieza", "Caja", "Juego", "Litro", "Kilogramo"];

export default function SolicitudTallerDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [orden, setOrden] = useState(null);
  const [refacciones, setRefacciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modalCodigoIndex, setModalCodigoIndex] = useState(null);
  const [modalAlmacenOpen, setModalAlmacenOpen] = useState(false);
  const [filtroOpcion, setFiltroOpcion] = useState(null);

  const { tipoCambio: tipoCambioConfig, loading: cargandoTipoCambio } = useTipoCambioActual();

  const cargarOrden = async () => {
    try {
      setLoading(true);
      const res = await getVehiculoById(id);
      const vehiculo = res.data?.vehiculo;

      setOrden(vehiculo || null);
      setRefacciones(
        (vehiculo?.refaccionesSolicitadas || []).map((item) => ({
          ...item,
          cant: Number(item.cant || 0),
          refaccion: item.refaccion || "",
          estatus: item.estatus || "PENDIENTE",
          opcionSeleccionada:
            item.opcionSeleccionada === undefined ? null : item.opcionSeleccionada,
          opciones: Array.isArray(item.opciones)
            ? item.opciones.map((op) => ({
                ...op,
                unidad: op.unidad || "",
                tipo: op.tipo || "",
                marca: op.marca || "",
                proveedor: op.proveedor || "",
                codigo: op.codigo || "",
                precioUnitario: Number(op.precioUnitario || 0),
                tipoCambio: Number(op.tipoCambio || 0),
                importeTotal:
                  Number(op.importeTotal || 0) ||
                  Number(item.cant || 0) *
                    Number(op.precioUnitario || 0) *
                    (op.moneda === "USD" ? Number(op.tipoCambio || 0) : 1),
                moneda: op.moneda || "MN",
                tiempoEntrega: op.tiempoEntrega || "",
                core: op.core || "",
                precioCore: Number(op.precioCore || 0),
                observaciones: op.observaciones || "",
              }))
            : [],

          nuevaOpcion: {
            unidad: "",
            tipo: "",
            marca: "",
            proveedor: "",
            codigo: "",
            precioUnitario: "",
            moneda: "MN",
            tipoCambio: "",
            tiempoEntrega: "",
            core: "",
            precioCore: "",
            observaciones: "",
          },
        }))
      );
    } catch (err) {
      console.error("Error cargando solicitud:", err);
      alert("Error al cargar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOrden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // El snapshot del cliente vive plano en la propia orden.
  const nombreCliente = () =>
    orden?.nombreGobierno ||
    [orden?.nombreCliente, orden?.apellidoPaterno, orden?.apellidoMaterno].filter(Boolean).join(" ") ||
    "Sin cliente";

  const descripcionVehiculo = () =>
    [orden?.marca, orden?.modelo, orden?.anio].filter(Boolean).join(" ") || "Sin vehículo";

  const seleccionarCodigo = (item) => {
    const idx = modalCodigoIndex;
    const tienePrecio = item.precioUnitario != null && item.precioUnitario !== "";
    const bloqueados = [
      ...(item.proveedor ? ["proveedor"] : []),
      ...(item.marca ? ["marca"] : []),
      ...(item.unidadMedida ? ["unidad"] : []),
    ];
    setRefacciones((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        return {
          ...r,
          nuevaOpcion: {
            ...r.nuevaOpcion,
            codigo: item.codigo || "",
            proveedor: item.proveedor || r.nuevaOpcion?.proveedor || "",
            marca: item.marca || r.nuevaOpcion?.marca || "",
            unidad: item.unidadMedida || r.nuevaOpcion?.unidad || "",
            precioUnitario: tienePrecio ? String(item.precioUnitario) : r.nuevaOpcion?.precioUnitario || "",
            _camposBloqueados: bloqueados,
          },
        };
      })
    );
    setModalCodigoIndex(null);
  };

  const seleccionarDeAlmacen = (item) => {
    const tienePrecio = item.precioUnitario != null && item.precioUnitario !== "";
    setRefacciones((prev) =>
      prev.map((r, i) => {
        if (i !== selectedIndex) return r;
        return {
          ...r,
          nuevaOpcion: {
            ...r.nuevaOpcion,
            codigo: item.codigo || "",
            unidad: item.unidadMedida || r.nuevaOpcion?.unidad || "",
            marca: item.marca || r.nuevaOpcion?.marca || "",
            precioUnitario: tienePrecio ? String(item.precioUnitario) : r.nuevaOpcion?.precioUnitario || "",
          },
        };
      })
    );
    setModalAlmacenOpen(false);
  };

  const cambiarNuevaOpcion = (index, field, value) => {
    setRefacciones((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const nuevaOpcion = { ...item.nuevaOpcion, [field]: value };

        if (nuevaOpcion._errores?.includes(field)) {
          nuevaOpcion._errores = nuevaOpcion._errores.filter((f) => f !== field);
        }
        if (field === "core" && value !== "SI") nuevaOpcion.precioCore = "";
        if (field === "moneda") {
          nuevaOpcion.tipoCambio = value === "USD" ? (tipoCambioConfig ? String(tipoCambioConfig) : "") : "";
          nuevaOpcion._errores = nuevaOpcion._errores?.filter((f) => f !== "tipoCambio");
        }

        return { ...item, nuevaOpcion };
      })
    );
  };

  const agregarOpcion = (index) => {
    setRefacciones((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const op = item.nuevaOpcion || {};
        const precio = Number(op.precioUnitario || 0);
        const cant = Number(item.cant || 0);
        const tipoCambio = op.moneda === "USD" ? Number(op.tipoCambio || 0) : 1;

        const errores = [];
        if (!op.marca?.trim()) errores.push("marca");
        if (!op.proveedor?.trim()) errores.push("proveedor");
        if (precio <= 0) errores.push("precioUnitario");
        if (op.moneda === "USD" && tipoCambio <= 0) errores.push("tipoCambio");

        if (errores.length > 0) {
          return { ...item, nuevaOpcion: { ...op, _errores: errores } };
        }

        return {
          ...item,
          opciones: [
            ...(item.opciones || []),
            {
              unidad: op.unidad || "",
              tipo: op.tipo || "",
              marca: op.marca || "",
              proveedor: op.proveedor || "",
              codigo: op.codigo || "",
              precioUnitario: precio,
              tipoCambio: op.moneda === "USD" ? tipoCambio : 0,
              importeTotal: cant * precio * tipoCambio,
              moneda: op.moneda || "MN",
              tiempoEntrega: op.tiempoEntrega || "",
              core: op.core || "",
              precioCore: op.core === "SI" ? Number(op.precioCore || 0) : 0,
              observaciones: op.observaciones || "",
            },
          ],
          nuevaOpcion: {
            unidad: "", tipo: "", marca: "", proveedor: "", codigo: "",
            precioUnitario: "", moneda: "MN", tipoCambio: "", tiempoEntrega: "",
            core: "", precioCore: "", observaciones: "",
          },
        };
      })
    );
  };

  const eliminarOpcion = (refIndex, opIndex) => {
    setRefacciones((prev) =>
      prev.map((item, i) =>
        i !== refIndex ? item : { ...item, opciones: (item.opciones || []).filter((_, idx) => idx !== opIndex) }
      )
    );
  };

  const validarRefacciones = () => {
    const sinOpciones = refacciones.some(
      (item) =>
        !String(item.refaccion || "").trim() ||
        Number(item.cant || 0) <= 0 ||
        !Array.isArray(item.opciones) ||
        item.opciones.length === 0
    );

    if (sinOpciones) {
      alert("Cada refacción solicitada debe tener al menos una opción cotizada.");
      return false;
    }
    return true;
  };

  const guardar = async (nuevoEstadoOrden) => {
    if (!validarRefacciones()) return;

    try {
      setSaving(true);

      // Esta pantalla carga la orden una sola vez al entrar (sin polling) y
      // el asesor puede seleccionar/quitar opciones mientras tanto desde
      // Requisición y Diagnóstico. opcionSeleccionada/estatus/seleccionada
      // son decisión exclusiva del asesor: si se guardara con el snapshot
      // viejo, este guardado los pisaría (la selección "se quita" sin razón
      // aparente en la pantalla del asesor). Por eso se refresca la orden
      // justo antes de guardar y esos campos se toman del dato más fresco,
      // no del que se cargó al abrir esta pantalla.
      const fresco = await getVehiculoById(id);
      const refaccionesFrescas = fresco.data?.vehiculo?.refaccionesSolicitadas || [];

      const payload = {
        refacciones: refacciones.map((item, idx) => {
          const base = refaccionesFrescas[idx] || {};
          const opcionesBase = Array.isArray(base.opciones) ? base.opciones : [];
          return {
            ...item,
            cant: Number(item.cant || 0),
            opciones: (item.opciones || []).map((op, opIdx) => ({
              ...op,
              precioUnitario: Number(op.precioUnitario || 0),
              tipoCambio: op.moneda === "USD" ? Number(op.tipoCambio || 0) : 0,
              importeTotal:
                Number(item.cant || 0) *
                Number(op.precioUnitario || 0) *
                (op.moneda === "USD" ? Number(op.tipoCambio || 0) : 1),
              precioCore: op.core === "SI" ? Number(op.precioCore || 0) : 0,
              moneda: op.moneda || "MN",
              seleccionada: opcionesBase[opIdx] ? !!opcionesBase[opIdx].seleccionada : false,
            })),
            opcionSeleccionada:
              base.opcionSeleccionada === undefined ? null : base.opcionSeleccionada,
            estatus: base.estatus || "PENDIENTE",
          };
        }),
      };

      if (nuevoEstadoOrden) {
        payload.estadoOrden = nuevoEstadoOrden;
        payload.devueltoPor = getUser()?.name || "";
      }

      const res = await saveRequisicionDiagnostico(id, payload);
      setOrden(res.data?.vehiculo || orden);

      alert(nuevoEstadoOrden ? "Solicitud devuelta al asesor correctamente." : "Solicitud guardada correctamente.");

      if (nuevoEstadoOrden) {
        navigate("/refaccionaria/solicitudes-taller");
      }
    } catch (err) {
      console.error("Error guardando solicitud:", err);
      alert("Error al guardar la solicitud.");
    } finally {
      setSaving(false);
    }
  };

  const total = refacciones.reduce((sum, item) => {
    const totalOpciones = (item.opciones || []).reduce((acc, op) => acc + Number(op.importeTotal || 0), 0);
    return sum + totalOpciones;
  }, 0);

  if (loading) {
    return (
      <div className="container-fluid py-3">
        <div className="text-muted">Cargando solicitud...</div>
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="container-fluid py-3">
        <div className="alert alert-warning">No se encontró la solicitud.</div>
      </div>
    );
  }

  const itemSeleccionado = refacciones[selectedIndex] ?? null;

  const opcionesAMostrar =
    filtroOpcion === null
      ? refacciones.flatMap((item, ri) =>
          (item.opciones || []).map((op, oi) => ({ ...op, _ri: ri, _oi: oi, _refaccion: item.refaccion, _cant: item.cant }))
        )
      : (refacciones[filtroOpcion]?.opciones || []).map((op, oi) => ({
          ...op,
          _ri: filtroOpcion,
          _oi: oi,
          _refaccion: refacciones[filtroOpcion].refaccion,
          _cant: refacciones[filtroOpcion].cant,
        }));

  return (
    <div className="container-fluid py-3 d-flex flex-column gap-3">
      {/* ── Sección 1: Información del vehículo ─────────────────────────── */}
      <div className="card">
        <div className="card-header fw-bold text-center py-2">ATENDER SOLICITUD DE REFACCIONES</div>
        <div className="card-body py-2">
          <div className="row g-2">
            <div className="col-6 col-md-3">
              <label className="form-label form-label-sm fw-semibold mb-1">Orden</label>
              <input className="form-control form-control-sm" value={orden.ordenServicio || ""} disabled />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label form-label-sm fw-semibold mb-1">Cliente</label>
              <input className="form-control form-control-sm" value={nombreCliente()} disabled />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label form-label-sm fw-semibold mb-1">Vehículo</label>
              <input className="form-control form-control-sm" value={descripcionVehiculo()} disabled />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label form-label-sm fw-semibold mb-1">Placas</label>
              <input className="form-control form-control-sm" value={orden.placas || ""} disabled />
            </div>
          </div>
          <div className="row g-2 mt-1">
            <div className="col-6 col-md-2">
              <label className="form-label form-label-sm fw-semibold mb-1">Color</label>
              <input className="form-control form-control-sm" value={orden.color || ""} disabled />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label form-label-sm fw-semibold mb-1">Serie</label>
              <input className="form-control form-control-sm" value={orden.serie || ""} disabled />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label form-label-sm fw-semibold mb-1">KMS/Millas</label>
              <input className="form-control form-control-sm" value={orden.kmsMillas || ""} disabled />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label form-label-sm fw-semibold mb-1">Motor</label>
              <input className="form-control form-control-sm" value={orden.motor || ""} disabled />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label form-label-sm fw-semibold mb-1">No. Económico</label>
              <input className="form-control form-control-sm" value={orden.numeroEconomico || ""} disabled />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label form-label-sm fw-semibold mb-1">Tracción</label>
              <input className="form-control form-control-sm" value={orden.traccion || ""} disabled />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sección 2: Lista de solicitudes + Formulario de captura (maestro-detalle) ── */}
      <div className="card">
        <div className="card-header fw-bold py-2">Cotizar refacciones</div>
        <div className="card-body p-0">
          <div className="row g-0" style={{ minHeight: 320 }}>
            {/* Columna izquierda: lista de refacciones solicitadas */}
            <div className="col-md-4 border-end d-flex flex-column">
              <div className="px-3 py-2 fw-semibold border-bottom bg-light small text-uppercase text-muted">
                Piezas solicitadas
              </div>
              <div style={{ overflowY: "auto", maxHeight: 420 }}>
                {refacciones.length === 0 ? (
                  <p className="text-muted text-center py-4 small">Sin refacciones solicitadas.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {refacciones.map((item, index) => {
                      const numOpciones = (item.opciones || []).length;
                      const isActive = index === selectedIndex;
                      return (
                        <li
                          key={item._id || index}
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-start py-2 px-3"
                          style={{
                            cursor: "pointer",
                            backgroundColor: isActive ? "#7a1f1f" : undefined,
                            borderColor: isActive ? "#7a1f1f" : undefined,
                            color: isActive ? "#fff" : undefined,
                          }}
                          onClick={() => setSelectedIndex(index)}
                        >
                          <div>
                            <div className="fw-semibold">{item.refaccion || "Sin nombre"}</div>
                            <small className={isActive ? "text-white-50" : "text-muted"}>Cant: {item.cant}</small>
                          </div>
                          <span className={`badge rounded-pill ms-2 mt-1 ${numOpciones > 0 ? "bg-success" : "bg-secondary"}`}>
                            {numOpciones}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Columna derecha: formulario de captura */}
            <div className="col-md-8 d-flex flex-column">
              <div className="px-3 py-2 fw-semibold border-bottom bg-light small text-uppercase text-muted">
                Cotizar opción
              </div>
              <div className="p-3">
                {!itemSeleccionado ? (
                  <p className="text-muted small">Selecciona una refacción de la lista.</p>
                ) : (
                  <>
                    <p className="fw-semibold mb-3 border-bottom pb-2">
                      Agregar opción para: <span className="text-primary">{itemSeleccionado.refaccion}</span>
                      <span className="text-muted ms-2 small">(Cant: {itemSeleccionado.cant})</span>
                    </p>
                    <div className="row g-2">
                      <div className="col-6 col-md-4">
                        <label className="form-label form-label-sm mb-1">Unidad</label>
                        <select
                          className="form-select form-select-sm"
                          value={itemSeleccionado.nuevaOpcion?.unidad || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "unidad", e.target.value)}
                          disabled={itemSeleccionado.nuevaOpcion?._camposBloqueados?.includes("unidad")}
                        >
                          <option value="">—</option>
                          {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>

                      <div className="col-6 col-md-4">
                        <label className="form-label form-label-sm mb-1">Tipo</label>
                        <select
                          className="form-select form-select-sm"
                          value={itemSeleccionado.nuevaOpcion?.tipo || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "tipo", e.target.value)}
                        >
                          <option value="">— Selec. —</option>
                          <option value="Original">Original</option>
                          <option value="Usado">Usado</option>
                          <option value="Generico">Genérico</option>
                          <option value="Alterna">Alterna</option>
                        </select>
                      </div>

                      <div className="col-6 col-md-4">
                        <label className="form-label form-label-sm mb-1">Marca <span className="text-danger">*</span></label>
                        <input
                          className={`form-control form-control-sm ${itemSeleccionado.nuevaOpcion?._errores?.includes("marca") ? "is-invalid" : ""}`}
                          placeholder="Ej. Bosch"
                          value={itemSeleccionado.nuevaOpcion?.marca || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "marca", e.target.value)}
                          disabled={itemSeleccionado.nuevaOpcion?._camposBloqueados?.includes("marca")}
                        />
                      </div>

                      <div className="col-6 col-md-4">
                        <label className="form-label form-label-sm mb-1">Proveedor <span className="text-danger">*</span></label>
                        {itemSeleccionado.nuevaOpcion?.proveedor === "Almacén" ? (
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-success">Almacén</span>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              title="Cambiar proveedor"
                              onClick={() => cambiarNuevaOpcion(selectedIndex, "proveedor", "")}
                            >✕</button>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center gap-1">
                            <input
                              className={`form-control form-control-sm ${itemSeleccionado.nuevaOpcion?._errores?.includes("proveedor") ? "is-invalid" : ""}`}
                              placeholder="Ej. Distribuidora XYZ"
                              value={itemSeleccionado.nuevaOpcion?.proveedor || ""}
                              onChange={(e) => cambiarNuevaOpcion(selectedIndex, "proveedor", e.target.value)}
                              disabled={itemSeleccionado.nuevaOpcion?._camposBloqueados?.includes("proveedor")}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-success text-nowrap px-3"
                              title="Usar almacén como proveedor"
                              onClick={() => cambiarNuevaOpcion(selectedIndex, "proveedor", "Almacén")}
                            >Almacén</button>
                          </div>
                        )}
                      </div>

                      <div className="col-6 col-md-4">
                        <label className="form-label form-label-sm mb-1">Código</label>
                        {itemSeleccionado.nuevaOpcion?.proveedor === "Almacén" ? (
                          <div className="d-flex gap-1">
                            <input
                              className="form-control form-control-sm"
                              value={itemSeleccionado.nuevaOpcion?.codigo || ""}
                              readOnly
                              placeholder="Seleccionar del inventario..."
                              style={{ backgroundColor: "#f8f9fa" }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm text-nowrap"
                              onClick={() => setModalAlmacenOpen(true)}
                            >Buscar</button>
                          </div>
                        ) : (
                          <div className="d-flex gap-1">
                            <input
                              className="form-control form-control-sm"
                              placeholder="Ej. AZ-BJ-2345"
                              value={itemSeleccionado.nuevaOpcion?.codigo || ""}
                              onChange={(e) => cambiarNuevaOpcion(selectedIndex, "codigo", e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm text-nowrap"
                              onClick={() => setModalCodigoIndex(selectedIndex)}
                            >Buscar</button>
                          </div>
                        )}
                      </div>
                      <div className="col-6 col-md-4"></div>

                      <div className="col-6 col-md-2">
                        <label className="form-label form-label-sm mb-1">Precio unit. <span className="text-danger">*</span></label>
                        <input
                          type="number"
                          className={`form-control form-control-sm ${itemSeleccionado.nuevaOpcion?._errores?.includes("precioUnitario") ? "is-invalid" : ""}`}
                          placeholder="$0.00"
                          value={itemSeleccionado.nuevaOpcion?.precioUnitario || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "precioUnitario", e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-2">
                        <label className="form-label form-label-sm mb-1">Moneda</label>
                        <select
                          className="form-select form-select-sm"
                          value={itemSeleccionado.nuevaOpcion?.moneda || "MN"}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "moneda", e.target.value)}
                        >
                          <option value="MN">MN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>

                      {itemSeleccionado.nuevaOpcion?.moneda === "USD" && (
                        <div className="col-6 col-md-2">
                          <label className="form-label form-label-sm mb-1">Tipo cambio</label>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            className={`form-control form-control-sm ${itemSeleccionado.nuevaOpcion?._errores?.includes("tipoCambio") ? "is-invalid" : ""}`}
                            placeholder="Ej. 17.25"
                            value={itemSeleccionado.nuevaOpcion?.tipoCambio || ""}
                            disabled
                            readOnly
                            title="Se toma del tipo de cambio definido en Configuración"
                          />
                          {!cargandoTipoCambio && !tipoCambioConfig && (
                            <small className="text-danger">No hay un tipo de cambio configurado.</small>
                          )}
                        </div>
                      )}

                      <div className="col-6 col-md-3">
                        <label className="form-label form-label-sm mb-1">Tiempo entrega</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Ej. 2 días"
                          value={itemSeleccionado.nuevaOpcion?.tiempoEntrega || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "tiempoEntrega", e.target.value)}
                        />
                      </div>

                      <div className="col-4 col-md-2">
                        <label className="form-label form-label-sm mb-1">Core</label>
                        <select
                          className="form-select form-select-sm"
                          value={itemSeleccionado.nuevaOpcion?.core || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "core", e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="SI">SI</option>
                          <option value="NO">NO</option>
                          <option value="N/A">N/A</option>
                        </select>
                      </div>

                      {itemSeleccionado.nuevaOpcion?.core === "SI" && (
                        <div className="col-4 col-md-2">
                          <label className="form-label form-label-sm mb-1">Precio core</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="$0.00"
                            value={itemSeleccionado.nuevaOpcion?.precioCore || ""}
                            onChange={(e) => cambiarNuevaOpcion(selectedIndex, "precioCore", e.target.value)}
                          />
                        </div>
                      )}

                      <div className="col-12 col-md-5">
                        <label className="form-label form-label-sm mb-1">Observaciones</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Notas adicionales..."
                          value={itemSeleccionado.nuevaOpcion?.observaciones || ""}
                          onChange={(e) => cambiarNuevaOpcion(selectedIndex, "observaciones", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="d-flex justify-content-end mt-3">
                      <button type="button" className="btn btn-primary btn-sm px-4" onClick={() => agregarOpcion(selectedIndex)}>
                        + Agregar opción
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sección 3: Opciones cotizadas ───────────────────────────────── */}
      <div className="card">
        <div className="card-header py-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="fw-bold">Opciones cotizadas</span>
          <div className="d-flex align-items-center gap-2">
            <label className="form-label form-label-sm mb-0 text-muted">Filtrar:</label>
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={filtroOpcion === null ? "" : String(filtroOpcion)}
              onChange={(e) => setFiltroOpcion(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Todas las refacciones</option>
              {refacciones.map((item, i) => (
                <option key={i} value={i}>{item.refaccion}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-bordered table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Refacción</th>
                  <th>Cant</th>
                  <th>Tipo</th>
                  <th>Marca</th>
                  <th>Proveedor</th>
                  <th>Código</th>
                  <th>Unidad</th>
                  <th>Precio unit.</th>
                  <th>Importe</th>
                  <th>Moneda</th>
                  <th>T. cambio</th>
                  <th>T. entrega</th>
                  <th>Core</th>
                  <th>P. core</th>
                  <th>Observaciones</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {opcionesAMostrar.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center text-muted py-3">No hay opciones cotizadas aún.</td>
                  </tr>
                ) : (
                  opcionesAMostrar.map((op, flatIdx) => (
                    <tr key={flatIdx}>
                      <td className="fw-semibold">{op._refaccion}</td>
                      <td>{op._cant}</td>
                      <td>{op.tipo || "—"}</td>
                      <td>{op.marca || "—"}</td>
                      <td>{op.proveedor || "—"}</td>
                      <td>{op.codigo || "—"}</td>
                      <td>{op.unidad || "—"}</td>
                      <td>${Number(op.precioUnitario || 0).toFixed(2)}</td>
                      <td>${Number(op.importeTotal || 0).toFixed(2)}</td>
                      <td>{op.moneda}</td>
                      <td>{op.moneda === "USD" ? Number(op.tipoCambio || 0).toFixed(2) : "—"}</td>
                      <td>{op.tiempoEntrega || "—"}</td>
                      <td>{op.core || "—"}</td>
                      <td>{op.core === "SI" ? `$${Number(op.precioCore || 0).toFixed(2)}` : "—"}</td>
                      <td>{op.observaciones || "—"}</td>
                      <td>
                        <button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={() => eliminarOpcion(op._ri, op._oi)}>
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className="text-end fw-bold">Total estimado</td>
                  <td className="fw-bold">${total.toFixed(2)}</td>
                  <td colSpan={7}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/refaccionaria/solicitudes-taller")} disabled={saving}>
          Regresar
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => guardar()} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => guardar("PENDIENTE_AUTORIZACION_CLIENTE")}
          disabled={saving || refacciones.length === 0}
        >
          Devolver a asesor
        </button>
      </div>

      {modalCodigoIndex !== null && (
        <ModalBuscarCodigo onSeleccionar={seleccionarCodigo} onCerrar={() => setModalCodigoIndex(null)} />
      )}
      {modalAlmacenOpen && (
        <ModalBuscarCodigo onSeleccionar={seleccionarDeAlmacen} onCerrar={() => setModalAlmacenOpen(false)} />
      )}
    </div>
  );
}
