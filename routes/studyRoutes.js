const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');

router.get('/user/:userId/cards/:langId/cat/:catId', studyController.getCategorySession);
router.get('/user/:userId/repetition/:langId', studyController.getRepetition);
router.get('/user/:userId/test/:langId', studyController.getTest);
router.post('/user/:userId/test/submit', studyController.postTestResult);
router.post('/process', studyController.processReview);

router.get('/user/:userId/sprint/:langId', studyController.getSprint);
router.post('/user/:userId/sprint/submit', studyController.postSprintResult);

module.exports = router;