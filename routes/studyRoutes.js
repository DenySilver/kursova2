const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');
const isAuth = require('../middleware/isAuth');

// Інтервальне повторення
router.get('/repetition/:langId', isAuth, studyController.getRepetition);

// Картки (загальні та по категоріях)
router.get('/cards/:langId', isAuth, studyController.getFlashcards);
router.get('/cards/:langId/cat/:catId', isAuth, studyController.getFlashcards);

// Тести
router.get('/test/:langId', isAuth, studyController.getTest);
router.post('/test/submit', isAuth, studyController.postTestResult);

// AJAX обробка (тепер беремо з того ж studyController)
router.post('/process', isAuth, studyController.processReview); 

module.exports = router;