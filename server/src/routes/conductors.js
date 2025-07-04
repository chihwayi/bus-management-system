const express = require('express');
const router = express.Router();
const conductorController = require('../controllers/conductorController');
const { auth, requireRole } = require('../middleware/auth');

const validateConductor = (req, res, next) => {
  const { username, password, fullName } = req.body;
  const errors = [];
  
  // Only validate required fields for POST requests (creation)
  if (req.method === 'POST') {
    if (!username) errors.push('Username is required');
    if (!password) errors.push('Password is required');
    if (!fullName) errors.push('Full name is required');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      success: false, 
      errors 
    });
  }

  next();
};

router.post('/', auth, requireRole(['admin']), validateConductor, conductorController.createConductor);
router.get('/', auth, conductorController.getAllConductors);
router.get('/:id', auth, conductorController.getConductor);
router.put('/:id', auth, requireRole(['admin']), validateConductor, conductorController.updateConductor);
router.delete('/:id', auth, requireRole(['admin']), conductorController.deleteConductor);
router.get('/:id/passengers', auth, conductorController.getConductorPassengers);
router.get('/:id/stats', auth, conductorController.getConductorStats);
router.get('/:id/transactions', auth, conductorController.getConductorTransactions);
router.post('/:id/assign', auth, requireRole(['admin']), conductorController.assignToRoute);

module.exports = router;