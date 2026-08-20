// src/pages/Configuracion.jsx
import { useEffect, useState } from "react";
import {
  getTiposCambio,
  crearTipoCambio,
  getTipoCambioSie,
  getFondoCaja,
  actualizarFondoCaja,
  getFolioOrdenServicio,
  actualizarFolioOrdenServicio,
} from "../api/configuracion";
import TipoCambioHistorialModal from "../components/TipoCambioHistorialModal";

export default function Configuracion() {
  const [tiposCambio, setTiposCambio] = useState([]);
  const [nuevoValor, setNuevoValor] = useState("");
  const [guardandoTC, setGuardandoTC] = useState(false);

  const [tipoCambioSie, setTipoCambioSie] = useState(null);
  const [cargandoSie, setCargandoSie] = useState(true);
  const [mostrarHistorialSie, setMostrarHistorialSie] = useState(false);

  const [fondoCaja, setFondoCaja] = useState(null);
  const [fondoCajaInput, setFondoCajaInput] = useState("");
  const [guardandoFondo, setGuardandoFondo] = useState(false);

  const [folioOS, setFolioOS] = useState(null);
  const [folioOSInput, setFolioOSInput] = useState("");
  const [guardandoFolio, setGuardandoFolio] = useState(false);

  const cargar = async () => {
    try {
      const [tc, fc, fo] = await Promise.all([getTiposCambio(), getFondoCaja(), getFolioOrdenServicio()]);
      setTiposCambio(tc || []);
      setFondoCaja(fc?.valor ?? 0);
      setFondoCajaInput(String(fc?.valor ?? 0));
      setFolioOS(fo);
      setFolioOSInput(String(fo?.ultimo ?? 0));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // Se carga aparte de cargar(): si Banxico está lento o caído, no debe
  // retrasar ni romper el resto de la pantalla de Configuración.
  useEffect(() => {
    (async () => {
      try {
        setCargandoSie(true);
        const data = await getTipoCambioSie();
        setTipoCambioSie(data);
      } catch {
        setTipoCambioSie(null);
      } finally {
        setCargandoSie(false);
      }
    })();
  }, []);

  const handleGuardarTipoCambio = async (e) => {
    e.preventDefault();
    const valor = Number(nuevoValor);
    if (!(valor > 0)) {
      alert("Captura un valor de tipo de cambio mayor a 0.");
      return;
    }
    try {
      setGuardandoTC(true);
      await crearTipoCambio({ valor });
      setNuevoValor("");
      await cargar();
    } catch (err) {
      alert(err?.response?.data?.msg || "Error al guardar el tipo de cambio.");
    } finally {
      setGuardandoTC(false);
    }
  };

  const handleGuardarFondoCaja = async (e) => {
    e.preventDefault();
    const valor = Number(fondoCajaInput);
    if (!(valor >= 0)) {
      alert("Captura un fondo de caja válido.");
      return;
    }
    try {
      setGuardandoFondo(true);
      await actualizarFondoCaja(valor);
      await cargar();
      alert("Fondo de caja actualizado.");
    } catch (err) {
      alert(err?.response?.data?.msg || "Error al actualizar el fondo de caja.");
    } finally {
      setGuardandoFondo(false);
    }
  };

  const handleGuardarFolioOS = async (e) => {
    e.preventDefault();
    const ultimo = Number(folioOSInput);
    if (!(ultimo >= 0)) {
      alert("Captura un folio válido (número entero mayor o igual a 0).");
      return;
    }
    try {
      setGuardandoFolio(true);
      await actualizarFolioOrdenServicio(ultimo);
      await cargar();
      alert("Folio de Orden de Servicio actualizado.");
    } catch (err) {
      alert(err?.response?.data?.msg || "Error al actualizar el folio.");
    } finally {
      setGuardandoFolio(false);
    }
  };

  const ultimoTC = tiposCambio[0];

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-3">Configuración</h4>

      <div className="row g-3">
        {/* Tipo de cambio */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-1">Tipo de Cambio</h5>
              <p className="text-muted small mb-3">
                Se usa en Presupuesto y Venta para refacciones cotizadas en dólares.
              </p>

              <div className="mb-3">
                <span className="text-muted small">Vigente: </span>
                <strong>
                  {ultimoTC ? `$${Number(ultimoTC.valor).toFixed(4)} MXN` : "Sin capturar"}
                </strong>
                {ultimoTC && (
                  <span className="text-muted small ms-2">
                    ({new Date(ultimoTC.fecha).toLocaleDateString("es-MX")} · {ultimoTC.capturadoPor})
                  </span>
                )}
              </div>

              <form className="d-flex gap-2 mb-3" onSubmit={handleGuardarTipoCambio}>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  className="form-control form-control-sm"
                  placeholder="Nuevo valor"
                  value={nuevoValor}
                  onChange={(e) => setNuevoValor(e.target.value)}
                />
                <button className="btn btn-primary btn-sm text-nowrap" disabled={guardandoTC}>
                  {guardandoTC ? "Guardando..." : "Capturar tasa"}
                </button>
              </form>

              <div className="mb-3">
                <span className="text-muted small">Referencia SIE (Banxico): </span>
                {cargandoSie ? (
                  <strong>Cargando…</strong>
                ) : tipoCambioSie ? (
                  <strong>
                    ${Number(tipoCambioSie.valor).toFixed(4)} MXN
                    <span className="text-muted small ms-1">
                      ({new Date(tipoCambioSie.fecha).toLocaleDateString("es-MX", { timeZone: "UTC" })})
                    </span>
                  </strong>
                ) : (
                  <strong>No disponible</strong>
                )}
                <div className="text-muted small">Solo como referencia, no se usa en los cálculos del sistema.</div>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mb-3"
                onClick={() => setMostrarHistorialSie(true)}
              >
                Ver historial comparado
              </button>

              <div className="table-responsive" style={{ maxHeight: 260, overflowY: "auto" }}>
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Valor</th>
                      <th>Capturó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiposCambio.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted">
                          Sin historial.
                        </td>
                      </tr>
                    )}
                    {tiposCambio.map((tc) => (
                      <tr key={tc._id}>
                        <td>{new Date(tc.fecha).toLocaleDateString("es-MX")}</td>
                        <td>${Number(tc.valor).toFixed(4)}</td>
                        <td>{tc.capturadoPor || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Fondo de caja */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-1">Fondo de Caja</h5>
              <p className="text-muted small mb-3">
                Monto fijo de referencia usado en el Cierre de Caja.
              </p>

              <div className="mb-3">
                <span className="text-muted small">Actual: </span>
                <strong>{fondoCaja != null ? `$${Number(fondoCaja).toFixed(2)}` : "…"}</strong>
              </div>

              <form className="d-flex gap-2" onSubmit={handleGuardarFondoCaja}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control form-control-sm"
                  value={fondoCajaInput}
                  onChange={(e) => setFondoCajaInput(e.target.value)}
                />
                <button className="btn btn-primary btn-sm text-nowrap" disabled={guardandoFondo}>
                  {guardandoFondo ? "Guardando..." : "Actualizar"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Folio de Orden de Servicio */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-1">Folio de Orden de Servicio</h5>
              <p className="text-muted small mb-3">
                Consecutivo automático (OS-00001, OS-00002...) que se asigna al crear una orden nueva.
              </p>

              <div className="mb-3">
                <span className="text-muted small">Último emitido: </span>
                <strong>{folioOS?.ultimoFolio || "Ninguno todavía"}</strong>
                <span className="text-muted small ms-2">
                  · Próximo: <strong>{folioOS?.proximoFolio || "…"}</strong>
                </span>
              </div>

              <form className="d-flex gap-2" onSubmit={handleGuardarFolioOS}>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-control form-control-sm"
                  value={folioOSInput}
                  onChange={(e) => setFolioOSInput(e.target.value)}
                  title="Número del último folio ya usado; el siguiente que se genere será este +1"
                />
                <button className="btn btn-primary btn-sm text-nowrap" disabled={guardandoFolio}>
                  {guardandoFolio ? "Guardando..." : "Actualizar"}
                </button>
              </form>
              <div className="form-text">
                Captura el número del último folio ya usado — la siguiente orden tomará ese número + 1.
              </div>
            </div>
          </div>
        </div>
      </div>

      <TipoCambioHistorialModal
        show={mostrarHistorialSie}
        onClose={() => setMostrarHistorialSie(false)}
      />
    </div>
  );
}
