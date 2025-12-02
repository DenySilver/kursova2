const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');
const isAuth = require('../middleware/isAuth');

router.get('/', (req, res) => res.redirect('/dashboard')); // Редірект на дашборд
router.get('/dashboard', isAuth, mainController.getDashboard);
router.get('/training/:langId', isAuth, mainController.getTrainingHub);

router.get('/profile', isAuth, mainController.getProfile);
router.get('/profile/edit', isAuth, mainController.getEditProfile);
router.post('/profile/edit', isAuth, mainController.postEditProfile);

module.exports = router;