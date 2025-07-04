const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getDatabase } = require('../models/database');

// Get recent transactions for admin dashboard
router.get('/transactions/recent', auth, requireRole(['admin']), async (req, res) => {
  try {
    const db = getDatabase().db;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    
    const transactions = db.prepare(`
      SELECT 
        t.*,
        p.full_name as passenger_name,
        p.legacy_passenger_id,
        r.name as route_name,
        u.full_name as conductor_name
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN routes r ON t.route_id = r.id
      JOIN conductors c ON t.conductor_id = c.id
      JOIN users u ON c.user_id = u.id
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(limit);

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transaction statistics for admin dashboard
router.get('/transactions/stats', auth, requireRole(['admin']), async (req, res) => {
  try {
    const db = getDatabase().db;
    const period = req.query.period || 'today'; // today, week, month
    
    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = "DATE(transaction_date) >= DATE('now', '-7 days')";
        break;
      case 'month':
        dateFilter = "DATE(transaction_date) >= DATE('now', '-30 days')";
        break;
      default: // today
        dateFilter = "DATE(transaction_date) = DATE('now')";
    }

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN transaction_type = 'boarding' THEN 1 END) as total_boardings,
        COUNT(CASE WHEN transaction_type = 'topup' THEN 1 END) as total_topups,
        SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END) as total_revenue,
        SUM(CASE WHEN transaction_type = 'topup' THEN amount ELSE 0 END) as total_topups_amount,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COUNT(DISTINCT conductor_id) as active_conductors
      FROM transactions
      WHERE ${dateFilter}
    `).get();

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get revenue by route for admin dashboard
router.get('/revenue/by-route', auth, requireRole(['admin']), async (req, res) => {
  try {
    const db = getDatabase().db;
    const period = req.query.period || 'today';
    
    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = "DATE(transaction_date) >= DATE('now', '-7 days')";
        break;
      case 'month':
        dateFilter = "DATE(transaction_date) >= DATE('now', '-30 days')";
        break;
      default: // today
        dateFilter = "DATE(transaction_date) = DATE('now')";
    }

    const routeRevenue = db.prepare(`
      SELECT 
        r.id,
        r.name as route_name,
        r.boarding_area,
        COUNT(CASE WHEN t.transaction_type = 'boarding' THEN 1 END) as boarding_count,
        SUM(CASE WHEN t.transaction_type = 'boarding' THEN ABS(t.amount) ELSE 0 END) as revenue,
        COUNT(DISTINCT t.passenger_id) as unique_passengers
      FROM routes r
      LEFT JOIN transactions t ON r.id = t.route_id AND ${dateFilter}
      WHERE r.is_active = true
      GROUP BY r.id, r.name, r.boarding_area
      ORDER BY revenue DESC
    `).all();

    res.json({ success: true, data: routeRevenue });
  } catch (error) {
    console.error('Error fetching route revenue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export transactions data
router.get('/export', auth, requireRole(['admin']), async (req, res) => {
  try {
    const db = getDatabase().db;
    const format = req.query.format || 'csv';
    const period = req.query.period || 'daily';
    
    let dateFilter;
    switch (period) {
      case 'weekly':
        dateFilter = "DATE(transaction_date) >= DATE('now', '-7 days')";
        break;
      case 'monthly':
        dateFilter = "DATE(transaction_date) >= DATE('now', '-30 days')";
        break;
      default: // daily
        dateFilter = "DATE(transaction_date) = DATE('now')";
    }

    const transactions = db.prepare(`
      SELECT 
        t.id,
        t.transaction_date,
        t.transaction_type,
        t.amount,
        p.full_name as passenger_name,
        p.legacy_passenger_id,
        r.name as route_name,
        u.full_name as conductor_name,
        t.notes
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN routes r ON t.route_id = r.id
      JOIN conductors c ON t.conductor_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE ${dateFilter}
      ORDER BY t.transaction_date DESC
    `).all();

    if (format === 'csv') {
      // Convert to CSV
      const csvHeader = 'Transaction ID,Date,Type,Amount,Passenger,Passenger ID,Route,Conductor,Notes\n';
      const csvRows = transactions.map(t => 
        `"${t.id}","${t.transaction_date}","${t.transaction_type}","${t.amount}","${t.passenger_name}","${t.legacy_passenger_id}","${t.route_name}","${t.conductor_name}","${t.notes || ''}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions-${period}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      res.json({ success: true, data: transactions });
    }
  } catch (error) {
    console.error('Error exporting transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;