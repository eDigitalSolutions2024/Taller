// src/pages/clientes/AltaCliente.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createCustomer, getCustomer, updateCustomer } from "../../api/customers";
import "../../styles/clientes.css";

const CLIENT_TYPES = [
  "Particular",
  "Empresa Privada",
  "Empresa Arrendadora",
  "Empresa Gobierno",
];

function TelefonoList({ label, valores, onChange }) {
  const lista = valores?.length ? valores : [{ lada: "", numero: "" }];
  const handleChange = (i, field, value) => {
    const arr = [...lista];
    arr[i] = { ...arr[i], [field]: value };
    onChange(arr);
  };
  const handleAdd = () => onChange([...lista, { lada: "", numero: "" }]);
  const handleRemove = (i) => onChange(lista.filter((_, idx) => idx !== i));

  return (
    <div className="form-row col-12">
      <label>{label}</label>
      {lista.map((tel, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
          <input placeholder="LADA" value={tel.lada ?? ""} onChange={(e) => handleChange(i, "lada", e.target.value)} style={{ width: 80 }} />
          <input placeholder="Número" value={tel.numero ?? ""} onChange={(e) => handleChange(i, "numero", e.target.value)} style={{ flex: 1 }} />
          {i === 0 ? (
            <span style={{ fontSize: 12, color: "#0d6efd", whiteSpace: "nowrap" }}>Principal</span>
          ) : (
            <button type="button" onClick={() => handleRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}>✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={handleAdd} style={{ fontSize: 13, background: "none", border: "1px dashed #aaa", borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginTop: 2 }}>
        + Agregar {label.toLowerCase()}
      </button>
    </div>
  );
}

function EmailList({ valores, onChange }) {
  const lista = valores?.length ? valores : [""];
  const handleChange = (i, value) => {
    const arr = [...lista];
    arr[i] = value;
    onChange(arr);
  };
  const handleAdd = () => onChange([...lista, ""]);
  const handleRemove = (i) => onChange(lista.filter((_, idx) => idx !== i));

  return (
    <div className="form-row col-12">
      <label>Correo Electrónico</label>
      {lista.map((mail, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
          <input type="email" value={mail ?? ""} onChange={(e) => handleChange(i, e.target.value)} style={{ flex: 1 }} />
          {i === 0 ? (
            <span style={{ fontSize: 12, color: "#0d6efd", whiteSpace: "nowrap" }}>Principal</span>
          ) : (
            <button type="button" onClick={() => handleRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}>✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={handleAdd} style={{ fontSize: 13, background: "none", border: "1px dashed #aaa", borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginTop: 2 }}>
        + Agregar correo
      </button>
    </div>
  );
}

// deep clone simple
const deepClone = (o) => JSON.parse(JSON.stringify(o));

// setIn: actualiza rutas anidadas inmutablemente y crea ramas si faltan
function setIn(obj, path, value) {
  const keys = path.split(".");
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] =
      next && typeof next === "object"
        ? Array.isArray(next)
          ? [...next]
          : { ...next }
        : {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}

const initial = {
  tipoCliente: "Particular",

  // COMUNES
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  email: "",
  telefono: { lada: "", numero: "", extension: "" },
  celular: { lada: "", numero: "" },
  emails: [""],
  telefonos: [{ lada: "", numero: "" }],
  celulares: [{ lada: "", numero: "" }],
  pais: "México",
  requiereFacturacion: false,
  rfc: "",
  regimenFiscal: "",
  codigoPostalFiscal: "",
  direccion: {
    calle: "",
    numeroExterior: "",
    numeroInterior: "",
    colonia: "",
    codigoPostal: "",
    ciudad: "",
    estado: "",
  },
  facturacion: {
    direccion: {
      calle: "",
      numeroExterior: "",
      numeroInterior: "",
      colonia: "",
      codigoPostal: "",
      ciudad: "",
      estado: "",
    },
  },
  observaciones: "",

  // EMPRESA (Privada/Arrendadora)
  empresa: {
    contacto: {
      nombre: "",
      correo: "",
      telefono: { lada: "", numero: "", extension: "" },
      celular: { lada: "", numero: "" },
      departamento: "",
      puesto: "",
    },
  },

  // GOBIERNO
  gobierno: {
    nombreGobierno: "",
    contactoGobierno: {
      nombre: "",
      correo: "",
      telefono: { lada: "", numero: "", extension: "" },
      celular: { lada: "", numero: "" },
      departamento: "",
      puesto: "",
    },
    dependencia: {
      nombre: "",
      contacto: {
        nombre: "",
        correo: "",
        telefono: { lada: "", numero: "", extension: "" },
        celular: { lada: "", numero: "" },
        departamento: "",
        puesto: "",
      },
    },
  },
};

export default function AltaCliente({ modoModal = false, nombreInicial = "", onClienteCreado }) {
  const params = useParams();
  // En modo modal (alta rápida desde Nueva Orden) nunca se edita un cliente
  // existente, aunque la URL de fondo traiga un :id.
  const id = modoModal ? undefined : params.id;
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  const upd = (path, v) => setForm((prev) => setIn(prev, path, v));

  function normalizeForType(prev, tipo) {
    const next = { ...prev, tipoCliente: tipo };

    if (tipo === "Particular") {
      delete next.empresa;
      delete next.gobierno;
    }
    if (tipo === "Empresa Privada" || tipo === "Empresa Arrendadora") {
      next.empresa = next.empresa || deepClone(initial.empresa);
      delete next.gobierno;
    }
    if (tipo === "Empresa Gobierno") {
      next.gobierno = next.gobierno || deepClone(initial.gobierno);
      delete next.empresa;
    }
    return next;
  }

  const onTipoChange = (e) => {
    const tipo = e.target.value;
    setForm((prev) => normalizeForType(prev, tipo));
  };

  // En modo modal, precargar el nombre que el usuario ya estaba buscando
  useEffect(() => {
    if (modoModal && nombreInicial) {
      setForm((prev) => ({ ...prev, nombre: nombreInicial }));
    }
  }, [modoModal, nombreInicial]);

  // Cargar datos cuando es edición
  useEffect(() => {
    if (!isEdit) return;

    const fetchCustomer = async () => {
      try {
        setLoadingData(true);
        setMsg("");
        const { data } = await getCustomer(id);
        if (!data?.data) throw new Error(data?.error || "Error al cargar cliente");

        const c = data.data;

        // Mezclamos sobre el initial para no perder ramas
        const merged = {
          ...initial,
          ...c,
          telefono: { ...initial.telefono, ...(c.telefono || {}) },
          celular: { ...initial.celular, ...(c.celular || {}) },
          // Migra campos singulares viejos a lista si el cliente aún no tiene
          // arrays capturados (no se pierde el dato al editar un registro previo).
          emails: c.emails?.length ? c.emails : (c.email ? [c.email] : [""]),
          telefonos: c.telefonos?.length ? c.telefonos : (c.telefono?.numero ? [c.telefono] : [{ lada: "", numero: "" }]),
          celulares: c.celulares?.length ? c.celulares : (c.celular?.numero ? [c.celular] : [{ lada: "", numero: "" }]),
          requiereFacturacion: c.requiereFacturacion ?? !!c.rfc,
          pais: c.pais || "México",
          direccion: { ...initial.direccion, ...(c.direccion || {}) },
          facturacion: {
            ...initial.facturacion,
            ...(c.facturacion || {}),
            direccion: {
              ...initial.facturacion.direccion,
              ...(c.facturacion?.direccion || {}),
            },
          },
          empresa: {
            ...initial.empresa,
            ...(c.empresa || {}),
            contacto: {
              ...initial.empresa.contacto,
              ...(c.empresa?.contacto || {}),
              telefono: {
                ...initial.empresa.contacto.telefono,
                ...(c.empresa?.contacto?.telefono || {}),
              },
              celular: {
                ...initial.empresa.contacto.celular,
                ...(c.empresa?.contacto?.celular || {}),
              },
            },
          },
          gobierno: {
            ...initial.gobierno,
            ...(c.gobierno || {}),
            contactoGobierno: {
              ...initial.gobierno.contactoGobierno,
              ...(c.gobierno?.contactoGobierno || {}),
              telefono: {
                ...initial.gobierno.contactoGobierno.telefono,
                ...(c.gobierno?.contactoGobierno?.telefono || {}),
              },
              celular: {
                ...initial.gobierno.contactoGobierno.celular,
                ...(c.gobierno?.contactoGobierno?.celular || {}),
              },
            },
            dependencia: {
              ...initial.gobierno.dependencia,
              ...(c.gobierno?.dependencia || {}),
              contacto: {
                ...initial.gobierno.dependencia.contacto,
                ...(c.gobierno?.dependencia?.contacto || {}),
                telefono: {
                  ...initial.gobierno.dependencia.contacto.telefono,
                  ...(c.gobierno?.dependencia?.contacto?.telefono || {}),
                },
                celular: {
                  ...initial.gobierno.dependencia.contacto.celular,
                  ...(c.gobierno?.dependencia?.contacto?.celular || {}),
                },
              },
            },
          },
        };

        const finalForm = normalizeForType(
          merged,
          merged.tipoCliente || "Particular"
        );

        setForm(finalForm);
      } catch (err) {
        setMsg("❌ " + (err?.response?.data?.error || err.message));
      } finally {
        setLoadingData(false);
      }
    };

    fetchCustomer();
  }, [id, isEdit]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      let payload = deepClone(form);
      // Si no teclearon CP fiscal, úsalo desde la dirección de facturación
if (!payload.codigoPostalFiscal && payload.facturacion?.direccion?.codigoPostal) {
  payload.codigoPostalFiscal = payload.facturacion.direccion.codigoPostal;
}
          // 👉 Por ahora usamos SOLO la dirección de facturación
    // y la guardamos en cliente.direccion
    if (payload.facturacion && payload.facturacion.direccion) {
      payload.direccion = deepClone(payload.facturacion.direccion);
    }

    // Opcional: si no quieres guardar nada de facturación aún
    delete payload.facturacion;


      // Limpia ramas que no aplican
      if (payload.tipoCliente === "Particular") {
        delete payload.empresa;
        delete payload.gobierno;
      }
      if (
        payload.tipoCliente === "Empresa Privada" ||
        payload.tipoCliente === "Empresa Arrendadora"
      ) {
        delete payload.gobierno;
      }
      if (payload.tipoCliente === "Empresa Gobierno") {
        delete payload.empresa;
      }

      // Adaptar campos singulares del formulario al modelo con arrays
      if (payload.telefono) {
        payload.telefonos = [payload.telefono];
        delete payload.telefono;
      }
      if (payload.celular) {
        payload.celulares = [payload.celular];
        delete payload.celular;
      }
      if (payload.email !== undefined) {
        payload.emails = [payload.email].filter(Boolean);
        delete payload.email;
      }

      if (isEdit) {
        await updateCustomer(id, payload);
        setMsg("✅ Cliente actualizado correctamente.");
      } else {
        const res = await createCustomer(payload);
        setMsg("✅ Cliente creado correctamente.");
        setForm(initial);
        if (modoModal && onClienteCreado) {
          onClienteCreado(res.data?.data || res.data); // avisa al padre y cierra el modal
          return;
        }
      }

      if (!modoModal) navigate("/clientes/consulta");
    } catch (err) {
      setMsg("❌ " + (err?.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="form-card">
        <p>Cargando datos del cliente...</p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h2>{isEdit ? "Editar Cliente" : "Alta de Clientes"}</h2>

      {/* Tipo */}
      <div className="form-grid">
        <div className="form-row">
          <label>Tipo de Cliente</label>
          <select value={form.tipoCliente} onChange={onTipoChange}>
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== Campos comunes / por tipo ===== */}
      {/* Particular */}
      {form.tipoCliente === "Particular" && (
        <div className="form-grid">
          <div className="form-row">
            <label>Nombre</label>
            <input
              value={form.nombre ?? ""}
              onChange={(e) => upd("nombre", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Apellido Paterno</label>
            <input
              value={form.apellidoPaterno ?? ""}
              onChange={(e) => upd("apellidoPaterno", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Apellido Materno</label>
            <input
              value={form.apellidoMaterno ?? ""}
              onChange={(e) => upd("apellidoMaterno", e.target.value)}
            />
          </div>
          <EmailList valores={form.emails} onChange={(arr) => upd("emails", arr)} />
          <TelefonoList label="Teléfonos" valores={form.telefonos} onChange={(arr) => upd("telefonos", arr)} />
          <TelefonoList label="Celulares" valores={form.celulares} onChange={(arr) => upd("celulares", arr)} />

          <div className="form-row">
            <label>País</label>
            <input value={form.pais ?? ""} onChange={(e) => upd("pais", e.target.value)} />
          </div>
        </div>
      )}

      {/* Empresa Privada */}
      {form.tipoCliente === "Empresa Privada" && (
        <>
          <div className="form-grid">
            <div className="form-row">
              <label>Nombre Empresa</label>
              <input
                value={form.nombre ?? ""}
                onChange={(e) => upd("nombre", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Nombre Contacto Empresa</label>
              <input
                value={form.apellidoPaterno ?? ""}
                onChange={(e) => upd("apellidoPaterno", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Correo Electrónico</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => upd("email", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Teléfono Fijo</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={form.telefono?.lada ?? ""}
                  onChange={(e) => upd("telefono.lada", e.target.value)}
                />
                <input
                  placeholder="Número"
                  value={form.telefono?.numero ?? ""}
                  onChange={(e) => upd("telefono.numero", e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label>Celular</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={form.celular?.lada ?? ""}
                  onChange={(e) => upd("celular.lada", e.target.value)}
                />
                <input
                  placeholder="Número"
                  value={form.celular?.numero ?? ""}
                  onChange={(e) => upd("celular.numero", e.target.value)}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empresa Arrendadora */}
      {form.tipoCliente === "Empresa Arrendadora" && (
        <>
          <div className="form-grid">
            <div className="form-row">
              <label>Nombre Arrendadora</label>
              <input
                value={form.nombre ?? ""}
                onChange={(e) => upd("nombre", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Nombre Contacto Arrendadora</label>
              <input
                value={form.apellidoPaterno ?? ""}
                onChange={(e) => upd("apellidoPaterno", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Correo Electrónico</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => upd("email", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Teléfono Fijo</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={form.telefono?.lada ?? ""}
                  onChange={(e) => upd("telefono.lada", e.target.value)}
                />
                <input
                  placeholder="Número"
                  value={form.telefono?.numero ?? ""}
                  onChange={(e) => upd("telefono.numero", e.target.value)}
                />
              </div>
              <input
                placeholder="Extensión"
                value={form.empresa?.contacto?.telefono?.extension ?? ""}
                onChange={(e) =>
                  upd("empresa.contacto.telefono.extension", e.target.value)
                }
              />
            </div>

            <div className="form-row">
              <label>Celular</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={form.celular?.lada ?? ""}
                  onChange={(e) => upd("celular.lada", e.target.value)}
                />
                <input
                  placeholder="Número"
                  value={form.celular?.numero ?? ""}
                  onChange={(e) => upd("celular.numero", e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label>Departamento</label>
              <input
                value={form.empresa?.contacto?.departamento ?? ""}
                onChange={(e) =>
                  upd("empresa.contacto.departamento", e.target.value)
                }
              />
            </div>

            <div className="form-row">
              <label>Puesto</label>
              <input
                value={form.empresa?.contacto?.puesto ?? ""}
                onChange={(e) =>
                  upd("empresa.contacto.puesto", e.target.value)
                }
              />
            </div>
          </div>
        </>
      )}

      {/* Gobierno */}
      {form.tipoCliente === "Empresa Gobierno" && (
        <>
          <h3>Gobierno</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Nombre Gobierno</label>
              <input
                value={form.gobierno?.nombreGobierno ?? ""}
                onChange={(e) =>
                  upd("gobierno.nombreGobierno", e.target.value)
                }
              />
            </div>

            <div className="form-row">
              <label>Contacto Gobierno (Nombre)</label>
              <input
                value={form.gobierno?.contactoGobierno?.nombre ?? ""}
                onChange={(e) =>
                  upd("gobierno.contactoGobierno.nombre", e.target.value)
                }
              />
            </div>
            <div className="form-row">
              <label>Correo Electrónico</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => upd("email", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Celular</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={form.celular?.lada ?? ""}
                  onChange={(e) => upd("celular.lada", e.target.value)}
                />
                <input
                  placeholder="Número"
                  value={form.celular?.numero ?? ""}
                  onChange={(e) => upd("celular.numero", e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label>Teléfono Gobierno (LADA /Número/Ext.)</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={
                    form.gobierno?.contactoGobierno?.telefono?.lada ?? ""
                  }
                  onChange={(e) =>
                    upd(
                      "gobierno.contactoGobierno.telefono.lada",
                      e.target.value
                    )
                  }
                />
                <input
                  placeholder="Número"
                  value={
                    form.gobierno?.contactoGobierno?.telefono?.numero ?? ""
                  }
                  onChange={(e) =>
                    upd(
                      "gobierno.contactoGobierno.telefono.numero",
                      e.target.value
                    )
                  }
                />
              </div>
              <input
                placeholder="Extensión"
                value={
                  form.gobierno?.contactoGobierno?.telefono?.extension ?? ""
                }
                onChange={(e) =>
                  upd(
                    "gobierno.contactoGobierno.telefono.extension",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="form-row">
              <label>Departamento</label>
              <input
                value={
                  form.gobierno?.contactoGobierno?.departamento ?? ""
                }
                onChange={(e) =>
                  upd(
                    "gobierno.contactoGobierno.departamento",
                    e.target.value
                  )
                }
              />
            </div>
            <div className="form-row">
              <label>Puesto</label>
              <input
                value={form.gobierno?.contactoGobierno?.puesto ?? ""}
                onChange={(e) =>
                  upd("gobierno.contactoGobierno.puesto", e.target.value)
                }
              />
            </div>
          </div>

          <h3>Dependencia</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Nombre Dependencia</label>
              <input
                value={form.gobierno?.dependencia?.nombre ?? ""}
                onChange={(e) =>
                  upd("gobierno.dependencia.nombre", e.target.value)
                }
              />
            </div>
            <div className="form-row">
              <label>Contacto Dependencia (Nombre)</label>
              <input
                value={form.gobierno?.dependencia?.contacto?.nombre ?? ""}
                onChange={(e) =>
                  upd(
                    "gobierno.dependencia.contacto.nombre",
                    e.target.value
                  )
                }
              />
            </div>
            <div className="form-row">
              <label>Correo Electronico(Correo)</label>
              <input
                value={form.gobierno?.dependencia?.contacto?.correo ?? ""}
                onChange={(e) =>
                  upd(
                    "gobierno.dependencia.contacto.correo",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="form-row">
              <label>Teléfono Dependencia (LADA/Número/Ext.)</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={
                    form.gobierno?.dependencia?.contacto?.telefono?.lada ??
                    ""
                  }
                  onChange={(e) =>
                    upd(
                      "gobierno.dependencia.contacto.telefono.lada",
                      e.target.value
                    )
                  }
                />
                <input
                  placeholder="Número"
                  value={
                    form.gobierno?.dependencia?.contacto?.telefono
                      ?.numero ?? ""
                  }
                  onChange={(e) =>
                    upd(
                      "gobierno.dependencia.contacto.telefono.numero",
                      e.target.value
                    )
                  }
                />
              </div>
              <input
                placeholder="Extensión"
                value={
                  form.gobierno?.dependencia?.contacto?.telefono
                    ?.extension ?? ""
                }
                onChange={(e) =>
                  upd(
                    "gobierno.dependencia.contacto.telefono.extension",
                    e.target.value
                  )
                }
              />
            </div>
            <div className="form-row">
              <label>Celular</label>
              <div className="phone-inline">
                <input
                  placeholder="LADA"
                  value={form.celular?.lada ?? ""}
                  onChange={(e) => upd("celular.lada", e.target.value)}
                />
                <input
                  placeholder="Número"
                  value={form.celular?.numero ?? ""}
                  onChange={(e) => upd("celular.numero", e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label>Departamento</label>
              <input
                value={
                  form.gobierno?.dependencia?.contacto?.departamento ??
                  ""
                }
                onChange={(e) =>
                  upd(
                    "gobierno.dependencia.contacto.departamento",
                    e.target.value
                  )
                }
              />
            </div>
            <div className="form-row">
              <label>Puesto</label>
              <input
                value={
                  form.gobierno?.dependencia?.contacto?.puesto ?? ""
                }
                onChange={(e) =>
                  upd(
                    "gobierno.dependencia.contacto.puesto",
                    e.target.value
                  )
                }
              />
            </div>
          </div>
        </>
      )}

      {/* ===== Facturación ===== */}
      <h3>Datos de Facturación</h3>
      <div className="form-grid">
        <div className="form-row col-12">
          <label>
            <input
              type="checkbox"
              checked={!!form.requiereFacturacion}
              onChange={(e) => upd("requiereFacturacion", e.target.checked)}
              style={{ marginRight: 6 }}
            />
            ¿El cliente requiere facturación?
          </label>
        </div>
      </div>

      {form.requiereFacturacion && (
      <div className="form-grid">
        <div className="form-row">
          <label>RFC</label>
          <input
            value={form.rfc ?? ""}
            onChange={(e) => upd("rfc", e.target.value.toUpperCase())}
          />
        </div>
        <div className="form-row">
          <label>Régimen Fiscal</label>
          <select
            value={form.regimenFiscal ?? ""}
            onChange={(e) => upd("regimenFiscal", e.target.value)}
          >
            <option value="">-- Seleccionar --</option>
            <option value="601">601 - General de Ley Personas Morales</option>
            <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
            <option value="605">605 - Sueldos y Salarios e Ingresos Asimilados a Salarios</option>
            <option value="606">606 - Arrendamiento</option>
            <option value="607">607 - Régimen de Enajenación o Adquisición de Bienes</option>
            <option value="608">608 - Demás ingresos</option>
            <option value="610">610 - Residentes en el Extranjero sin Establecimiento Permanente</option>
            <option value="611">611 - Ingresos por Dividendos (socios y accionistas)</option>
            <option value="612">612 - Personas Físicas con Actividades Empresariales y Profesionales</option>
            <option value="614">614 - Ingresos por intereses</option>
            <option value="615">615 - Régimen de los ingresos por obtención de premios</option>
            <option value="616">616 - Sin obligaciones fiscales</option>
            <option value="620">620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos</option>
            <option value="621">621 - Incorporación Fiscal</option>
            <option value="622">622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras</option>
            <option value="623">623 - Opcional para Grupos de Sociedades</option>
            <option value="624">624 - Coordinados</option>
            <option value="625">625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas</option>
            <option value="626">626 - Régimen Simplificado de Confianza</option>
          </select>
        </div>

        <div className="form-row">
          <label>Dirección (Calle)</label>
          <input
            value={form.facturacion?.direccion?.calle ?? ""}
            onChange={(e) =>
              upd("facturacion.direccion.calle", e.target.value)
            }
          />
        </div>
        <div className="form-row">
          <label>Número Exterior</label>
          <input
            value={form.facturacion?.direccion?.numeroExterior ?? ""}
            onChange={(e) =>
              upd("facturacion.direccion.numeroExterior", e.target.value)
            }
          />
        </div>
        <div className="form-row">
          <label>Número Interior</label>
          <input
            value={form.facturacion?.direccion?.numeroInterior ?? ""}
            onChange={(e) =>
              upd("facturacion.direccion.numeroInterior", e.target.value)
            }
          />
        </div>
        <div className="form-row">
          <label>Colonia</label>
          <input
            value={form.facturacion?.direccion?.colonia ?? ""}
            onChange={(e) =>
              upd("facturacion.direccion.colonia", e.target.value)
            }
          />
        </div>
        <div className="form-row">
          <label>Código Postal Fiscal</label>
          <input
            value={form.codigoPostalFiscal ?? ""}
            onChange={(e) => upd("codigoPostalFiscal", e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Ciudad</label>
          <input
            value={form.facturacion?.direccion?.ciudad ?? ""}
            onChange={(e) =>
              upd("facturacion.direccion.ciudad", e.target.value)
            }
          />
        </div>
        <div className="form-row">
          <label>Estado</label>
          <input
            value={form.facturacion?.direccion?.estado ?? ""}
            onChange={(e) =>
              upd("facturacion.direccion.estado", e.target.value)
            }
          />
        </div>
      </div>
      )}

      <div className="form-grid">
        <div className="form-row col-12">
          <label>Observaciones</label>
          <textarea
            rows={3}
            value={form.observaciones ?? ""}
            onChange={(e) => upd("observaciones", e.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar"}
        </button>
        {!isEdit && (
          <button
            type="reset"
            className="btn btn-light"
            onClick={() => setForm(initial)}
            disabled={saving}
          >
            Limpiar
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/clientes/consulta")}
          disabled={saving}
        >
          Regresar
        </button>
      </div>

      {msg && <div className="form-msg">{msg}</div>}
    </form>
  );
}
