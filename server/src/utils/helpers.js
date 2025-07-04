function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function getBalanceStatus(balance) {
  if (balance < 0) return 'danger';
  if (balance === 0) return 'red';
  if (balance <= 5) return 'orange';
  return 'green';
}

function paginate(array, page = 1, perPage = 10) {
  const offset = (page - 1) * perPage;
  return {
    data: array.slice(offset, offset + perPage),
    total: array.length,
    page,
    perPage,
    totalPages: Math.ceil(array.length / perPage)
  };
}

module.exports = {
  formatCurrency,
  formatDate,
  getBalanceStatus,
  paginate
};