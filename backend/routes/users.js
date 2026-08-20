// backend/routes/users.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Empleado = require('../models/Empleado');
const { proteger, requiereRol } = require('../middleware/auth');

const ROLES = ['admin', 'staff', 'mecanico', 'recepcion', 'contabilidad', 'consulta'];

// GET /api/users/activos — lista de usuarios activos (para el campo "Comprador"
// del formato de Devolución de Refacciones). Taller no distingue un rol
// "refaccionario" propio, así que se listan todos los usuarios activos.
router.get('/activos', proteger, async (req, res) => {
  try {
    const usuarios = await User.find({ isActive: true })
      .select('name email role')
      .sort({ name: 1 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

// GET /api/users — lista completa (gestión de accesos, solo admin)
router.get('/', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const usuarios = await User.find()
      .select('-password')
      .sort({ name: 1 });
    res.json({ ok: true, data: usuarios });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener usuarios', error: error.message });
  }
});

// POST /api/users — da de alta un usuario del sistema (solo admin). Si viene
// empleadoId, liga la cuenta nueva a ese empleado en ambos sentidos.
router.post('/', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const { name, email, password, role, empleadoId } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ ok: false, msg: 'Nombre, correo y contraseña son obligatorios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ ok: false, msg: 'Rol inválido.' });
    }

    const existe = await User.findOne({ email: email.toLowerCase().trim() });
    if (existe) return res.status(409).json({ ok: false, msg: 'Ya existe un usuario con ese correo.' });

    const usuario = await User.create({
      name: name.trim(),
      email: email.trim(),
      password,
      role: role || 'consulta',
      employee: empleadoId || null,
    });

    if (empleadoId) {
      await Empleado.findByIdAndUpdate(empleadoId, { usuario: usuario._id });
    }

    const { password: _pw, ...userSinPassword } = usuario.toObject();
    res.status(201).json({ ok: true, data: userSinPassword });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al crear el usuario', error: error.message });
  }
});

// PUT /api/users/:id — edita nombre/correo/rol/estado (solo admin)
router.put('/:id', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body || {};

    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ ok: false, msg: 'Rol inválido.' });
    }

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (email !== undefined) update.email = email.trim();
    if (role !== undefined) update.role = role;
    if (typeof isActive === 'boolean') update.isActive = isActive;

    const usuario = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    res.json({ ok: true, data: usuario });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al actualizar el usuario', error: error.message });
  }
});

// PUT /api/users/:id/password — restablece la contraseña (solo admin). No
// existe endpoint para "ver" la contraseña: queda hasheada, es irreversible.
router.put('/:id/password', proteger, requiereRol('admin'), async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    usuario.password = password; // el pre('save') del modelo la hashea
    await usuario.save();

    res.json({ ok: true, msg: 'Contraseña actualizada.' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al restablecer la contraseña', error: error.message });
  }
});

module.exports = router;
