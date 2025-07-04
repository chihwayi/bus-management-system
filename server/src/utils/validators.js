function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
  return password.length >= 8;
}

function validateName(name) {
  return name.length >= 2;
}

function validateBalance(balance) {
  return !isNaN(parseFloat(balance));
}

function validateFare(fare) {
  return !isNaN(parseFloat(fare)) && parseFloat(fare) > 0;
}

function validatePassengerData(data) {
  const errors = [];
  
  if (!validateName(data.fullName)) {
    errors.push('Full name must be at least 2 characters');
  }
  
  if (!validateName(data.ministry)) {
    errors.push('Ministry must be specified');
  }
  
  if (!validateName(data.boardingArea)) {
    errors.push('Boarding area must be specified');
  }
  
  if (data.currentBalance !== undefined && !validateBalance(data.currentBalance)) {
    errors.push('Invalid balance value');
  }
  
  return errors;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateBalance,
  validateFare,
  validatePassengerData
};