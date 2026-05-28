// src/pages/vehiculo/VehiculoOrdenDetalle.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getVehiculoById,
  getEmpleados,
  openOperativoPdf,
  openImprimirPdf,
} from "../../api/vehiculos";
import VehiculoNuevoForm from "./VehiculoNuevoForm";
import ServicioReparacionTab from "./ServicioReparacionTab";
import VehiculoRequisicionDiagnostico from "./VehiculoRequisicionDiagnostico";
import VehiculoPresupuestoVenta from "./VehiculoPresupuestoVenta";
import VehiculoOrdenGeneral from "./VehiculoOrdenGeneral";

export default function VehiculoOrdenDetalle() {
  const { id } = useParams();
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("datos");
  const [ordenIniciada, setOrdenIniciada] = useState(false);
  const [empleados, setEmpleados] = useState([]);

  // Lógica de bloqueo centralizada
  const isClosed = orden?.estadoOrden === "CERRADA";

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const resOrden = await getVehiculoById(id);
        const v = resOrden.data.vehiculo;
        setOrden(v);
        setOrdenIniciada(!!v.ordenIniciada);

        try {
          const resEmpleados = await getEmpleados();
          setEmpleados(resEmpleados.data.empleados || resEmpleados.data);
        } catch (empErr) {
          console.warn("No se pudieron cargar los empleados.");
        }
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la orden principal.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleServicioSaved = (vehiculoActualizado) => {
    setOrden(vehiculoActualizado);
    setOrdenIniciada(true);
    setTab("req");
  };

  if (loading) return <p className="text-center mt-4">Cargando orden...</p>;
  if (error) return <p className="text-center text-danger mt-4">{error}</p>;
  if (!orden) return <p className="text-center mt-4">Orden no encontrada.</p>;

  return (
    <div className="container-fluid">
      <h2 className="text-center fw-bold my-3" style={{ letterSpacing: "2px" }}>
        DETALLE DE ORDEN DE SERVICIO
      </h2>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={"nav-link" + (tab === "datos" ? " active" : "")} onClick={() => setTab("datos")}>
            Datos del Cliente
          </button>
        </li>
        <li className="nav-item">
          <button className={"nav-link" + (tab === "servicio" ? " active" : "")} onClick={() => setTab("servicio")}>
            Servicio o Reparación
          </button>
        </li>
        {ordenIniciada && (
          <>
            <li className="nav-item">
              <button className={"nav-link" + (tab === "req" ? " active" : "")} onClick={() => setTab("req")}>
                Requisición y Diagnóstico
              </button>
            </li>
            <li className="nav-item">
              <button className={"nav-link" + (tab === "presupuesto" ? " active" : "")} onClick={() => setTab("presupuesto")}>
                Presupuesto y Venta
              </button>
            </li>
            <li className="nav-item">
              <button className={"nav-link" + (tab === "general" ? " active" : "")} onClick={() => setTab("general")}>
                General
              </button>
            </li>
          </>
        )}
      </ul>

      {/* Contenido de Tabs pasándole isClosed a todos */}
      <div className="tab-content">
        {tab === "datos" && (
          <VehiculoNuevoForm 
            cliente={null} 
            initialData={orden} 
            readOnly={true} // Siempre solo lectura aquí
          />
        )}

        {tab === "servicio" && (
          <ServicioReparacionTab
            ordenId={orden._id}
            initialData={orden.servicioReparacion}
            onSaved={handleServicioSaved}
            yaCerrada={isClosed} 
          />
        )}

        {tab === "req" && ordenIniciada && (
          <VehiculoRequisicionDiagnostico
            orden={orden}
            onSaved={(vActualizado) => setOrden(vActualizado)}
            onGoPresupuesto={() => setTab("presupuesto")} // ✅ Agregar esto
            readOnly={isClosed} 
          />
        )}

        {tab === "presupuesto" && ordenIniciada && (
          <VehiculoPresupuestoVenta
            orden={orden}
            empleados={empleados}
            onSaved={(vActualizado) => setOrden(vActualizado)}
            readOnly={isClosed} 
          />
        )}

        {tab === "general" && ordenIniciada && (
          <VehiculoOrdenGeneral 
            orden={orden} 
            readOnly={isClosed} 
          />
        )}
      </div>

      {/* Botones de Acción */}
      {(tab === "datos" || tab === "servicio") && (
        <div className="text-center my-4">
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => openImprimirPdf(orden._id)}
          >
            Imprimir PDF
          </button>
          <button
            className="btn btn-outline-primary"
            onClick={() => openOperativoPdf(orden._id)}
          >
            Formato Operativo
          </button>
        </div>
      )}
    </div>
  );
}