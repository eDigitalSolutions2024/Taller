import { useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000/api";
const PAGE_SIZES = [10, 25, 50, 100];

export default function BDCodigos() {
  const [form, setForm] = useState({
    _id: "",
    numeroParte: "",
    descripcion: "",
    marca: "",
  });

  const [options, setOptions] = useState([]);  // para "Seleccionar Refacción"
  const [refSel, setRefSel] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "numeroParte", dir: "asc" });

  // Cargar options del select y tabla
  useEffect(() => {
    (async () => {
      try {
        const [o, t] = await Promise.all([
          fetch(`${API}/codigos/options`, { credentials: "include" }).then(r=>r.json()).catch(()=>({})),
          fetch(`${API}/codigos`, { credentials: "include" }).then(r=>r.json()).catch(()=>({})),
        ]);

        setOptions(o?.data || []);
        const data = (t?.data || t || []).map(x => ({
          _id: x._id || x.id,
          numeroParte: x.numeroParte || "",
          marca: x.marca || "",
          descripcion: x.descripcion || "",
        }));
        setItems(data);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let arr = !q
      ? items
      : items.filter(x =>
          (x.numeroParte || "").toLowerCase().includes(q) ||
          (x.descripcion || "").toLowerCase().includes(q) ||
          (x.marca || "").toLowerCase().includes(q)
        );
    arr.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av = String(a[sort.key] || "").toLowerCase();
      const bv = String(b[sort.key] || "").toLowerCase();
      return av.localeCompare(bv) * dir;
    });
    return arr;
  }, [items, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageData = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize]);

  function changeSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir:"asc" });
  }

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  async function guardar() {
    try {
      setLoading(true);
      const payload = {
        numeroParte: form.numeroParte.trim(),
        descripcion: form.descripcion.trim(),
        marca: form.marca.trim(),
      };
      if (!payload.numeroParte) throw new Error("Número de parte es obligatorio.");

      const method = form._id ? "PUT" : "POST";
      const url = form._id ? `${API}/codigos/${form._id}` : `${API}/codigos`;

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "No se pudo guardar");

      await recargarTabla();
      await recargarOptions();
      limpiar();
    } catch (e) {
      alert(e.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function recargarTabla() {
    const t = await fetch(`${API}/codigos`, { credentials: "include" }).then(r=>r.json()).catch(()=>({}));
    const data = (t?.data || t || []).map(x => ({
      _id: x._id || x.id,
      numeroParte: x.numeroParte || "",
      marca: x.marca || "",
      descripcion: x.descripcion || "",
    }));
    setItems(data);
  }

  async function recargarOptions() {
    const o = await fetch(`${API}/codigos/options`, { credentials: "include" }).then(r=>r.json()).catch(()=>({}));
    setOptions(o?.data || []);
  }

  function limpiar() {
    setForm({ _id: "", numeroParte: "", descripcion: "", marca: "" });
  }

  async function buscarSeleccion() {
    if (!refSel) return;
    const r = await fetch(`${API}/codigos/${refSel}`, { credentials: "include" });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) return alert(j?.message || "No encontrado");
    const x = j.data;
    setForm({
      _id: x._id,
      numeroParte: x.numeroParte || "",
      descripcion: x.descripcion || "",
      marca: x.marca || "",
    });
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar este código?")) return;
    const r = await fetch(`${API}/codigos/${id}`, { method: "DELETE", credentials:"include" });
    if (!r.ok) return alert("No se pudo eliminar");
    await recargarTabla();
    await recargarOptions();
  }

  return (
    <div className="container-fluid py-3">
      <div className="row justify-content-center">
        <div className="col-12 col-xxl-10">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white border-0">
              <h2 className="h4 text-center mb-0">ALTA DE CODIGOS DE LA REFACCIONARIA</h2>
            </div>

            <div className="card-body">
              {/* Formulario superior (2x2) */}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Numero de Parte:</label>
                  <input className="form-control" name="numeroParte" value={form.numeroParte} onChange={onChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Descripción:</label>
                  <input className="form-control" name="descripcion" value={form.descripcion} onChange={onChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marca:</label>
                  <input className="form-control" name="marca" value={form.marca} onChange={onChange} />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-3">
                <button className="btn btn-primary" onClick={guardar} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar"}
                </button>
              </div>

              {/* Selector + Buscar */}
              <div className="row align-items-end mt-4">
                <div className="col-md-9">
                  <label className="form-label">Seleccionar Refacción:</label>
                  <select className="form-select" value={refSel} onChange={(e)=>setRefSel(e.target.value)}>
                    <option value="">—</option>
                    {options.map(o => <option key={o._id} value={o._id}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <button className="btn btn-primary w-100 mt-3 mt-md-0" onClick={buscarSeleccion}>Buscar</button>
                </div>
              </div>
            </div>

            {/* Tabla inferior */}
            <div className="table-responsive px-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small">Show</span>
                  <select
                    value={pageSize}
                    className="form-select form-select-sm"
                    onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                  >
                    {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-muted small">entries</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small">Search:</span>
                  <input className="form-control form-control-sm" value={query} onChange={(e)=>{ setQuery(e.target.value); setPage(1); }} />
                </div>
              </div>

              <table className="table table-striped table-bordered align-middle">
                <thead>
                  <tr>
                    <th style={{width:80}}>ID</th>
                    <th role="button" onClick={()=>changeSort("numeroParte")}>Numero de parte {chev(sort,"numeroParte")}</th>
                    <th role="button" onClick={()=>changeSort("marca")}>Marca {chev(sort,"marca")}</th>
                    <th>Descripcion</th>
                    <th style={{width:50}} className="text-center">X</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4">Sin registros</td></tr>
                  ) : (
                    pageData.map((x) => (
                      <tr key={x._id}>
                        <td>{String(x._id).slice(-4)}</td>
                        <td>{x.numeroParte}</td>
                        <td>{x.marca}</td>
                        <td>{x.descripcion}</td>
                        <td className="text-center">
                          <button className="btn btn-link text-danger p-0" onClick={()=>eliminar(x._id)}>X</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Footer paginación */}
              <div className="d-flex align-items-center justify-content-between pb-3">
                <div className="small text-muted">
                  Pagina {pageSafe} de {totalPages} — {filtered.length} registros
                </div>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${pageSafe===1?'disabled':''}`}>
                    <button className="page-link" onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
                  </li>
                  {Array.from({length: totalPages}).map((_,i)=>(
                    <li key={i} className={`page-item ${pageSafe===i+1?'active':''}`}>
                      <button className="page-link" onClick={()=>setPage(i+1)}>{i+1}</button>
                    </li>
                  ))}
                  <li className={`page-item ${pageSafe===totalPages?'disabled':''}`}>
                    <button className="page-link" onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function chev(sort, key) {
  if (sort.key !== key) return <span className="text-muted">▲▼</span>;
  return sort.dir === "asc" ? <span>▲</span> : <span>▼</span>;
}
