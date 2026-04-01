// routes/clientes.js
const express = require("express");
const Cliente = require("../models/Cliente");
const router = express.Router();

// POST /api/clientes  (crear)
router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };

    const cliente = await Cliente.create(body);
    res.status(201).json({ ok: true, data: cliente });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/clientes  (listar + búsqueda paginada)
router.get("/", async (req, res) => {
  try {
    const { q = "", page = 1, limit = 10 } = req.query;
    const find = q ? { $text: { $search: q } } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Cliente.find(find)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Cliente.countDocuments(find),
    ]);

    res.json({
      ok: true,
      data: items,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/clientes/facturacion?q=
 * Regresa lista ligera para selector en NuevaFactura
 */
router.get("/facturacion", async (req, res) => {
  try {
    const { q = "", limit = 20 } = req.query;

    const find = q
      ? {
          $or: [
            { nombre: { $regex: q, $options: "i" } },
            { apellidoPaterno: { $regex: q, $options: "i" } },
            { apellidoMaterno: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { rfc: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const items = await Cliente.find(find)
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .select(
        "nombre apellidoPaterno apellidoMaterno email rfc regimenFiscal codigoPostalFiscal"
      );

    res.json({ ok: true, data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});



// GET /api/clientes/:id
router.get("/:id", async (req, res) => {
  const c = await Cliente.findById(req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: "No encontrado" });
  res.json({ ok: true, data: c });
});

// PUT /api/clientes/:id
router.put("/:id", async (req, res) => {
  try {
    const body = { ...req.body };
 

    const c = await Cliente.findByIdAndUpdate(req.params.id, body, {
      new: true,
    });
    res.json({ ok: true, data: c });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DELETE (soft delete opcional)
router.delete("/:id", async (req, res) => {
  const c = await Cliente.findByIdAndUpdate(
    req.params.id,
    { activo: false },
    { new: true }
  );
  res.json({ ok: true, data: c });
});

module.exports = router;
