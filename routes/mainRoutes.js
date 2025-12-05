const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

router.get('/', mainController.getIndex);
router.get('/user/:userId/dashboard', mainController.getDashboard);
router.get('/user/:userId/training/:langId', mainController.getTrainingHub);
router.get('/user/:userId', mainController.getProfile);

router.get('/user/:userId/edit', mainController.getEditProfile);
router.post('/user/:userId/edit', mainController.postEditProfile);

router.get('/user/:userId/certificate', mainController.getCertificate);

module.exports = router;