const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register); // opcional para crear el primer usuario
router.post('/login', login);
router.get('/me', auth, me);

module.exports = router;