const express = require('express');
const passengerController = require('../controllers/passengerController');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all passengers (with filtering)
router.get('/', passengerController.getAllPassengers);

// Search passengers
router.get('/search', passengerController.getAllPassengers);

// Get passenger by ID
router.get('/:id', passengerController.getPassenger);

// Create new passenger
router.post('/', passengerController.createPassenger);

// Update passenger
router.put('/:id', passengerController.updatePassenger);

// Delete passenger (admin only)
router.delete('/:id', requireRole(['admin']), passengerController.deletePassenger);

// Deduct fare (boarding)
router.post('/:id/board', passengerController.deductFare);

// Add balance (top-up)
router.post('/:id/topup', passengerController.addBalance);

// Update balance (direct set)
router.put('/:id/balance', passengerController.updateBalance);

// Transfer passenger to different route
router.post('/:id/transfer', passengerController.transferToRoute);

// Get passenger transaction history
router.get('/:id/transactions', passengerController.getPassengerTransactions);

module.exports = router;