const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/', adminController.getDashboard);

router.get('/api/:tableName', adminController.getTableData);
router.post('/api/:tableName', adminController.addRecord);
router.put('/api/:tableName/:id', adminController.updateRecord);
router.delete('/api/:tableName/:id', adminController.deleteRecord);

module.exports = router;