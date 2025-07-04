const { getDatabase } = require('../models/database');

class BoardingController {
  constructor() {
    this.dbManager = getDatabase();
  }

  async getConductorTodayStats(req, res) {
    try {
      const userId = req.user.id;

      // Get conductor info
      const conductor = this.dbManager.getConductorByUserId(userId);
      if (!conductor) {
        return res.status(404).json({
          success: false,
          error: 'Conductor not found'
        });
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Get today's boarding statistics
      const stats = this.dbManager.getDailyReport(conductor.id, today);

      // Get additional conductor info
      const conductorInfo = {
        id: conductor.id,
        name: conductor.full_name,
        employeeId: conductor.employee_id,
        routeName: conductor.route_name,
        routeId: conductor.assigned_route_id
      };

      res.json({
        success: true,
        data: {
          conductor: conductorInfo,
          stats: {
            totalBoardings: stats.total_boardings || 0,
            totalRevenue: stats.total_revenue || 0,
            uniquePassengers: stats.unique_passengers || 0,
            date: today
          }
        }
      });

    } catch (error) {
      console.error('Get conductor today stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conductor statistics',
        details: error.message
      });
    }
  }

  async getRecentBoardings(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;
      const today = new Date().toISOString().split('T')[0]; // Get today's date

      // Get conductor info
      const conductor = this.dbManager.getConductorByUserId(userId);
      if (!conductor) {
        return res.status(404).json({
          success: false,
          error: 'Conductor not found'
        });
      }

      // Get recent boarding transactions for this conductor from today only
      const recentBoardings = this.dbManager.db.prepare(`
      SELECT 
        t.id,
        t.passenger_id,
        t.amount,
        t.balance_before,
        t.balance_after,
        t.transaction_date,
        t.notes,
        p.full_name as passenger_name,
        p.ministry,
        p.boarding_area,
        r.name as route_name
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.conductor_id = ? 
      AND t.transaction_type = 'boarding'
      AND DATE(t.transaction_date) = DATE(?)
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(conductor.id, today, limit);

      res.json({
        success: true,
        data: {
          conductor: {
            id: conductor.id,
            name: conductor.full_name,
            routeName: conductor.route_name
          },
          boardings: recentBoardings
        }
      });

    } catch (error) {
      console.error('Get recent boardings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent boardings',
        details: error.message
      });
    }
  }

  async getTodayConductorsStats(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all conductors with their today's statistics
      const conductorsStats = this.dbManager.db.prepare(`
        SELECT 
          c.id,
          c.employee_id,
          u.full_name,
          u.username,
          r.name as route_name,
          r.id as route_id,
          COUNT(t.id) as total_boardings,
          SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_revenue,
          COUNT(DISTINCT t.passenger_id) as unique_passengers,
          MAX(t.transaction_date) as last_boarding_time
        FROM conductors c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN routes r ON c.assigned_route_id = r.id
        LEFT JOIN transactions t ON c.id = t.conductor_id 
          AND DATE(t.transaction_date) = DATE(?)
          AND t.transaction_type = 'boarding'
        WHERE c.is_active = 1
        GROUP BY c.id, c.employee_id, u.full_name, u.username, r.name, r.id
        ORDER BY total_revenue DESC, u.full_name
      `).all(today);

      res.json({
        success: true,
        data: {
          date: today,
          conductors: conductorsStats.map(conductor => ({
            id: conductor.id,
            employeeId: conductor.employee_id,
            name: conductor.full_name,
            username: conductor.username,
            routeName: conductor.route_name || 'Unassigned',
            routeId: conductor.route_id,
            stats: {
              totalBoardings: conductor.total_boardings || 0,
              totalRevenue: conductor.total_revenue || 0,
              uniquePassengers: conductor.unique_passengers || 0,
              lastBoardingTime: conductor.last_boarding_time
            }
          }))
        }
      });

    } catch (error) {
      console.error('Get today conductors stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conductors statistics',
        details: error.message
      });
    }
  }

  async getTodayRoutesStats(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all routes with their today's statistics
      const routesStats = this.dbManager.db.prepare(`
        SELECT 
          r.id,
          r.name,
          r.boarding_area,
          r.base_fare,
          COUNT(DISTINCT c.id) as active_conductors,
          COUNT(t.id) as total_boardings,
          SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_revenue,
          COUNT(DISTINCT t.passenger_id) as unique_passengers,
          MAX(t.transaction_date) as last_boarding_time
        FROM routes r
        LEFT JOIN conductors c ON r.id = c.assigned_route_id AND c.is_active = 1
        LEFT JOIN transactions t ON r.id = t.route_id 
          AND DATE(t.transaction_date) = DATE(?)
          AND t.transaction_type = 'boarding'
        WHERE r.is_active = 1
        GROUP BY r.id, r.name, r.boarding_area, r.base_fare
        ORDER BY total_revenue DESC, r.name
      `).all(today);

      res.json({
        success: true,
        data: {
          date: today,
          routes: routesStats.map(route => ({
            id: route.id,
            name: route.name,
            boardingArea: route.boarding_area,
            baseFare: route.base_fare,
            activeConductors: route.active_conductors || 0,
            stats: {
              totalBoardings: route.total_boardings || 0,
              totalRevenue: route.total_revenue || 0,
              uniquePassengers: route.unique_passengers || 0,
              lastBoardingTime: route.last_boarding_time
            }
          }))
        }
      });

    } catch (error) {
      console.error('Get today routes stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get routes statistics',
        details: error.message
      });
    }
  }

  // Additional method to record a boarding transaction
  async recordBoarding(req, res) {
    try {
      const userId = req.user.id;
      const { passengerId, amount, routeId, notes } = req.body;

      // Validate required fields
      if (!passengerId || !amount || !routeId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: passengerId, amount, routeId'
        });
      }

      // Get conductor info
      const conductor = this.dbManager.getConductorByUserId(userId);
      if (!conductor) {
        return res.status(404).json({
          success: false,
          error: 'Conductor not found'
        });
      }

      // Get passenger current balance
      const passenger = this.dbManager.getPassenger(passengerId);
      if (!passenger) {
        return res.status(404).json({
          success: false,
          error: 'Passenger not found'
        });
      }

      const balanceBefore = passenger.current_balance;
      const balanceAfter = balanceBefore - Math.abs(amount); // Subtract fare

      // Create boarding transaction
      const transactionId = this.dbManager.createTransaction({
        passengerId,
        conductorId: conductor.id,
        routeId,
        transactionType: 'boarding',
        amount: -Math.abs(amount), // Negative for boarding charges
        balanceBefore,
        balanceAfter,
        notes
      });

      // Update passenger balance
      this.dbManager.updatePassengerBalance(passengerId, balanceAfter);

      res.json({
        success: true,
        data: {
          transactionId,
          passengerId,
          balanceBefore,
          balanceAfter,
          amount: -Math.abs(amount)
        }
      });

    } catch (error) {
      console.error('Record boarding error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record boarding',
        details: error.message
      });
    }
  }
}

const boardingController = new BoardingController();

module.exports = {
  getConductorTodayStats: boardingController.getConductorTodayStats.bind(boardingController),
  getRecentBoardings: boardingController.getRecentBoardings.bind(boardingController),
  getTodayConductorsStats: boardingController.getTodayConductorsStats.bind(boardingController),
  getTodayRoutesStats: boardingController.getTodayRoutesStats.bind(boardingController),
  recordBoarding: boardingController.recordBoarding.bind(boardingController)
};