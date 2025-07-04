const express = require('express');
const router = express.Router();
const boardingController = require('../controllers/boardingController');
const { auth, requireRole } = require('../middleware/auth');

// Conductor-specific endpoints
router.get('/today', auth, requireRole(['conductor', 'admin']), boardingController.getConductorTodayStats);
router.get('/recent', auth, requireRole(['conductor', 'admin']), boardingController.getRecentBoardings);

// Admin-only endpoints
router.get('/admin/conductors', auth, requireRole(['admin']), boardingController.getTodayConductorsStats);
router.get('/admin/routes', auth, requireRole(['admin']), boardingController.getTodayRoutesStats);

module.exports = router;