// src/components/VehicleDamageCanvas.jsx
import React, { useEffect, useRef, useState } from "react";

const TOOLS = [
  { id: "libre",    label: "✏️ Trazo libre" },
  { id: "circulo",  label: "⭕ Círculo"     },
  { id: "x",        label: "✕ Marcar"       },
  { id: "borrador", label: "◻ Borrador"     },
];

const COLORS = ["#E24B4A", "#1D9E75", "#378ADD", "#BA7517"];
const MAX_HISTORY = 30;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Comprime una imagen antes de convertirla a base64.
 * @param {File} file        - Archivo de imagen original
 * @param {number} maxPx     - Lado máximo en píxeles (ancho o alto)
 * @param {number} quality   - Calidad JPEG 0-1 (0.7 = 70%)
 */
function comprimirImagen(file, maxPx = 900, quality = 0.60) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // Calcular nuevas dimensiones respetando proporción
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) {
            height = Math.round((height * maxPx) / width);
            width  = maxPx;
          } else {
            width  = Math.round((width * maxPx) / height);
            height = maxPx;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ───────────────────────────────────────────────────────────────────────────
export default function VehicleDamageCanvas({
  value,
  onChange,
  photos = [],
  onPhotosChange,
  readOnly = false,
}) {
  const canvasRef  = useRef(null);
  const imgRef     = useRef(null);
  const isDrawing  = useRef(false);
  const startPos   = useRef({ x: 0, y: 0 });
  const snapshot   = useRef(null);
  const historyRef = useRef([]); // stack de base64 pre-trazo
  const fileInputRef = useRef(null);

  const [tool,      setTool]      = useState("libre");
  const [color,     setColor]     = useState("#E24B4A");
  const [grosor,    setGrosor]    = useState(3);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canUndo,   setCanUndo]   = useState(false);
  const [preview,   setPreview]   = useState(null); // foto en vista previa

  // ── Cargar imagen base del vehículo ──────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.src = "/images/vehicle_damage_selector.jpg";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
  }, []);

  // ── Dibujar imagen base + anotaciones guardadas ───────────────────────
  useEffect(() => {
    if (!imgLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    if (value) {
      const saved = new Image();
      saved.onload = () => ctx.drawImage(saved, 0, 0);
      saved.src = value;
    }
  }, [imgLoaded, value]);

  // ── Posición relativa al canvas ───────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  };

  // ── Guardar en historial (antes de cada trazo) ────────────────────────
  const pushHistory = () => {
    const canvas = canvasRef.current;
    const stack = historyRef.current;
    if (stack.length >= MAX_HISTORY) stack.shift();
    stack.push(canvas.toDataURL("image/png"));
    setCanUndo(stack.length > 0);
  };

  // ── Deshacer último trazo ─────────────────────────────────────────────
  const handleUndo = () => {
    if (readOnly || historyRef.current.length === 0) return;
    const prev = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (onChange) onChange(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = prev;
  };

  // ── Inicio de trazo ───────────────────────────────────────────────────
  const startDraw = (e) => {
    if (readOnly) return;
    e.preventDefault();
    pushHistory(); // guardar estado antes de dibujar

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    isDrawing.current = true;
    startPos.current  = pos;
    snapshot.current  = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (tool === "borrador") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = grosor * 5;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth   = grosor;
    }
    ctx.lineCap   = "round";
    ctx.lineJoin  = "round";

    if (tool === "libre" || tool === "borrador") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  // ── Durante el trazo ──────────────────────────────────────────────────
  const draw = (e) => {
    if (!isDrawing.current || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    if (tool === "borrador") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = grosor * 5;
      ctx.lineCap  = "round";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      // Redibujar imagen base debajo para no dejar huecos
      const tempData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "destination-over";
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      return;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth   = grosor;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    if (tool === "libre") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.putImageData(snapshot.current, 0, 0);

      if (tool === "circulo") {
        const dx = pos.x - startPos.current.x;
        const dy = pos.y - startPos.current.y;
        const r  = Math.sqrt(dx * dx + dy * dy);
        ctx.beginPath();
        ctx.arc(startPos.current.x, startPos.current.y, r, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === "x") {
        const size = Math.max(
          Math.abs(pos.x - startPos.current.x),
          Math.abs(pos.y - startPos.current.y)
        );
        const cx = startPos.current.x;
        const cy = startPos.current.y;
        ctx.beginPath();
        ctx.moveTo(cx - size, cy - size); ctx.lineTo(cx + size, cy + size);
        ctx.moveTo(cx + size, cy - size); ctx.lineTo(cx - size, cy + size);
        ctx.stroke();
      }
    }
  };

  // ── Fin de trazo ──────────────────────────────────────────────────────
  const endDraw = (e) => {
    if (!isDrawing.current || readOnly) return;
    e.preventDefault();
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.closePath();
    ctx.globalCompositeOperation = "source-over";
    if (onChange) onChange(canvas.toDataURL("image/jpeg", 0.7));
  };

  // ── Limpiar todo ──────────────────────────────────────────────────────
  const handleClear = () => {
    if (readOnly) return;
    pushHistory();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    if (onChange) onChange(null);
  };

  // ── Subir fotos ───────────────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    if (readOnly) return;
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newPhotos = await Promise.all(
      files.map(async (file) => ({
        id:  `${Date.now()}-${Math.random()}`,
        src: await comprimirImagen(file), // comprimida antes de guardar
        name: file.name,
      }))
    );

    const updated = [...photos, ...newPhotos];
    if (onPhotosChange) onPhotosChange(updated);
    // Reset input para permitir subir el mismo archivo de nuevo
    e.target.value = "";
  };

  const handleRemovePhoto = (id) => {
    if (readOnly) return;
    const updated = photos.filter((p) => p.id !== id);
    if (onPhotosChange) onPhotosChange(updated);
  };

  // ── Cursor según herramienta ──────────────────────────────────────────
  const cursorStyle = readOnly ? "default"
    : tool === "libre"    ? "crosshair"
    : tool === "borrador" ? "cell"
    : "cell";

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Barra de herramientas ── */}
      {!readOnly && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          {/* Herramientas */}
          <div className="btn-group btn-group-sm">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn ${tool === t.id ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setTool(t.id)}
                title={t.label}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Colores (ocultos en modo borrador) */}
          {tool !== "borrador" && (
            <div className="d-flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: c,
                    border: color === c ? "3px solid #333" : "2px solid #ccc",
                    cursor: "pointer", padding: 0,
                  }}
                />
              ))}
            </div>
          )}

          {/* Grosor */}
          <div className="d-flex align-items-center gap-1">
            <span style={{ fontSize: 11, color: "#888" }}>
              {tool === "borrador" ? "Tamaño" : "Grosor"}
            </span>
            <input
              type="range" min="1" max="10" value={grosor}
              onChange={(e) => setGrosor(Number(e.target.value))}
              style={{ width: 70 }}
            />
            <span style={{ fontSize: 11, color: "#888", minWidth: 16 }}>{grosor}</span>
          </div>

          {/* Deshacer */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Deshacer último trazo"
          >
            ↩ Deshacer
          </button>

          {/* Limpiar */}
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-auto"
            onClick={handleClear}
            title="Limpiar todos los trazos"
          >
            🗑️ Limpiar
          </button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div style={{
        position: "relative", width: "100%",
        border: "1px solid #ddd", borderRadius: 6,
        overflow: "hidden", cursor: cursorStyle,
      }}>
        {!imgLoaded && (
          <div className="text-center py-4 text-muted" style={{ fontSize: 13 }}>
            Cargando imagen...
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          style={{ width: "100%", display: imgLoaded ? "block" : "none", touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {!readOnly && (
        <p style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
          {tool === "libre"    && "Arrastra para dibujar trazos libres."}
          {tool === "circulo"  && "Clic y arrastra para dibujar un círculo sobre la zona dañada."}
          {tool === "x"        && "Clic y arrastra para marcar con X la zona dañada."}
          {tool === "borrador" && "Arrastra sobre los trazos que quieras eliminar."}
        </p>
      )}

      {/* ── Sección de fotos ── */}
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-semibold" style={{ fontSize: 13 }}>
            📷 Fotos del vehículo
          </span>
          {!readOnly && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                + Agregar foto(s)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handlePhotoUpload}
              />
            </>
          )}
        </div>

        {/* Grid de fotos */}
        {photos.length === 0 ? (
          <div
            className="text-center text-muted py-3"
            style={{
              border: "2px dashed #ddd", borderRadius: 8,
              fontSize: 13, cursor: readOnly ? "default" : "pointer",
            }}
            onClick={() => !readOnly && fileInputRef.current?.click()}
          >
            {readOnly ? "Sin fotos registradas." : "Haz clic aquí o en '+ Agregar foto(s)' para subir imágenes del vehículo."}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
            gap: 8,
          }}>
            {photos.map((photo) => (
              <div
                key={photo.id}
                style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid #ddd" }}
              >
                <img
                  src={photo.src}
                  alt={photo.name || "Foto"}
                  onClick={(e) => { e.stopPropagation(); setPreview(photo); }}
                  style={{ width: "100%", height: 80, objectFit: "cover", display: "block", cursor: "zoom-in" }}
                  title="Ver foto completa"
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    style={{
                      position: "absolute", top: 3, right: 3,
                      background: "rgba(0,0,0,0.55)", color: "#fff",
                      border: "none", borderRadius: "50%",
                      width: 20, height: 20, fontSize: 11,
                      cursor: "pointer", lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="Eliminar foto"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* Botón + dentro del grid */}
            {!readOnly && (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 80, border: "2px dashed #ccc", borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#aaa", fontSize: 24,
                }}
                title="Agregar más fotos"
              >
                +
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Vista previa (lightbox) ── */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.82)",
            zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
            cursor: "zoom-out",
          }}
        >
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={() => setPreview(null)}
            style={{
              position: "absolute", top: 18, right: 22,
              background: "rgba(255,255,255,0.15)", color: "#fff",
              border: "none", borderRadius: "50%",
              width: 36, height: 36, fontSize: 20,
              cursor: "pointer", lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Cerrar"
          >
            ✕
          </button>

          {/* Imagen */}
          <img
            src={preview.src}
            alt={preview.name || "Foto"}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "88vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              cursor: "default",
            }}
          />

          {/* Nombre del archivo */}
          {preview.name && (
            <div style={{
              position: "absolute", bottom: 18,
              background: "rgba(0,0,0,0.5)", color: "#fff",
              padding: "4px 14px", borderRadius: 20, fontSize: 12,
            }}>
              {preview.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}