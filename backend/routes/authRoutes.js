const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');
const { proteger, requiereRol } = require('../middleware/auth');
const User = require('../models/User');

// /register queda abierto solo para crear el primer usuario del sistema (taller
// recién instalado, sin ningún admin todavía). En cuanto exista al menos un
// usuario, dar de alta cuentas nuevas requiere estar autenticado como admin
// (usar Personal → Usuarios). Antes cualquiera podía crear una cuenta admin
// sin autenticarse llamando este endpoint directo.
async function soloBootstrapOAdmin(req, res, next) {
  try {
    const hayUsuarios = await User.countDocuments();
    if (hayUsuarios === 0) return next();
  } catch (err) {
    return res.status(500).json({ message: 'Error validando registro', error: err.message });
  }
  return proteger(req, res, () => requiereRol('admin')(req, res, next));
}

router.post('/register', soloBootstrapOAdmin, register);
router.post('/login', login);
router.get('/me', proteger, me);    // 👈 aquí usamos proteger

module.exports = router;
