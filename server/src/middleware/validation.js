const { validatePassengerData } = require('../utils/validators');

function validatePassenger(req, res, next) {
  const errors = validatePassengerData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
}

function validateConductor(req, res, next) {
  // Add conductor validation logic
  next();
}

function validateRoute(req, res, next) {
  // Add route validation logic
  next();
}

module.exports = {
  validatePassenger,
  validateConductor,
  validateRoute
};