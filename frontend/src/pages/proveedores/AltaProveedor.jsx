// src/pages/proveedores/AltaProveedor.jsx
import React, { useEffect, useState } from "react";
import { createProveedor } from "../../api/providers";

export default function AltaProveedor() {
  useEffect(() => {
    console.log("AltaProveedor - MONTÓ");
    return () => console.log("AltaProveedor - DESMONTÓ");
  }, []);

  const [form, setForm] = useState({
    nombreProveedor: "", aliasProveedor: "", correo: "",
    telefonoLada: "", telefonoFijo: "", calle: "",
    numeroExterior: "", numeroInterior: "", colonia: "",
    rfc: "", codigoPostal: "", ciudad: "", estado: "",
    primerContacto: "", segundoContacto: "", tercerContacto: "",
    condicionesPago: "", diasCredito: "", observaciones: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (error) setError("");
  };

  const validate = () => {
    if (!form.nombreProveedor.trim()) return "El nombre del proveedor es obligatorio.";
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) return "Correo inválido.";
    if (form.diasCredito !== "" && Number(form.diasCredito) < 0) return "Días de crédito inválidos.";
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);

    try {
      setSaving(true);
      const payload = {
        ...form,
        rfc: form.rfc ? String(form.rfc).toUpperCase().trim() : "",
        correo: form.correo ? String(form.correo).toLowerCase().trim() : "",
      };
      const { data } = await createProveedor(payload);
      if (!data?.success) throw new Error(data?.message || "Error al guardar");
      alert(`Proveedor guardado: ${data.data?.nombreProveedor || ""}`);
      onClear();
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.message ||
        err.message;
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const onClear = () =>
    setForm({
      nombreProveedor: "", aliasProveedor: "", correo: "",
      telefonoLada: "", telefonoFijo: "", calle: "",
      numeroExterior: "", numeroInterior: "", colonia: "",
      rfc: "", codigoPostal: "", ciudad: "", estado: "",
      primerContacto: "", segundoContacto: "", tercerContacto: "",
      condicionesPago: "", diasCredito: "", observaciones: "",
    });

  const handleFormKeyDownCapture = (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  };

  return (
    <div className="container-fluid">
      <h2 className="text-center fw-bold my-3" style={{ letterSpacing: "2px" }}>
        ALTA PROVEEDORES
      </h2>

      <div className="card shadow-sm">
        <div className="card-body">
          <form onSubmit={onSubmit} autoComplete="off" onKeyDownCapture={handleFormKeyDownCapture}>
            {error && <div className="alert alert-danger py-2">{error}</div>}

            <div className="mb-2">
              <label htmlFor="nombreProveedor" className="form-label fw-semibold">
                Nombre del Proveedor: *
              </label>
              <input
                id="nombreProveedor"
                name="nombreProveedor"
                type="text"
                className="form-control"
                value={form.nombreProveedor}
                onChange={onChange}
                required
              />
            </div>

            <div className="mb-2">
              <label htmlFor="aliasProveedor" className="form-label fw-semibold">Alias Proveedor:</label>
              <input
                id="aliasProveedor"
                name="aliasProveedor"
                className="form-control"
                value={form.aliasProveedor}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="correo" className="form-label fw-semibold">Correo Electrónico:</label>
              <input
                id="correo"
                name="correo"
                type="email"
                className="form-control"
                value={form.correo}
                onChange={onChange}
                autoComplete="email"
              />
            </div>

            <div className="mb-2">
              <label className="form-label fw-semibold">Teléfono Fijo: LADA</label>
              <div className="d-flex gap-2">
                <input
                  id="telefonoLada"
                  name="telefonoLada"
                  className="form-control"
                  style={{ maxWidth: 120 }}
                  value={form.telefonoLada}
                  onChange={onChange}
                  placeholder="LADA"
                  autoComplete="tel-area-code"
                />
                <input
                  id="telefonoFijo"
                  name="telefonoFijo"
                  className="form-control"
                  value={form.telefonoFijo}
                  onChange={onChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="mb-2">
              <label htmlFor="calle" className="form-label fw-semibold">Dirección (Calle):</label>
              <input
                id="calle"
                name="calle"
                className="form-control"
                value={form.calle}
                onChange={onChange}
                autoComplete="address-line1"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="numeroExterior" className="form-label fw-semibold">Número Exterior:</label>
              <input
                id="numeroExterior"
                name="numeroExterior"
                className="form-control"
                value={form.numeroExterior}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="numeroInterior" className="form-label fw-semibold">Número Interior:</label>
              <input
                id="numeroInterior"
                name="numeroInterior"
                className="form-control"
                value={form.numeroInterior}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="colonia" className="form-label fw-semibold">Colonia:</label>
              <input
                id="colonia"
                name="colonia"
                className="form-control"
                value={form.colonia}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="rfc" className="form-label fw-semibold">RFC:</label>
              <input
                id="rfc"
                name="rfc"
                className="form-control"
                value={form.rfc}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="codigoPostal" className="form-label fw-semibold">Código Postal:</label>
              <input
                id="codigoPostal"
                name="codigoPostal"
                className="form-control"
                value={form.codigoPostal}
                onChange={onChange}
                autoComplete="postal-code"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="ciudad" className="form-label fw-semibold">Ciudad:</label>
              <input
                id="ciudad"
                name="ciudad"
                className="form-control"
                value={form.ciudad}
                onChange={onChange}
                autoComplete="address-level2"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="estado" className="form-label fw-semibold">Estado:</label>
              <input
                id="estado"
                name="estado"
                className="form-control"
                value={form.estado}
                onChange={onChange}
                autoComplete="address-level1"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="primerContacto" className="form-label fw-semibold">Primer Contacto:</label>
              <input
                id="primerContacto"
                name="primerContacto"
                className="form-control"
                value={form.primerContacto}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="segundoContacto" className="form-label fw-semibold">Segundo Contacto:</label>
              <input
                id="segundoContacto"
                name="segundoContacto"
                className="form-control"
                value={form.segundoContacto}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="tercerContacto" className="form-label fw-semibold">Tercer Contacto:</label>
              <input
                id="tercerContacto"
                name="tercerContacto"
                className="form-control"
                value={form.tercerContacto}
                onChange={onChange}
              />
            </div>

            <div className="mb-2">
              <label htmlFor="condicionesPago" className="form-label fw-semibold">Condiciones de Pago:</label>
              <select
                id="condicionesPago"
                name="condicionesPago"
                className="form-select"
                value={form.condicionesPago}
                onChange={onChange}
              >
                <option value="">Selecciona...</option>
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>

            <div className="mb-2">
              <label htmlFor="diasCredito" className="form-label fw-semibold">Días de Crédito:</label>
              <input
                id="diasCredito"
                name="diasCredito"
                type="number"
                min="0"
                className="form-control"
                value={form.diasCredito}
                onChange={onChange}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="observaciones" className="form-label fw-semibold">
                Observaciones (Días de Pago, Formas de Pago Especial, C/R, Etc.):
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                className="form-control"
                rows={3}
                value={form.observaciones}
                onChange={onChange}
              />
            </div>

            <div className="d-flex gap-2 justify-content-center mt-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClear} disabled={saving}>
                Limpiar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
