// src/pages/vehiculo/VehiculoNuevoForm.jsx
import React, { useEffect, useState } from "react";
import { createVehiculo, updateDatosOrden } from "../../api/vehiculos";
import VehicleDamageCanvas from "../../components/VehicleDamageCanvas";
import { getUser } from "../../auth";

function generateOrdenServicio() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm   = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd   = String(ahora.getDate()).padStart(2, "0");
  const hh   = String(ahora.getHours()).padStart(2, "0");
  const mi   = String(ahora.getMinutes()).padStart(2, "0");
  const ss   = String(ahora.getSeconds()).padStart(2, "0");
  return `OS-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}
function getTodayInputDate() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,"0")}-${String(ahora.getDate()).padStart(2,"0")}`;
}
function getCurrentInputTime() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
}
function formatDateForInput(value) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.includes("T")) return value.split("T")[0];
  }
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}-${String(fecha.getDate()).padStart(2,"0")}`;
}

export default function VehiculoNuevoForm({ cliente, initialData, readOnly = false, onCreated }) {
  const esParticular    = cliente?.tipoCliente === "Particular";
  const requiereFactura = cliente?.requiereFacturacion === true;

  const [form, setForm] = useState({
    // ── Cabecera ──────────────────────────────────────────
    ordenServicio:  "",
    fechaRecepcion: "",
    horaRecepcion:  "",

    // ── Datos cliente PARTICULAR ──────────────────────────
    nombreCliente:   "",
    apellidoPaterno: "",
    apellidoMaterno: "",

    // ── Datos cliente EMPRESA / GOBIERNO ──────────────────
    nombreGobierno:              "",
    nombreContactoGobierno:      "",
    nombreDependencia:           "",
    nombreContactoDependencia:   "",

    // ── Teléfonos / dirección ──────────────────────────────
    telefonoFijoLada: "",
    telefonoFijo:     "",
    celularLada:      "",
    celular:          "",
    direccion:        "",
    numeroExt:        "",
    numeroInt:        "",
    colonia:          "",
    rfc:              "",
    regimenFiscal:    "",
    usoCFDI:          "",
    codigoPostal:     "",
    ciudad:           "",
    estado:           "",
    formaPago:        "",
    metodoPago:       "",

    // ── Vehículo ──────────────────────────────────────────
    nombreUsuarioDejaVehiculo: "",
    marca:          "",
    modelo:         "",
    anio:           "",
    color:          "",
    serie:          "",   // VIN
    puertas:        "",
    placas:         "",
    kmsMillas:      "",
    transmision:    "",   // STD / AUT
    cilindros:      "",   // 4 / 6 / 8
    combustion:     "",   // Gasolina / Diesel / Híbrido / Eléctrico
    seguroRines:    "",   // SI / NO
    llavesControl:  "",   // SI / NO
    nacionalidad:   "",
    motor:          "",
    numeroEconomico:"",
    correos:        [],
    traccion:       "",

    // ── Accesorios / daños ───────────────────────────────
    grua:                 "",
    precioGrua:           0,
    espejoLateralIzq:     false,
    espejoLateralDer:     false,
    copasDelanterasIzq:   false,
    copasDelanterasDer:   false,
    parabrisas:           "",
    focosDel:             false,
    focosTras:            false,
    espejoInt:            false,
    tapetesDelanterosIzq: false,
    tapetesDelanterosDer: false,
    estereo:              false,
    extra:                false,
    copasTraserasIzq:     false,
    copasTraserasDer:     false,
    micas:                false,
    antena:               false,
    encendedor:           false,
    tapetesTraserosIzq:   false,
    tapetesTraserosDer:   false,
    gato:                 false,
    bateria:              false,
    // ── Inventario faltante del PDF ───────────────────────
    cristalesExt:         false,   // Exterior
    limpiadoresExt:       false,
    cristalesInt:         false,   // Interior
    limpiadoresInt:       false,
    llaveRueda:           false,   // Accesorios
    extintor:             false,
    llantaExtra:          false,
    cablesCorrente:       false,
    cruceta:              false,
    nivelGasolina:        false,
    danoVehiculo:         null,
    fotosVehiculo:        [],   // fotos subidas del vehículo

    // ── A) Llantas ────────────────────────────────────────
    llantaMedida:          "",
    balanceoDelantero:     false,
    balanceoTrasero:       false,
    balanceo4:             false,
    alineacion:            false,
    montajes:              "",
    reparacionNor:         "",
    reparacionDep:         "",
    testigoTPMSPrendido:   "",   // SI / NO
    tipoLlantaNormal:      false,
    tipoLlantaDeportivo:   false,
    valvulasDel:           false,
    valvulasTras:          false,
    valvulas4:             false,
    rotacion:              false,
    observLlantas:         "",

    // ── B) Suspensión y Dirección ─────────────────────────
    amortiguadoresDel:            "",
    amortiguadoresTras:           "",
    partesSuspRuidosDel:          "",
    partesSuspRuidosTras:         "",
    sistemasDireccionRuidos:      "",
    observAmortiguadores:         "",
    observPartesSusp:             "",
    observDireccion:              "",

    // ── C) Afinación ─────────────────────────────────────
    afinCilindros:         "",   // 4 / 6 / 8
    carbsInyecTurbo:       false,
    tabCheckEngine:        "",   // SI / NO (testigo)
    tabFallaMotor:         "",   // SI / NO (testigo)
    afinCheckEngine:       "",
    resetAceite:           "",
    resetMantenimiento:    "",
    afinFallaMotor:        "",
    cambioAceite:          "",
    lavadoEngrasado:       "",
    verificacionVehicular: "",
    diagnosticoScanner:    "",

    // ── D) Frenos ─────────────────────────────────────────
    frenosDelanteros:        "",
    frenosTraseros:          "",
    frenosGenerales:         "",
    limpiezaAjusteDel:       "",
    limpiezaAjusteTras:      "",
    conformadoD:             false,
    conformadoT:             false,
    liquidoFrenosNivel:      "",
    tabABS:                  "",   // SI / NO (testigo)
    cambioYPurgadoFreno:     "",
    observFrenosGen:         "",

    // ── E) Motor ──────────────────────────────────────────
    ajusteMotorDesc:      "",
    transmisionDesc:      "",
    embragueClutch:       "",
    sistemaEnfriamiento:  "",

    // ── F) Proporciona Refacciones ────────────────────────
    refaccionPrestador:   false,
    refaccionConsumidor:  false,

    // ── Presupuesto ───────────────────────────────────────
    presupuestoItems: [{ descripcion: "", importe: "" }],

    // ── Totales / Aseguradora ─────────────────────────────
    aseguradora:    "",
    polizaSeguro:   "",
    otrosMateriales:"",
    subtotal:       "",
    ivaImporte:     "",
    totalImporte:   "",

    // ── Indicadores tablero ───────────────────────────────
    checkEngine: "",
    abs:         "",
    airBag:      "",
    frenos:      "",
    aceite:      "",
    alternador:  "",
    otros:       "",
    observaciones:"",
  });

  const [otrosIndicadoresActivo, setOtrosIndicadoresActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado,  setGuardado]  = useState(false);

  const isAdmin        = getUser()?.role === "admin";
  const [editandoAdmin, setEditandoAdmin] = useState(false);
  const efectivoReadOnly = readOnly && !(isAdmin && editandoAdmin);

  // ── Montar sin initialData ────────────────────────────
  useEffect(() => {
    if (!initialData) {
      setForm((prev) => ({
        ...prev,
        ordenServicio:  generateOrdenServicio(),
        fechaRecepcion: getTodayInputDate(),
        horaRecepcion:  getCurrentInputTime(),
      }));
    }
  }, [initialData]);

  // ── Precarga cliente ──────────────────────────────────
  useEffect(() => {
    if (!cliente) return;
    const tel = cliente.telefono || {};
    const cel = cliente.celular  || {};
    const dir = cliente.requiereFacturacion
      ? cliente.facturacion?.direccion || {}
      : cliente.direccion || {};
    const gob       = cliente.gobierno || {};
    const dep       = gob.dependencia  || {};
    const contactoGob = gob.contactoGobierno || {};
    const contactoDep = dep.contacto         || {};

    setForm((prev) => ({
      ...prev,
      ...(cliente.tipoCliente === "Particular"
        ? { nombreCliente: cliente.nombre || "", apellidoPaterno: cliente.apellidoPaterno || "", apellidoMaterno: cliente.apellidoMaterno || "", nombreGobierno: "", nombreContactoGobierno: "", nombreDependencia: "", nombreContactoDependencia: "" }
        : { nombreGobierno: gob.nombreGobierno || cliente.nombre || "", nombreContactoGobierno: cliente.apellidoPaterno || cliente.empresa?.contacto?.nombre || contactoGob.nombre || contactoDep.nombre || "", nombreDependencia: dep.nombre || "", nombreContactoDependencia: contactoDep.nombre || "", nombreCliente: "", apellidoPaterno: "", apellidoMaterno: "" }),
      telefonoFijoLada: tel.lada || "",
      telefonoFijo:     tel.numero || "",
      celularLada:      cel.lada || "",
      celular:          cel.numero || "",
      direccion:        dir.calle || "",
      numeroExt:        dir.numeroExterior || "",
      numeroInt:        dir.numeroInterior || "",
      colonia:          dir.colonia || "",
      codigoPostal:     dir.codigoPostal || "",
      ciudad:           dir.ciudad || "",
      estado:           dir.estado || "",
      rfc:              cliente.rfc || "",
      regimenFiscal:    cliente.facturacion?.regimenFiscal || "",
      usoCFDI:          cliente.facturacion?.usoCFDI || "",
      correos: Array.isArray(cliente.emails) && cliente.emails.length
        ? cliente.emails
        : [contactoGob.correo || contactoDep.correo || ""].filter(Boolean),
    }));
  }, [cliente]);

  // ── Precarga initialData (detalle/edición) ────────────
  useEffect(() => {
    if (!initialData) return;
    setForm((prev) => ({
      ...prev,
      ...initialData,
      fechaRecepcion: formatDateForInput(initialData.fechaRecepcion),
      horaRecepcion:  initialData.horaRecepcion || "",
      presupuestoItems: Array.isArray(initialData.presupuestoItems) && initialData.presupuestoItems.length
        ? initialData.presupuestoItems
        : [{ descripcion: "", importe: "" }],
    }));
  }, [initialData]);

  const handleChange = (e) => {
    if (efectivoReadOnly) return;
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // ── Submit ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (efectivoReadOnly || guardando || guardado) return;

    // Separar archivos pesados del payload principal
    const { fotosVehiculo, danoVehiculo, ...formDatos } = form;

    const payload = {
      ...formDatos,
      precioGrua: form.grua === "SI" ? Number(form.precioGrua || 0) : 0,
      correos:    form.correos || [],
      // Canvas comprimido como JPEG (mucho más liviano que PNG)
      danoVehiculo: danoVehiculo || null,
      // Fotos comprimidas individualmente
      fotosVehiculo: (fotosVehiculo || []).map((f) => ({
        id:   f.id,
        name: f.name,
        src:  f.src,   // ya viene comprimido por comprimirImagen()
      })),
    };

    // Verificar tamaño aproximado antes de enviar
    const payloadSize = new Blob([JSON.stringify(payload)]).size;
    console.log("Payload aprox:", (payloadSize / 1024 / 1024).toFixed(2), "MB");
    if (payloadSize > 18 * 1024 * 1024) {
      alert("El payload es demasiado grande (" + (payloadSize/1024/1024).toFixed(1) + " MB). Intenta con menos fotos.");
      setGuardando(false);
      return;
    }

    if (initialData?._id) {
      try {
        setGuardando(true);
        const res = await updateDatosOrden(initialData._id, payload);
        const v = res.data?.vehiculo || res.data;
        if (onCreated) onCreated(v);
        setEditandoAdmin(false);
        alert("Datos actualizados correctamente.");
      } catch (err) {
        alert(err?.response?.data?.msg || "Error al actualizar.");
      } finally { setGuardando(false); }
      return;
    }

    if (!cliente?._id) { alert("No hay cliente seleccionado."); return; }
    if (!form.ordenServicio.trim()) { alert("El número de Orden de Servicio es obligatorio."); return; }

    try {
      setGuardando(true);
      const res = await createVehiculo(cliente._id, payload);
      setGuardado(true);
      if (onCreated) onCreated(res.data?.vehiculo || res.data);
    } catch (err) {
      alert(err?.response?.data?.msg || "Error al guardar el vehículo.");
      setGuardando(false);
    }
  };

  // ── Helpers accesorios / indicadores ──────────────────
  const handleTodoOkAccesorios = () => {
    if (efectivoReadOnly) return;
    setForm((prev) => ({ ...prev, espejoLateralIzq:true, espejoLateralDer:true, copasDelanterasIzq:true, copasDelanterasDer:true, parabrisas:"BUENO", focosDel:true, focosTras:true, espejoInt:true, tapetesDelanterosIzq:true, tapetesDelanterosDer:true, estereo:true, extra:true, copasTraserasIzq:true, copasTraserasDer:true, micas:true, antena:true, encendedor:true, tapetesTraserosIzq:true, tapetesTraserosDer:true, gato:true, bateria:true, cristalesExt:true, limpiadoresExt:true, cristalesInt:true, limpiadoresInt:true, llaveRueda:true, extintor:true, llantaExtra:true, cablesCorrente:true, cruceta:true }));
  };
  const handleLimpiarAccesorios = () => {
    if (efectivoReadOnly) return;
    setForm((prev) => ({ ...prev, espejoLateralIzq:false, espejoLateralDer:false, copasDelanterasIzq:false, copasDelanterasDer:false, parabrisas:"", focosDel:false, focosTras:false, espejoInt:false, tapetesDelanterosIzq:false, tapetesDelanterosDer:false, estereo:false, extra:false, copasTraserasIzq:false, copasTraserasDer:false, micas:false, antena:false, encendedor:false, tapetesTraserosIzq:false, tapetesTraserosDer:false, gato:false, bateria:false, cristalesExt:false, limpiadoresExt:false, cristalesInt:false, limpiadoresInt:false, llaveRueda:false, extintor:false, llantaExtra:false, cablesCorrente:false, cruceta:false }));
  };
  const handleIndicadoresNo = () => {
    if (efectivoReadOnly) return;
    setForm((prev) => ({ ...prev, checkEngine:"NO", abs:"NO", airBag:"NO", frenos:"NO", aceite:"NO", alternador:"NO" }));
  };

  // ── Render helper ─────────────────────────────────────
  const SiNoSelect = ({ name, label, colClass = "col-md-4" }) => (
    <div className={colClass}>
      <label className="form-label">{label}</label>
      <select className="form-select" name={name} value={form[name]} onChange={handleChange} disabled={efectivoReadOnly}>
        <option value="">--</option>
        <option value="SI">SI</option>
        <option value="NO">NO</option>
      </select>
    </div>
  );

  // ────────────────────────────────────────────────────────
  return (
    <div className="card mt-3">
      <div className="card-header fw-bold">Datos del Cliente</div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>

          {/* ====== CABECERA ====== */}
          <div className="row g-2 mb-2">
            <div className="col-md-4">
              <label className="form-label">Orden de Servicio</label>
              <input type="text" className="form-control" name="ordenServicio" value={form.ordenServicio} onChange={handleChange} required />
            </div>
            <div className="col-md-4">
              <label className="form-label">Fecha Recepción</label>
              <input type="date" className="form-control" name="fechaRecepcion" value={form.fechaRecepcion} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Hora</label>
              <input type="time" className="form-control" name="horaRecepcion" value={form.horaRecepcion} onChange={handleChange} />
            </div>
          </div>

          {/* ====== COLUMNAS CLIENTE / VEHÍCULO ====== */}
          <div className="row">
            {/* ── COLUMNA IZQ: CLIENTE ── */}
            <div className="col-md-6">
              <div className="row g-2">
                {esParticular ? (
                  <>
                    <div className="col-12"><label className="form-label">Nombre Cliente</label><input type="text" className="form-control" name="nombreCliente" value={form.nombreCliente} onChange={handleChange} /></div>
                    <div className="col-12"><label className="form-label">Apellido Paterno</label><input type="text" className="form-control" name="apellidoPaterno" value={form.apellidoPaterno} onChange={handleChange} /></div>
                    <div className="col-12"><label className="form-label">Apellido Materno</label><input type="text" className="form-control" name="apellidoMaterno" value={form.apellidoMaterno} onChange={handleChange} /></div>
                  </>
                ) : cliente?.tipoCliente === "Empresa Privada" ? (
                  <>
                    <div className="col-12"><label className="form-label">Nombre Empresa</label><input type="text" className="form-control" name="nombreGobierno" value={form.nombreGobierno} onChange={handleChange} /></div>
                    <div className="col-12"><label className="form-label">Nombre Contacto Empresa</label><input type="text" className="form-control" name="nombreContactoGobierno" value={form.nombreContactoGobierno} onChange={handleChange} /></div>
                  </>
                ) : (
                  <>
                    <div className="col-12"><label className="form-label">Nombre Gobierno</label><input type="text" className="form-control" name="nombreGobierno" value={form.nombreGobierno} onChange={handleChange} /></div>
                    <div className="col-12"><label className="form-label">Nombre Contacto Gobierno</label><input type="text" className="form-control" name="nombreContactoGobierno" value={form.nombreContactoGobierno} onChange={handleChange} /></div>
                    <div className="col-12"><label className="form-label">Nombre Dependencia</label><input type="text" className="form-control" name="nombreDependencia" value={form.nombreDependencia} onChange={handleChange} /></div>
                    <div className="col-12"><label className="form-label">Nombre Contacto Dependencia</label><input type="text" className="form-control" name="nombreContactoDependencia" value={form.nombreContactoDependencia} onChange={handleChange} /></div>
                  </>
                )}

                {/* Teléfonos */}
                {!esParticular && (
                  <>
                    <div className="col-md-3"><label className="form-label">Tel. Fijo (LADA)</label><input type="text" className="form-control" name="telefonoFijoLada" value={form.telefonoFijoLada} onChange={handleChange} /></div>
                    <div className="col-md-9"><label className="form-label">&nbsp;</label><input type="text" className="form-control" name="telefonoFijo" value={form.telefonoFijo} onChange={handleChange} /></div>
                  </>
                )}
                <div className="col-md-3"><label className="form-label">Celular (LADA)</label><input type="text" className="form-control" name="celularLada" value={form.celularLada} onChange={handleChange} /></div>
                <div className="col-md-9"><label className="form-label">&nbsp;</label><input type="text" className="form-control" name="celular" value={form.celular} onChange={handleChange} /></div>

                {/* Dirección */}
                <div className="col-12"><label className="form-label">Dirección (Calle)</label><input type="text" className="form-control" name="direccion" value={form.direccion} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Número Ext</label><input type="text" className="form-control" name="numeroExt" value={form.numeroExt} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Número Int</label><input type="text" className="form-control" name="numeroInt" value={form.numeroInt} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Colonia</label><input type="text" className="form-control" name="colonia" value={form.colonia} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Código Postal</label><input type="text" className="form-control" name="codigoPostal" value={form.codigoPostal} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Ciudad</label><input type="text" className="form-control" name="ciudad" value={form.ciudad} onChange={handleChange} /></div>
                <div className="col-md-4"><label className="form-label">Estado</label><input type="text" className="form-control" name="estado" value={form.estado} onChange={handleChange} /></div>

                {/* Facturación */}
                {requiereFactura && (
                  <>
                    <div className="col-md-4"><label className="form-label">RFC</label><input type="text" className="form-control" name="rfc" value={form.rfc} onChange={handleChange} /></div>
                    <div className="col-md-4"><label className="form-label">Régimen Fiscal</label><input type="text" className="form-control" name="regimenFiscal" value={form.regimenFiscal} onChange={handleChange} /></div>
                    <div className="col-md-4"><label className="form-label">Uso CFDI</label><input type="text" className="form-control" name="usoCFDI" value={form.usoCFDI} onChange={handleChange} /></div>
                  </>
                )}

                {/* Forma / Método de Pago */}
                <div className="col-md-6">
                  <label className="form-label">Forma de Pago</label>
                  <select className="form-select" name="formaPago" value={form.formaPago} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">-- Seleccionar --</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Método de Pago</label>
                  <select className="form-select" name="metodoPago" value={form.metodoPago} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">-- Seleccionar --</option>
                    <option value="PUE">PUE - Pago en una sola exhibición</option>
                    <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                  </select>
                </div>

                {/* Grua */}
                <div className="col-12">
                  <label className="form-label">Grua</label>
                  <select className="form-select" name="grua" value={form.grua} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">Select an Option</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
                {form.grua === "SI" && (
                  <div className="col-12">
                    <label className="form-label">Precio de la grúa</label>
                    <input type="number" step="0.01" className="form-control" name="precioGrua" value={form.precioGrua} onChange={handleChange} placeholder="Ej. 800.00" />
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMNA DER: VEHÍCULO ── */}
            <div className="col-md-6">
              <div className="row g-2">
                <div className="col-12"><label className="form-label">Nombre Usuario Deja Vehículo</label><input type="text" className="form-control" name="nombreUsuarioDejaVehiculo" value={form.nombreUsuarioDejaVehiculo} onChange={handleChange} /></div>

                <div className="col-md-6"><label className="form-label">Marca</label><input type="text" className="form-control" name="marca" value={form.marca} onChange={handleChange} /></div>
                <div className="col-md-6"><label className="form-label">Modelo</label><input type="text" className="form-control" name="modelo" value={form.modelo} onChange={handleChange} /></div>

                <div className="col-md-3"><label className="form-label">Año</label><input type="text" className="form-control" name="anio" value={form.anio} onChange={handleChange} /></div>
                <div className="col-md-3"><label className="form-label">Color</label><input type="text" className="form-control" name="color" value={form.color} onChange={handleChange} /></div>
                <div className="col-md-3"><label className="form-label">Serie (VIN)</label><input type="text" className="form-control" name="serie" value={form.serie} onChange={handleChange} /></div>
                <div className="col-md-3"><label className="form-label">Puertas</label><input type="text" className="form-control" name="puertas" value={form.puertas} onChange={handleChange} placeholder="2 / 4" /></div>

                <div className="col-md-6"><label className="form-label">Placas</label><input type="text" className="form-control" name="placas" value={form.placas} onChange={handleChange} /></div>
                <div className="col-md-6"><label className="form-label">KMS/Millas</label><input type="text" className="form-control" name="kmsMillas" value={form.kmsMillas} onChange={handleChange} /></div>

                {/* Transmisión */}
                <div className="col-md-4">
                  <label className="form-label">Transmisión</label>
                  <select className="form-select" name="transmision" value={form.transmision} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">--</option>
                    <option value="STD">STD</option>
                    <option value="AUT">AUT</option>
                  </select>
                </div>

                {/* Cilindros */}
                <div className="col-md-4">
                  <label className="form-label">Cilindros</label>
                  <select className="form-select" name="cilindros" value={form.cilindros} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">--</option>
                    <option value="4">4</option>
                    <option value="6">6</option>
                    <option value="8">8</option>
                  </select>
                </div>

                {/* Combustión */}
                <div className="col-md-4">
                  <label className="form-label">Combustión</label>
                  <select className="form-select" name="combustion" value={form.combustion} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">--</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Híbrido">Híbrido</option>
                    <option value="Eléctrico">Eléctrico</option>
                  </select>
                </div>

                {/* Seguro Rines / Llaves */}
                <div className="col-md-6">
                  <label className="form-label">Seguro Rines</label>
                  <select className="form-select" name="seguroRines" value={form.seguroRines} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">--</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Llaves c/Control</label>
                  <select className="form-select" name="llavesControl" value={form.llavesControl} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">--</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>

                <div className="col-md-6"><label className="form-label">Nacionalidad</label><input type="text" className="form-control" name="nacionalidad" value={form.nacionalidad} onChange={handleChange} /></div>
                <div className="col-md-6"><label className="form-label">Motor</label><input type="text" className="form-control" name="motor" value={form.motor} onChange={handleChange} /></div>
                <div className="col-md-6"><label className="form-label">Número Económico</label><input type="text" className="form-control" name="numeroEconomico" value={form.numeroEconomico} onChange={handleChange} /></div>

                <div className="col-md-6">
                  <label className="form-label">Correo(s)</label>
                  {form.correos && form.correos.length > 0
                    ? form.correos.map((c, i) => <input key={i} type="email" className={`form-control${i>0?" mt-1":""}`} value={c} readOnly placeholder="Sin correo" />)
                    : <input type="email" className="form-control" value="" readOnly placeholder="Sin correo" />}
                </div>

                <div className="col-12">
                  <label className="form-label">Tracción</label>
                  <select className="form-select" name="traccion" value={form.traccion} onChange={handleChange} disabled={efectivoReadOnly}>
                    <option value="">Select an Option</option>
                    <option value="4x2">4x2</option>
                    <option value="4x4">4x4</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ====== ACCESORIOS ====== */}
          <hr className="my-3" />
          {!efectivoReadOnly && (
            <div className="d-flex justify-content-start align-items-center gap-3 mb-3">
              <p className="text-muted small mb-0 me-auto">Los elementos marcados indican que el vehículo cuenta con dichos accesorios al momento de la recepción.</p>
              <button type="button" className="btn btn-sm btn-success" onClick={handleTodoOkAccesorios}>Todo OK</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLimpiarAccesorios}>Limpiar accesorios</button>
            </div>
          )}
          <div className="row g-2">
            {/* Espejo / Copas / Focos / Interior */}
            <div className="col-md-3">
              <div className="row g-1">
                <div className="col-12 fw-semibold mb-1">Espejo / Copas / Focos / Interior</div>
                <div className="col-12"><label className="me-3">Espejo Lateral:</label><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="espejoLateralIzq" checked={form.espejoLateralIzq} onChange={handleChange} /><label className="form-check-label">IZQ</label></div><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="espejoLateralDer" checked={form.espejoLateralDer} onChange={handleChange} /><label className="form-check-label">DER</label></div></div>
                <div className="col-12"><label className="me-3">Copas Delanteras:</label><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="copasDelanterasIzq" checked={form.copasDelanterasIzq} onChange={handleChange} /><label className="form-check-label">IZQ</label></div><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="copasDelanterasDer" checked={form.copasDelanterasDer} onChange={handleChange} /><label className="form-check-label">DER</label></div></div>
                <div className="col-12"><label className="form-label me-2">Parabrisas</label><select className="form-select d-inline-block w-auto" name="parabrisas" value={form.parabrisas} onChange={handleChange} disabled={efectivoReadOnly}><option value="">Select an Option</option><option value="BUENO">Bueno</option><option value="MALO">Malo</option><option value="QUEBRADO">Quebrado</option></select></div>
                <div className="col-12"><label className="me-3">Focos:</label><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="focosDel" checked={form.focosDel} onChange={handleChange} /><label className="form-check-label">DEL.</label></div><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="focosTras" checked={form.focosTras} onChange={handleChange} /><label className="form-check-label">TRAS.</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="espejoInt" checked={form.espejoInt} onChange={handleChange} /><label className="form-check-label">Espejo Interior</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="cristalesExt" checked={form.cristalesExt} onChange={handleChange} /><label className="form-check-label">Cristales (Ext.)</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="limpiadoresExt" checked={form.limpiadoresExt} onChange={handleChange} /><label className="form-check-label">Limpiadores (Ext.)</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="cristalesInt" checked={form.cristalesInt} onChange={handleChange} /><label className="form-check-label">Cristales (Int.)</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="limpiadoresInt" checked={form.limpiadoresInt} onChange={handleChange} /><label className="form-check-label">Limpiadores (Int.)</label></div></div>
                <div className="col-12"><label className="me-3">Tapetes Delanteros:</label><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="tapetesDelanterosIzq" checked={form.tapetesDelanterosIzq} onChange={handleChange} /><label className="form-check-label">IZQ</label></div><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="tapetesDelanterosDer" checked={form.tapetesDelanterosDer} onChange={handleChange} /><label className="form-check-label">DER</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="estereo" checked={form.estereo} onChange={handleChange} /><label className="form-check-label">Estéreo</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="extra" checked={form.extra} onChange={handleChange} /><label className="form-check-label">Extra</label></div></div>
              </div>
            </div>

            {/* Copas Traseras / Tapetes / Otros */}
            <div className="col-md-3">
              <div className="row g-1">
                <div className="col-12 fw-semibold mb-1">Copas Traseras / Tapetes / Otros</div>
                <div className="col-12"><label className="me-3">Copas Traseras:</label><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="copasTraserasIzq" checked={form.copasTraserasIzq} onChange={handleChange} /><label className="form-check-label">IZQ</label></div><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="copasTraserasDer" checked={form.copasTraserasDer} onChange={handleChange} /><label className="form-check-label">DER</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="micas" checked={form.micas} onChange={handleChange} /><label className="form-check-label">Micas</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="antena" checked={form.antena} onChange={handleChange} /><label className="form-check-label">Antena</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="encendedor" checked={form.encendedor} onChange={handleChange} /><label className="form-check-label">Encendedor</label></div></div>
                <div className="col-12"><label className="me-3">Tapetes Traseros:</label><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="tapetesTraserosIzq" checked={form.tapetesTraserosIzq} onChange={handleChange} /><label className="form-check-label">IZQ</label></div><div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" name="tapetesTraserosDer" checked={form.tapetesTraserosDer} onChange={handleChange} /><label className="form-check-label">DER</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="gato" checked={form.gato} onChange={handleChange} /><label className="form-check-label">Gato</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="bateria" checked={form.bateria} onChange={handleChange} /><label className="form-check-label">Batería</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="llaveRueda" checked={form.llaveRueda} onChange={handleChange} /><label className="form-check-label">Llave de Rueda</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="extintor" checked={form.extintor} onChange={handleChange} /><label className="form-check-label">Extintor</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="llantaExtra" checked={form.llantaExtra} onChange={handleChange} /><label className="form-check-label">Llanta Extra</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="cablesCorrente" checked={form.cablesCorrente} onChange={handleChange} /><label className="form-check-label">Cables de Corriente</label></div></div>
                <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" name="cruceta" checked={form.cruceta} onChange={handleChange} /><label className="form-check-label">Cruceta</label></div></div>
              </div>
            </div>

            {/* Daños */}
            <div className="col-md-3">
              <div className="fw-semibold mb-1" style={{fontSize:"13px"}}>Daños del vehículo</div>
              <VehicleDamageCanvas
                  value={form.danoVehiculo}
                  onChange={(data) => setForm((prev) => ({ ...prev, danoVehiculo: data }))}
                  photos={form.fotosVehiculo || []}
                  onPhotosChange={(fotos) => setForm((prev) => ({ ...prev, fotosVehiculo: fotos }))}
                  readOnly={efectivoReadOnly}
                />
            </div>

            {/* Gasolina */}
            <div className="col-md-3">
              <div className="d-flex flex-column"><hr className="my-2" />
                <div className="d-flex flex-column align-items-center">
                  <div className="fw-semibold mb-1">Nivel de Gasolina</div>
                  <svg width="200" height="130" viewBox="0 0 200 130" style={{cursor: efectivoReadOnly?"default":"pointer"}}
                    onClick={(e) => {
                      if (efectivoReadOnly) return;
                      const rect=e.currentTarget.getBoundingClientRect();
                      const mx=(e.clientX-rect.left)*(200/rect.width), my=(e.clientY-rect.top)*(130/rect.height);
                      const dx=mx-100,dy=my-100;
                      let angle=Math.atan2(dy,dx); if(angle<0) angle+=2*Math.PI;
                      const S=210*Math.PI/180,En=330*Math.PI/180;
                      let pct=(angle-S)/(En-S); pct=Math.max(0,Math.min(1,pct));
                      const NV=[{pct:0,label:"E"},{pct:0.125,label:"1/8"},{pct:0.25,label:"1/4"},{pct:0.375,label:"3/8"},{pct:0.5,label:"1/2"},{pct:0.625,label:"5/8"},{pct:0.75,label:"3/4"},{pct:0.875,label:"7/8"},{pct:1,label:"F"}];
                      const cl=NV.reduce((a,b)=>Math.abs(b.pct-pct)<Math.abs(a.pct-pct)?b:a);
                      setForm((prev)=>({...prev,nivelGasolina:cl.label}));
                    }}>
                    {(()=>{
                      const CX=100,CY=100,R=70,SD=210,ED=330;
                      const NV=[{pct:0,label:"E"},{pct:0.125,label:"1/8"},{pct:0.25,label:"1/4"},{pct:0.375,label:"3/8"},{pct:0.5,label:"1/2"},{pct:0.625,label:"5/8"},{pct:0.75,label:"3/4"},{pct:0.875,label:"7/8"},{pct:1,label:"F"}];
                      const toR=d=>d*Math.PI/180,pA=p=>toR(SD+p*(ED-SD)),pXY=(p,r)=>{const a=pA(p);return{x:CX+r*Math.cos(a),y:CY+r*Math.sin(a)};};
                      const arc=(p0,p1,r)=>{const s=pXY(p0,r),e=pXY(p1,r),sp=(p1-p0)*toR(ED-SD);return`M ${s.x} ${s.y} A ${r} ${r} 0 ${sp>Math.PI?1:0} 1 ${e.x} ${e.y}`;};
                      const cn=NV.find(n=>n.label===form.nivelGasolina),cp=cn?cn.pct:null;
                      const nc=cp===null?"#888":cp<=0.25?"#E24B4A":cp<=0.5?"#BA7517":"#1D9E75";
                      const na=cp!==null?pA(cp):toR(210),nx=CX+58*Math.cos(na),ny=CY+58*Math.sin(na);
                      return(<>
                        <path d={arc(0,1,R)} fill="none" stroke="#ddd" strokeWidth="4" strokeLinecap="round"/>
                        {cp!==null&&cp>0&&<path d={arc(0,cp,R)} fill="none" stroke={nc} strokeWidth="4" strokeLinecap="round"/>}
                        {NV.map(n=>{const pos=pXY(n.pct,R),ia=form.nivelGasolina===n.label;return(<circle key={n.label} cx={pos.x} cy={pos.y} r={ia?5:3} fill={ia?nc:"#bbb"}/>);})}
                        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={nc} strokeWidth="2.5" strokeLinecap="round"/>
                        <circle cx={CX} cy={CY} r="5" fill={nc}/>
                        <text x="18" y="112" fontSize="12" fontWeight="500" fill="#888" textAnchor="middle">E</text>
                        <text x="182" y="112" fontSize="12" fontWeight="500" fill="#888" textAnchor="middle">F</text>
                      </>);
                    })()}
                  </svg>
                  <div className="mt-1 text-center">
                    {form.nivelGasolina ? <span className="badge bg-secondary fs-6 px-3">{form.nivelGasolina}</span> : <span className="text-muted small">Sin capturar</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ====== INDICADORES TABLERO ====== */}
          <hr className="my-3" />
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold mb-0">Indicadores del Tablero</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleIndicadoresNo}>Limpiar indicadores</button>
          </div>
          <p className="text-muted small mb-2">Marca únicamente los indicadores que se encuentren encendidos o presenten alerta.</p>
          <div className="row g-2">
            {[["checkEngine","Check Engine"],["abs","ABS"],["airBag","Air Bag"],["frenos","Frenos"],["aceite","Aceite"],["alternador","Alternador"]].map(([name,label]) => (
              <div className="col-md-4 col-sm-6" key={name}>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id={name} checked={form[name]==="SI"} onChange={(e) => setForm((prev) => ({ ...prev, [name]: e.target.checked?"SI":"NO" }))} disabled={efectivoReadOnly} />
                  <label className="form-check-label" htmlFor={name}>{label}</label>
                </div>
              </div>
            ))}
            <div className="col-12 mt-2">
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="otrosIndicadoresCheck" checked={otrosIndicadoresActivo} onChange={(e) => { setOtrosIndicadoresActivo(e.target.checked); if(!e.target.checked) setForm((prev)=>({...prev,otros:""})); }} disabled={efectivoReadOnly} />
                <label className="form-check-label" htmlFor="otrosIndicadoresCheck">Otros indicadores</label>
              </div>
              <input type="text" className="form-control" name="otros" placeholder="Especificar otros indicadores" value={form.otros} onChange={handleChange} disabled={!otrosIndicadoresActivo || efectivoReadOnly} />
            </div>
            <div className="col-12">
              <label className="form-label">Observaciones</label>
              <textarea className="form-control" rows={3} name="observaciones" value={form.observaciones} onChange={handleChange} disabled={efectivoReadOnly} />
            </div>
          </div>

          {/* ====== BOTONES ====== */}
          <div className="mt-3">
            {!readOnly && (
              <button type="submit" className="btn btn-success px-5" disabled={guardando||guardado}>
                {guardando?"Guardando...":guardado?"Guardado":"Guardar"}
              </button>
            )}
            {readOnly && isAdmin && !editandoAdmin && (
              <button type="button" className="btn btn-warning px-5" onClick={() => setEditandoAdmin(true)}>Editar</button>
            )}
            {readOnly && isAdmin && editandoAdmin && (
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success px-5" disabled={guardando}>{guardando?"Guardando...":"Guardar cambios"}</button>
                <button type="button" className="btn btn-secondary px-4" disabled={guardando} onClick={() => setEditandoAdmin(false)}>Cancelar</button>
              </div>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}