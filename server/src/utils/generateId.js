const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4();
}

function generateShortId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generatePassengerId(legacyId) {
  return legacyId ? `P-${legacyId}` : `P-${generateShortId()}`;
}

function generateConductorId(employeeId) {
  return employeeId ? `C-${employeeId}` : `C-${generateShortId()}`;
}

module.exports = {
  generateId,
  generateShortId,
  generatePassengerId,
  generateConductorId
};