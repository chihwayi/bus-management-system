const express = require('express');
const routeController = require('../controllers/routeController');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all routes
router.get('/', routeController.getAllRoutes);

// Get route by ID
router.get('/:id', routeController.getRoute);

// Create new route (admin only)
router.post('/', requireRole(['admin']), routeController.createRoute);

// Update route (admin only)
router.put('/:id', requireRole(['admin']), routeController.updateRoute);

// Delete route (admin only)
router.delete('/:id', requireRole(['admin']), routeController.deleteRoute);

// Get passengers assigned to a specific route
router.get('/:id/passengers', routeController.getRoutePassengers);

// Get conductors assigned to a specific route
router.get('/:id/conductors', routeController.getRouteConductors);

// Get route statistics
router.get('/:id/stats', routeController.getRouteStats);

module.exports = router;