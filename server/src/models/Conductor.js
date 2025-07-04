const { v4: uuidv4 } = require('uuid');

class Conductor {
  constructor(db) {
    this.db = db;
  }

  // Create a new conductor
  create(conductorData) {
    const {
      userId,
      employeeId,
      assignedRouteId
    } = conductorData;

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO conductors (
        id,
        user_id,
        employee_id,
        assigned_route_id,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      id,
      userId,
      employeeId,
      assignedRouteId,
      true,
      now,
      now
    );

    return this.getById(id);
  }

  // Get conductor by ID
  getById(id) {
    return this.db.prepare(`
      SELECT 
        c.*,
        u.full_name,
        u.username,
        u.is_active as user_active,
        r.name as route_name,
        r.boarding_area,
        r.base_fare
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON c.assigned_route_id = r.id
      WHERE c.id = ?
    `).get(id);
  }

  // Get conductor by user ID
  getByUserId(userId) {
    return this.db.prepare(`
      SELECT 
        c.*,
        u.full_name,
        u.username,
        u.is_active as user_active,
        r.name as route_name,
        r.boarding_area,
        r.base_fare
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON c.assigned_route_id = r.id
      WHERE c.user_id = ?
    `).get(userId);
  }

  // Get conductor by employee ID
  getByEmployeeId(employeeId) {
    return this.db.prepare(`
      SELECT 
        c.*,
        u.full_name,
        u.username,
        u.is_active as user_active,
        r.name as route_name,
        r.boarding_area,
        r.base_fare
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON c.assigned_route_id = r.id
      WHERE c.employee_id = ?
    `).get(employeeId);
  }

  // Get all conductors with optional filtering
  getAll(filters = {}) {
    let query = `
      SELECT 
        c.*,
        u.full_name,
        u.username,
        u.is_active as user_active,
        r.name as route_name,
        r.boarding_area,
        r.base_fare
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON c.assigned_route_id = r.id
      WHERE c.is_active = true
    `;
    
    const params = [];

    if (filters.routeId) {
      query += ` AND c.assigned_route_id = ?`;
      params.push(filters.routeId);
    }

    if (filters.isActive !== undefined) {
      query += ` AND u.is_active = ?`;
      params.push(filters.isActive);
    }

    if (filters.search) {
      query += ` AND (
        u.full_name LIKE ? OR 
        u.username LIKE ? OR
        c.employee_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY u.full_name`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    return this.db.prepare(query).all(...params);
  }

  // Update conductor details
  update(id, updateData) {
    const allowedFields = [
      'employee_id',
      'assigned_route_id'
    ];

    const updates = [];
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(updateData[key]);
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = this.db.prepare(`
      UPDATE conductors 
      SET ${updates.join(', ')}
      WHERE id = ? AND is_active = true
    `);

    const result = stmt.run(...params);
    
    if (result.changes === 0) {
      throw new Error('Conductor not found or no changes made');
    }

    return this.getById(id);
  }

  // Assign conductor to route
  assignToRoute(id, routeId) {
    const stmt = this.db.prepare(`
      UPDATE conductors 
      SET assigned_route_id = ?, updated_at = ?
      WHERE id = ? AND is_active = true
    `);

    const result = stmt.run(routeId, new Date().toISOString(), id);
    
    if (result.changes === 0) {
      throw new Error('Conductor not found');
    }

    return this.getById(id);
  }

  // Remove conductor from route
  removeFromRoute(id) {
    const stmt = this.db.prepare(`
      UPDATE conductors 
      SET assigned_route_id = NULL, updated_at = ?
      WHERE id = ? AND is_active = true
    `);

    const result = stmt.run(new Date().toISOString(), id);
    
    if (result.changes === 0) {
      throw new Error('Conductor not found');
    }

    return this.getById(id);
  }

  // Get conductor's passengers
  getPassengers(id) {
    const conductor = this.getById(id);
    if (!conductor || !conductor.assigned_route_id) {
      return [];
    }

    return this.db.prepare(`
      SELECT 
        p.*,
        r.name as route_name,
        r.boarding_area as route_boarding_area,
        r.base_fare
      FROM passengers p
      JOIN routes r ON p.route_id = r.id
      WHERE p.route_id = ? AND p.is_active = true
      ORDER BY p.full_name
    `).all(conductor.assigned_route_id);
  }

  // Get conductor's daily statistics
  getDailyStats(id, date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_boardings,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_revenue,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COUNT(CASE WHEN transaction_type = 'topup' THEN 1 END) as topups,
        SUM(CASE WHEN transaction_type = 'topup' THEN amount ELSE 0 END) as topup_amount
      FROM transactions
      WHERE conductor_id = ? 
      AND DATE(transaction_date) = DATE(?)
    `).get(id, targetDate);
  }

  // Get conductor's weekly statistics
  getWeeklyStats(id, startDate = null) {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];
    
    return this.db.prepare(`
      SELECT 
        DATE(transaction_date) as date,
        COUNT(*) as total_boardings,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_revenue,
        COUNT(DISTINCT passenger_id) as unique_passengers
      FROM transactions
      WHERE conductor_id = ? 
      AND DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY DATE(transaction_date)
      ORDER BY date DESC
    `).all(id, start, end);
  }

  // Get conductor's monthly statistics
  getMonthlyStats(id, year = null, month = null) {
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || currentDate.getMonth() + 1;
    
    return this.db.prepare(`
      SELECT 
        strftime('%Y-%m-%d', transaction_date) as date,
        COUNT(*) as total_boardings,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_revenue,
        COUNT(DISTINCT passenger_id) as unique_passengers
      FROM transactions
      WHERE conductor_id = ? 
      AND strftime('%Y', transaction_date) = ?
      AND strftime('%m', transaction_date) = ?
      GROUP BY strftime('%Y-%m-%d', transaction_date)
      ORDER BY date DESC
    `).all(id, targetYear.toString(), targetMonth.toString().padStart(2, '0'));
  }

  // Get conductor's recent transactions
  getRecentTransactions(id, limit = 50) {
    return this.db.prepare(`
      SELECT 
        t.*,
        p.full_name as passenger_name,
        p.legacy_passenger_id,
        r.name as route_name
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.conductor_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(id, limit);
  }

  // Soft delete conductor
  delete(id) {
    const stmt = this.db.prepare(`
      UPDATE conductors 
      SET is_active = false, updated_at = ?
      WHERE id = ? AND is_active = true
    `);

    const result = stmt.run(new Date().toISOString(), id);
    
    if (result.changes === 0) {
      throw new Error('Conductor not found or already deleted');
    }

    return { success: true, message: 'Conductor deleted successfully' };
  }

  // Restore soft deleted conductor
  restore(id) {
    const stmt = this.db.prepare(`
      UPDATE conductors 
      SET is_active = true, updated_at = ?
      WHERE id = ? AND is_active = false
    `);

    const result = stmt.run(new Date().toISOString(), id);
    
    if (result.changes === 0) {
      throw new Error('Conductor not found or already active');
    }

    return this.getById(id);
  }

  // Get conductors by route
  getByRoute(routeId) {
    return this.db.prepare(`
      SELECT 
        c.*,
        u.full_name,
        u.username,
        u.is_active as user_active
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      WHERE c.assigned_route_id = ? AND c.is_active = true
      ORDER BY u.full_name
    `).all(routeId);
  }

  // Get unassigned conductors
  getUnassigned() {
    return this.db.prepare(`
      SELECT 
        c.*,
        u.full_name,
        u.username,
        u.is_active as user_active
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      WHERE c.assigned_route_id IS NULL AND c.is_active = true
      ORDER BY u.full_name
    `).all();
  }

  // Validate conductor data
  validateData(data) {
    const errors = [];

    if (!data.userId) {
      errors.push('User ID is required');
    }

    if (data.employeeId && typeof data.employeeId !== 'string') {
      errors.push('Employee ID must be a string');
    }

    // Check if user exists and is not already a conductor
    if (data.userId) {
      const existingUser = this.db.prepare('SELECT id, role FROM users WHERE id = ?').get(data.userId);
      if (!existingUser) {
        errors.push('User does not exist');
      } else if (existingUser.role !== 'conductor') {
        errors.push('User must have conductor role');
      }

      const existingConductor = this.getByUserId(data.userId);
      if (existingConductor) {
        errors.push('User is already assigned as a conductor');
      }
    }

    // Check if employee ID is unique
    if (data.employeeId) {
      const existingEmployee = this.getByEmployeeId(data.employeeId);
      if (existingEmployee) {
        errors.push('Employee ID already exists');
      }
    }

    return errors;
  }

  // Bulk assign conductors to routes
  bulkAssignToRoutes(assignments) {
    const transaction = this.db.transaction(() => {
      assignments.forEach(assignment => {
        this.assignToRoute(assignment.conductorId, assignment.routeId);
      });
    });

    transaction();
    return { success: true, message: `Assigned ${assignments.length} conductors to routes` };
  }

  // Get conductor performance metrics
  getPerformanceMetrics(id, startDate, endDate) {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN transaction_type = 'boarding' THEN 1 END) as boardings,
        COUNT(CASE WHEN transaction_type = 'topup' THEN 1 END) as topups,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as fare_collected,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as topups_processed,
        COUNT(DISTINCT passenger_id) as unique_passengers_served
        FROM transactions
      WHERE conductor_id = ?
      AND DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
    `).get(id, startDate, endDate);
  }

  // Get conductor's top passengers
  getTopPassengers(id, limit = 5) {
    return this.db.prepare(`
      SELECT 
        p.id,
        p.full_name,
        p.legacy_passenger_id,
        COUNT(*) as boarding_count,
        SUM(ABS(t.amount)) as total_fare_paid
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      WHERE t.conductor_id = ?
      AND t.transaction_type = 'boarding'
      GROUP BY p.id
      ORDER BY boarding_count DESC
      LIMIT ?
    `).all(id, limit);
  }

  // Get conductor's route history
  getRouteHistory(id) {
    return this.db.prepare(`
      SELECT 
        r.id,
        r.name,
        r.boarding_area,
        COUNT(DISTINCT DATE(t.transaction_date)) as days_worked,
        COUNT(t.id) as total_transactions
      FROM transactions t
      JOIN routes r ON t.route_id = r.id
      WHERE t.conductor_id = ?
      GROUP BY r.id
      ORDER BY days_worked DESC
    `).all(id);
  }

  // Get conductor's activity timeline
  getActivityTimeline(id, limit = 30) {
    return this.db.prepare(`
      SELECT 
        DATE(transaction_date) as date,
        COUNT(*) as transactions,
        COUNT(DISTINCT passenger_id) as passengers,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as revenue
      FROM transactions
      WHERE conductor_id = ?
      GROUP BY DATE(transaction_date)
      ORDER BY date DESC
      LIMIT ?
    `).all(id, limit);
  }
}

module.exports = Conductor;