const { getDatabase } = require('../models/database');

class ReportController {
  constructor() {
    this.dbManager = getDatabase();
    this.db = this.dbManager.db;
  }

  async getConductorDailyReport(req, res) {
    try {
      const { date, conductorId } = req.query;
      const effectiveConductorId = conductorId || req.user.conductor_id;

      if (!effectiveConductorId) {
        return res.status(400).json({
          success: false,
          error: 'Conductor ID is required'
        });
      }

      const reportDate = date || new Date().toISOString().split('T')[0];

      // Get daily statistics
      const dailyStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_boardings,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN transaction_type = 'topup' THEN amount ELSE 0 END), 0) as total_topups
      FROM transactions
      WHERE conductor_id = ? AND DATE(transaction_date) = DATE(?)
    `).get(effectiveConductorId, reportDate);


      // Get hourly breakdown
      const hourlyBreakdown = this.db.prepare(`
        SELECT
          strftime('%H', transaction_date) as hour,
          COUNT(*) as boardings,
          COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as revenue
        FROM transactions
        WHERE conductor_id = ?
        AND DATE(transaction_date) = DATE(?) AND transaction_type = 'boarding'
        GROUP BY strftime('%H', transaction_date)
        ORDER BY hour
      `).all(conductorId, reportDate);

      // Get passenger details
      const passengerDetails = this.db.prepare(`
        SELECT
          p.full_name,
          p.legacy_passenger_id,
          COUNT(t.id) as boarding_count,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'boarding' THEN ABS(t.amount) ELSE 0 END), 0) as total_paid,
          p.current_balance
        FROM transactions t
        JOIN passengers p ON t.passenger_id = p.id
        WHERE t.conductor_id = ? AND DATE(t.transaction_date) = DATE(?)
        GROUP BY p.id
        ORDER BY p.full_name
      `).all(conductorId, reportDate);

      passengerDetails.forEach(passenger => {
        passenger.transactions = this.db.prepare(`
    SELECT * FROM transactions 
    WHERE passenger_id = ? AND conductor_id = ? AND DATE(transaction_date) = DATE(?)
    ORDER BY transaction_date DESC
    LIMIT 5
  `).all(passenger.id, conductorId, reportDate);
      });

      // Get conductor info
      const conductor = this.dbManager.getConductor(conductorId);

      res.json({
        success: true,
        data: {
          date: reportDate,
          conductor: {
            name: conductor.full_name,
            route: conductor.route_name
          },
          summary: dailyStats,
          hourlyBreakdown,
          passengerDetails
        }
      });
    } catch (error) {
      console.error('Daily report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate daily report'
      });
    }
  }

  async getConductorWeeklyReport(req, res) {
    try {
      const { startDate, conductorId } = req.query;
      const effectiveConductorId = conductorId || req.user.conductor_id;

      if (!effectiveConductorId) {
        return res.status(400).json({
          success: false,
          error: 'User is not a conductor'
        });
      }

      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];

      // Get weekly statistics
      const weeklyStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_boardings,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN transaction_type = 'topup' THEN amount ELSE 0 END), 0) as total_topups
      FROM transactions
      WHERE conductor_id = ? AND DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
    `).get(effectiveConductorId, start, end);

      // Get daily breakdown
      const dailyBreakdown = this.db.prepare(`
      SELECT
        DATE(transaction_date) as date,
        COUNT(*) as boardings,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as revenue
      FROM transactions
      WHERE conductor_id = ? AND DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY DATE(transaction_date)
      ORDER BY date
    `).all(effectiveConductorId, start, end);

      // Get top passengers
      const topPassengers = this.db.prepare(`
      SELECT
        p.full_name,
        p.legacy_passenger_id,
        COUNT(t.id) as boarding_count,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'boarding' THEN ABS(t.amount) ELSE 0 END), 0) as total_paid
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      WHERE t.conductor_id = ? AND DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY p.id
      ORDER BY boarding_count DESC
      LIMIT 10
    `).all(effectiveConductorId, start, end);

      topPassengers.forEach(passenger => {
        passenger.transactions = this.db.prepare(`
    SELECT * FROM transactions 
    WHERE passenger_id = ? AND conductor_id = ? AND DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
    ORDER BY transaction_date DESC
    LIMIT 5
  `).all(passenger.id, effectiveConductorId, start, end);
      });

      const conductor = this.dbManager.getConductor(effectiveConductorId);

      res.json({
        success: true,
        data: {
          period: { start, end },
          conductor: {
            name: conductor.full_name,
            route: conductor.route_name
          },
          summary: weeklyStats,
          dailyBreakdown,
          topPassengers
        }
      });
    } catch (error) {
      console.error('Weekly report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate weekly report'
      });
    }
  }

  async getConductorMonthlyReport(req, res) {
    try {
      const { month, year, conductorId } = req.query;
      const effectiveConductorId = conductorId || req.user.conductor_id;

      if (!effectiveConductorId) {
        return res.status(400).json({
          success: false,
          error: 'User is not a conductor'
        });
      }

      const reportMonth = month || (new Date().getMonth() + 1);
      const reportYear = year || new Date().getFullYear();

      // Get monthly statistics
      const monthlyStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_boardings,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN transaction_type = 'topup' THEN amount ELSE 0 END), 0) as total_topups,
        COUNT(DISTINCT DATE(transaction_date)) as working_days
      FROM transactions
      WHERE conductor_id = ?
      AND strftime('%m', transaction_date) = ?
      AND strftime('%Y', transaction_date) = ?
    `).get(
        effectiveConductorId,
        reportMonth.toString().padStart(2, '0'),
        reportYear.toString()
      );

      // Get daily breakdown for the month
      const dailyBreakdown = this.db.prepare(`
      SELECT
        DATE(transaction_date) as date,
        COUNT(*) as boardings,
        COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as revenue
      FROM transactions
      WHERE conductor_id = ?
      AND strftime('%m', transaction_date) = ?
      AND strftime('%Y', transaction_date) = ?
      GROUP BY DATE(transaction_date)
      ORDER BY date
    `).all(
        effectiveConductorId,
        reportMonth.toString().padStart(2, '0'),
        reportYear.toString()
      );

      // Get recent transactions for the month
      const recentTransactions = this.db.prepare(`
  SELECT * FROM transactions
  WHERE conductor_id = ?
  AND strftime('%m', transaction_date) = ?
  AND strftime('%Y', transaction_date) = ?
  ORDER BY transaction_date DESC
  LIMIT 50
`).all(
        effectiveConductorId,
        reportMonth.toString().padStart(2, '0'),
        reportYear.toString()
      );

      const conductor = this.dbManager.getConductor(effectiveConductorId);

      res.json({
        success: true,
        data: {
          period: { month: reportMonth, year: reportYear },
          conductor: {
            name: conductor.full_name,
            route: conductor.route_name
          },
          summary: monthlyStats,
          dailyBreakdown,
          transactions: recentTransactions
        }
      });
    } catch (error) {
      console.error('Monthly report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate monthly report'
      });
    }
  }

  async getAdminOverview(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      // Overall system statistics
      const systemStats = this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM passengers WHERE is_active = true) as total_passengers,
          (SELECT COUNT(*) FROM conductors WHERE is_active = true) as total_conductors,
          (SELECT COUNT(*) FROM routes WHERE is_active = true) as total_routes,
          (SELECT COALESCE(SUM(current_balance), 0) FROM passengers WHERE is_active = true) as total_balance
      `).get();

      // Transaction statistics for the period
      const transactionStats = this.db.prepare(`
        SELECT
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN transaction_type = 'boarding' THEN 1 END) as total_boardings,
          COUNT(CASE WHEN transaction_type = 'topup' THEN 1 END) as total_topups,
          COALESCE(SUM(CASE WHEN transaction_type = 'boarding' THEN ABS(amount) ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN transaction_type = 'topup' THEN amount ELSE 0 END), 0) as total_topup_amount
        FROM transactions
        WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
      `).get(start, end);

      // Route performance
      const routePerformance = this.db.prepare(`
        SELECT
          r.name as route_name,
          r.boarding_area,
          COUNT(DISTINCT p.id) as passenger_count,
          COUNT(DISTINCT c.id) as conductor_count,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'boarding' THEN ABS(t.amount) ELSE 0 END), 0) as revenue
        FROM routes r
        LEFT JOIN passengers p ON r.id = p.route_id AND p.is_active = true
        LEFT JOIN conductors c ON r.id = c.assigned_route_id AND c.is_active = true
        LEFT JOIN transactions t ON p.id = t.passenger_id AND DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
        WHERE r.is_active = true
        GROUP BY r.id
        ORDER BY revenue DESC
      `).all(start, end);

      // Top performing conductors
      const topConductors = this.db.prepare(`
        SELECT
          u.full_name as conductor_name,
          r.name as route_name,
          COUNT(t.id) as total_transactions,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'boarding' THEN ABS(t.amount) ELSE 0 END), 0) as revenue
        FROM transactions t
        JOIN conductors c ON t.conductor_id = c.id
        JOIN users u ON c.user_id = u.id
        LEFT JOIN routes r ON c.assigned_route_id = r.id
        WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
        GROUP BY c.id
        ORDER BY revenue DESC
        LIMIT 10
      `).all(start, end);

      // Balance distribution
      const balanceDistribution = this.db.prepare(`
        SELECT
          COUNT(CASE WHEN current_balance > 20 THEN 1 END) as high_balance,
          COUNT(CASE WHEN current_balance BETWEEN 5 AND 20 THEN 1 END) as medium_balance,
          COUNT(CASE WHEN current_balance BETWEEN 0 AND 5 THEN 1 END) as low_balance,
          COUNT(CASE WHEN current_balance < 0 THEN 1 END) as negative_balance
        FROM passengers
        WHERE is_active = true
      `).get();

      res.json({
        success: true,
        data: {
          period: { start, end },
          systemStats,
          transactionStats,
          routePerformance,
          topConductors,
          balanceDistribution
        }
      });
    } catch (error) {
      console.error('Admin overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate admin overview'
      });
    }
  }

  async exportReport(req, res) {
    try {
      const { type } = req.params;
      const { startDate, endDate, conductorId } = req.query;

      // Check permissions
      if (req.user.role !== 'admin' && conductorId && conductorId !== req.user.conductor_id) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      let data = [];
      let filename = '';

      switch (type) {
        case 'transactions':
          const conductorFilter = conductorId ? 'AND t.conductor_id = ?' : '';
          const params = conductorId ? [start, end, conductorId] : [start, end];

          data = this.db.prepare(`
            SELECT
              t.transaction_date,
              p.full_name as passenger_name,
              p.legacy_passenger_id,
              u.full_name as conductor_name,
              r.name as route_name,
              t.transaction_type,
              t.amount,
              t.balance_before,
              t.balance_after
            FROM transactions t
            JOIN passengers p ON t.passenger_id = p.id
            JOIN conductors c ON t.conductor_id = c.id
            JOIN users u ON c.user_id = u.id
            LEFT JOIN routes r ON t.route_id = r.id
            WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?) ${conductorFilter}
            ORDER BY t.transaction_date DESC
          `).all(...params);
          filename = `transactions_${start}_to_${end}.csv`;
          break;

        case 'passengers':
          data = this.db.prepare(`
            SELECT
              p.legacy_passenger_id,
              p.full_name,
              p.ministry,
              p.boarding_area,
              r.name as route_name,
              p.current_balance,
              p.created_at
            FROM passengers p
            LEFT JOIN routes r ON p.route_id = r.id
            WHERE p.is_active = true
            ORDER BY p.full_name
          `).all();
          filename = `passengers_${new Date().toISOString().split('T')[0]}.csv`;
          break;

        case 'daily-summary':
          const conductorFilter2 = conductorId ? 'AND c.id = ?' : '';
          const params2 = conductorId ? [start, end, conductorId] : [start, end];
          data = this.db.prepare(`
            SELECT
              DATE(t.transaction_date) as date,
              u.full_name as conductor_name,
              r.name as route_name,
              COUNT(CASE WHEN t.transaction_type = 'boarding' THEN 1 END) as total_boardings,
              COUNT(DISTINCT t.passenger_id) as unique_passengers,
              COALESCE(SUM(CASE WHEN t.transaction_type = 'boarding' THEN ABS(t.amount) ELSE 0 END), 0) as total_revenue,
              COALESCE(SUM(CASE WHEN t.transaction_type = 'topup' THEN t.amount ELSE 0 END), 0) as total_topups
            FROM transactions t
            JOIN conductors c ON t.conductor_id = c.id
            JOIN users u ON c.user_id = u.id
            LEFT JOIN routes r ON c.assigned_route_id = r.id
            WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?) ${conductorFilter2}
            GROUP BY DATE(t.transaction_date), c.id
            ORDER BY date DESC, conductor_name
          `).all(...params2);
          filename = `daily_summary_${start}_to_${end}.csv`;
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type'
          });
      }

      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No data found for the specified criteria'
        });
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','), // Header row
        ...data.map(row =>
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export report'
      });
    }
  }

  async getPassengerTransactionHistory(req, res) {
    try {
      const { passengerId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Check if passenger belongs to conductor's route (for conductor role)
      if (req.user.role === 'conductor') {
        const passenger = this.dbManager.getPassenger(passengerId);
        const conductor = this.dbManager.getConductor(req.user.conductor_id);

        if (passenger.route_id !== conductor.assigned_route_id) {
          return res.status(403).json({
            success: false,
            error: 'Cannot access passenger from different route'
          });
        }
      }

      const transactions = this.db.prepare(`
        SELECT
          t.id,
          t.transaction_date,
          t.transaction_type,
          t.amount,
          t.balance_before,
          t.balance_after,
          u.full_name as conductor_name,
          r.name as route_name,
          t.notes
        FROM transactions t
        JOIN conductors c ON t.conductor_id = c.id
        JOIN users u ON c.user_id = u.id
        LEFT JOIN routes r ON t.route_id = r.id
        WHERE t.passenger_id = ?
        ORDER BY t.transaction_date DESC
        LIMIT ? OFFSET ?
      `).all(passengerId, parseInt(limit), parseInt(offset));

      const totalCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM transactions WHERE passenger_id = ?
      `).get(passengerId).count;

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
          }
        }
      });
    } catch (error) {
      console.error('Passenger history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get passenger transaction history'
      });
    }
  }
}

const reportController = new ReportController();

module.exports = {
  getConductorDailyReport: reportController.getConductorDailyReport.bind(reportController),
  getConductorWeeklyReport: reportController.getConductorWeeklyReport.bind(reportController),
  getConductorMonthlyReport: reportController.getConductorMonthlyReport.bind(reportController),
  getAdminOverview: reportController.getAdminOverview.bind(reportController),
  exportReport: reportController.exportReport.bind(reportController),
  getPassengerTransactionHistory: reportController.getPassengerTransactionHistory.bind(reportController)
};