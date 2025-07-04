const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../models/database');
const Conductor = require('../models/Conductor');

class ConductorController {
  constructor() {
    this.dbManager = getDatabase(); 
    this.conductor = new Conductor(this.dbManager.db);
  }

  async createConductor(req, res) {
    const db = this.dbManager.db;
    
    try {
      const { username, password, fullName, employeeId } = req.body;

      // Validate input
      if (!username || !password || !fullName) {
        return res.status(400).json({
          success: false,
          error: 'Username, password and full name are required'
        });
      }

      // Check if username exists
      const userExists = db.prepare(
        'SELECT id FROM users WHERE username = ?'
      ).get(username);
      
      if (userExists) {
        return res.status(400).json({
          success: false,
          error: 'Username already exists'
        });
      }

      // Prepare data for insertion
      const userId = uuidv4();
      const conductorId = uuidv4();
      const hashedPassword = bcrypt.hashSync(password, 10);
      const role = 'conductor';
      const isActive = true;
      const now = new Date().toISOString();

      // Start transaction
      db.prepare('BEGIN TRANSACTION').run();

      try {
        // Create user
        db.prepare(`
          INSERT INTO users 
          (id, username, password_hash, role, full_name, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          username.toString(),        // Ensure string
          hashedPassword.toString(),  // Ensure string
          role.toString(),            // Ensure string
          fullName.toString(),        // Ensure string
          isActive ? 1 : 0,           // Convert boolean to number
          now,
          now
        );

        // Create conductor (handle null employeeId)
        db.prepare(`
          INSERT INTO conductors 
          (id, user_id, employee_id, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          conductorId,
          userId,
          employeeId ? employeeId.toString() : null,
          isActive ? 1 : 0,           // Convert boolean to number
          now,
          now
        );

        // Commit transaction
        db.prepare('COMMIT').run();

        // Return success response
        res.status(201).json({
          success: true,
          data: {
            id: conductorId,
            userId,
            username,
            fullName,
            employeeId,
            role,
            isActive
          }
        });

      } catch (error) {
        // Rollback on error
        db.prepare('ROLLBACK').run();
        throw error;
      }

    } catch (error) {
      console.error('Create conductor error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conductor: ' + error.message
      });
    }
  }

  async getConductor(req, res) {
    try {
      const conductor = this.conductor.getById(req.params.id);
      if (!conductor) {
        return res.status(404).json({ success: false, error: 'Conductor not found' });
      }
      res.json({ success: true, data: conductor });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAllConductors(req, res) {
    try {
      const filters = {
        routeId: req.query.routeId,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : undefined
      };

      const conductors = this.conductor.getAll(filters);
      res.json({ success: true, data: conductors });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateConductor(req, res) {
  const db = this.dbManager.db;
  
  try {
    const { id } = req.params;
    const { fullName, employeeId, assignedRouteId } = req.body;

    // Validate input
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Conductor ID is required'
      });
    }

    // Get existing conductor
    const existing = db.prepare(`
      SELECT c.*, u.username, u.full_name as user_full_name 
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Conductor not found'
      });
    }

    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Prepare updates for user table (only fullName)
      if (fullName !== undefined) {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE users 
          SET full_name = ?, updated_at = ? 
          WHERE id = ?
        `).run(fullName, now, existing.user_id);
      }

      // Prepare updates for conductor table
      const conductorUpdates = [];
      const conductorParams = [];
      const now = new Date().toISOString();

      if (employeeId !== undefined) {
        conductorUpdates.push('employee_id = ?');
        conductorParams.push(employeeId ? employeeId.toString() : null);
      }

      if (assignedRouteId !== undefined) {
        conductorUpdates.push('assigned_route_id = ?');
        conductorParams.push(assignedRouteId ? assignedRouteId.toString() : null);
      }

      if (conductorUpdates.length > 0) {
        conductorUpdates.push('updated_at = ?');
        conductorParams.push(now);
        conductorParams.push(id);
        
        const conductorUpdateQuery = `
          UPDATE conductors 
          SET ${conductorUpdates.join(', ')} 
          WHERE id = ?
        `;
        db.prepare(conductorUpdateQuery).run(...conductorParams);
      }

      // Commit transaction
      db.prepare('COMMIT').run();

      // Get updated conductor
      const updatedConductor = db.prepare(`
        SELECT c.*, u.username, u.full_name, r.name as route_name
        FROM conductors c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN routes r ON c.assigned_route_id = r.id
        WHERE c.id = ?
      `).get(id);

      res.json({
        success: true,
        data: updatedConductor
      });

    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }

  } catch (error) {
    console.error('Update conductor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update conductor: ' + error.message
    });
  }
}

  async deleteConductor(req, res) {
    try {
      const result = this.conductor.delete(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getConductorPassengers(req, res) {
    try {
      const passengers = this.conductor.getPassengers(req.params.id);
      res.json({ success: true, data: passengers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getConductorStats(req, res) {
    try {
      const stats = this.conductor.getDailyStats(req.params.id, req.query.date);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getConductorTransactions(req, res) {
    try {
      const transactions = this.conductor.getRecentTransactions(req.params.id, req.query.limit);
      res.json({ success: true, data: transactions });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async assignToRoute(req, res) {
    try {
      const conductor = this.conductor.assignToRoute(req.params.id, req.body.routeId);
      res.json({ success: true, data: conductor });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

const conductorController = new ConductorController();

module.exports = {
  createConductor: conductorController.createConductor.bind(conductorController),
  getConductor: conductorController.getConductor.bind(conductorController),
  getAllConductors: conductorController.getAllConductors.bind(conductorController),
  updateConductor: conductorController.updateConductor.bind(conductorController),
  deleteConductor: conductorController.deleteConductor.bind(conductorController),
  getConductorPassengers: conductorController.getConductorPassengers.bind(conductorController),
  getConductorStats: conductorController.getConductorStats.bind(conductorController),
  getConductorTransactions: conductorController.getConductorTransactions.bind(conductorController),
  assignToRoute: conductorController.assignToRoute.bind(conductorController)
};