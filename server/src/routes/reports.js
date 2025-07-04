const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth, requireRole } = require('../middleware/auth');

// Conductor Reports
router.get('/conductor/daily', auth, requireRole(['conductor', 'admin']), reportController.getConductorDailyReport);
router.get('/conductor/weekly', auth, requireRole(['conductor', 'admin']), reportController.getConductorWeeklyReport);
router.get('/conductor/monthly', auth, requireRole(['conductor', 'admin']), reportController.getConductorMonthlyReport);

// Admin Reports
router.get('/admin/overview', auth, requireRole(['admin']), reportController.getAdminOverview);

// Export Reports
router.get('/export/:type', auth, reportController.exportReport);

// Passenger Transaction History
router.get('/passenger/:passengerId/history', auth, reportController.getPassengerTransactionHistory);

module.exports = router;
