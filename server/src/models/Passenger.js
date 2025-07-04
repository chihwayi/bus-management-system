const { v4: uuidv4 } = require('uuid');

class Passenger {
  constructor(db) {
    this.db = db;
  }

  // Create a new passenger - FIXED: Convert boolean to integer for SQLite
create(passengerData) {
  try {
    const {
      legacyPassengerId,
      fullName,
      ministry,
      boardingArea,
      routeId,
      currentBalance = 0.00
    } = passengerData;

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO passengers (
        id,
        legacy_passenger_id,
        full_name,
        ministry,
        boarding_area,
        route_id,
        current_balance,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Execute the statement
    const result = stmt.run(
      id,
      legacyPassengerId ? Number(legacyPassengerId) : null,
      fullName,
      ministry,
      boardingArea,
      routeId || null,
      Number(currentBalance),
      1, // is_active = true
      now,
      now
    );

    // Verify the insert worked
    if (result.changes === 0) {
      throw new Error('Failed to create passenger - no rows affected');
    }

    // Return the newly created passenger
    return this.getById(id);

  } catch (error) {
    console.error('Error in Passenger.create():', error);
    throw error; // Re-throw for controller to handle
  }
}

  // Get passenger by ID
  getById(id) {
    return this.db.prepare(`
      SELECT 
        p.*,
        r.name as route_name,
        r.boarding_area as route_boarding_area,
        r.base_fare
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.id = ?
    `).get(id);
  }

  // Get passenger by legacy ID
  getByLegacyId(legacyId) {
    return this.db.prepare(`
      SELECT 
        p.*,
        r.name as route_name,
        r.boarding_area as route_boarding_area,
        r.base_fare
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.legacy_passenger_id = ?
    `).get(legacyId);
  }

  // Get all passengers with optional filtering
  getAll(filters = {}) {
    let query = `
      SELECT 
        p.*,
        r.name as route_name,
        r.boarding_area as route_boarding_area,
        r.base_fare
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.is_active = true
    `;

    const params = [];

    if (filters.routeId) {
      query += ` AND p.route_id = ?`;
      params.push(filters.routeId);
    }

    if (filters.ministry) {
      query += ` AND p.ministry = ?`;
      params.push(filters.ministry);
    }

    if (filters.boardingArea) {
      query += ` AND p.boarding_area = ?`;
      params.push(filters.boardingArea);
    }

    if (filters.balanceStatus) {
      switch (filters.balanceStatus) {
        case 'positive':
          query += ` AND p.current_balance > 0`;
          break;
        case 'zero':
          query += ` AND p.current_balance = 0`;
          break;
        case 'negative':
          query += ` AND p.current_balance < 0`;
          break;
        case 'low':
          query += ` AND p.current_balance BETWEEN 0 AND 30`;
          break;
      }
    }

    if (filters.search) {
      query += ` AND (
        p.full_name LIKE ? OR 
        p.legacy_passenger_id LIKE ? OR
        p.ministry LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY p.full_name`;

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

  // Update passenger details
  update(id, updateData) {
    const allowedFields = [
      'full_name',
      'ministry',
      'boarding_area',
      'route_id'
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
      UPDATE passengers 
      SET ${updates.join(', ')}
      WHERE id = ? AND is_active = true
    `);

    const result = stmt.run(...params);

    if (result.changes === 0) {
      throw new Error('Passenger not found or no changes made');
    }

    return this.getById(id);
  }

  // Update passenger balance - FIXED: Removed async/await as SQLite better-sqlite3 is synchronous
  updateBalance(id, newBalance, transactionId = null) {
    // Validate and convert types
    id = String(id);
    newBalance = Number(newBalance);
    if (isNaN(newBalance)) {
      throw new Error('Invalid balance value');
    }

    const stmt = this.db.prepare(`
      UPDATE passengers 
      SET current_balance = ?, updated_at = ?
      WHERE id = ? AND is_active = true
    `);

    const result = stmt.run(
      newBalance,
      new Date().toISOString(),
      id
    );

    if (result.changes === 0) {
      throw new Error('Passenger not found or no changes made');
    }

    return this.getById(id);
  }

  // Deduct fare from passenger balance - FIXED: Parameter sanitization and null handling
  deductFare(id, fareAmount, conductorId, routeId) {
    // Validate and convert types - ensure all are proper SQLite-compatible types
    if (!this.db.prepare('SELECT id FROM conductors WHERE id = ?').get(conductorId)) {
      throw new Error(`Invalid conductor ID: ${conductorId}`);
    }

    if (!this.db.prepare('SELECT id FROM routes WHERE id = ?').get(routeId)) {
      throw new Error(`Invalid route ID: ${routeId}`);
    }

    id = String(id);
    fareAmount = Number(fareAmount);
    if (isNaN(fareAmount) || fareAmount <= 0) {
      throw new Error('Invalid fare amount');
    }

    // Ensure conductorId and routeId are properly handled
    conductorId = conductorId ? String(conductorId) : null;
    routeId = routeId ? String(routeId) : null;

    const passenger = this.getById(id);
    if (!passenger) {
      throw new Error('Passenger not found');
    }

    if (passenger.current_balance < fareAmount) {
      throw new Error('Insufficient balance');
    }

    const newBalance = passenger.current_balance - fareAmount;

    // Update balance (synchronous)
    this.updateBalance(id, newBalance);

    // Create transaction record with proper parameter types
    const transactionId = uuidv4();

    // Convert all values to proper SQLite-compatible types
    const transactionParams = [
      transactionId,
      id,
      conductorId,
      routeId,
      'boarding',
      Number(-fareAmount), // Explicitly convert to Number
      Number(passenger.current_balance),
      Number(newBalance),
      'Bus boarding fare deduction',
      0 // Use 0 instead of false for SQLite boolean
    ];

    try {
      const stmt = this.db.prepare(`
            INSERT INTO transactions (
                id, passenger_id, conductor_id, route_id, transaction_type,
                amount, balance_before, balance_after, notes, is_offline,
                transaction_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

      stmt.run(...transactionParams);
    } catch (error) {
      console.error('SQLite binding error in deductFare:', error);
      console.error('Parameters that caused error:', transactionParams);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return this.getById(id);
  }

  // Add balance to passenger (top-up) - FIXED: Removed async/await and parameter handling
  addBalance(id, amount, conductorId, routeId, notes = null) {
    // Convert and validate parameters first - CRITICAL FIX
    id = String(id);
    amount = Number(amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }

    // Ensure conductorId and routeId are properly handled
    conductorId = conductorId ? String(conductorId) : null;
    routeId = routeId ? String(routeId) : null;
    notes = notes ? String(notes) : 'Balance top-up';

    const passenger = this.getById(id);
    if (!passenger) {
      throw new Error('Passenger not found');
    }

    const newBalance = passenger.current_balance + amount;

    // Update balance (synchronous)
    this.updateBalance(id, newBalance);

    // Create transaction record with proper parameter handling - CRITICAL FIX
    const transactionId = uuidv4();

    // FIXED: Convert boolean to integer for SQLite compatibility
    const params = [
      transactionId,
      id,
      conductorId,  // Already converted to string or null above
      routeId,      // Already converted to string or null above
      'topup',
      amount,
      passenger.current_balance,
      newBalance,
      notes,
      0  // FIXED: Use 0 instead of false for SQLite boolean compatibility
    ];

    console.log('Transaction parameters for addBalance:', params);

    try {
      const stmt = this.db.prepare(`
      INSERT INTO transactions (
        id, passenger_id, conductor_id, route_id, transaction_type,
        amount, balance_before, balance_after, notes, is_offline,
        transaction_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

      stmt.run(...params);
    } catch (error) {
      console.error('SQLite binding error in addBalance:', error);
      console.error('Parameters that caused error:', params);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return this.getById(id);
  }

  // Transfer passenger to different route - FIXED: Parameter handling
  transferToRoute(id, newRouteId, conductorId) {
    // Sanitize parameters
    id = String(id);
    newRouteId = newRouteId ? String(newRouteId) : null;
    conductorId = conductorId ? String(conductorId) : null;

    const passenger = this.getById(id);

    if (!passenger) {
      throw new Error('Passenger not found');
    }

    const stmt = this.db.prepare(`
    UPDATE passengers 
    SET route_id = ?, updated_at = ?
    WHERE id = ? AND is_active = true
  `);

    const result = stmt.run(newRouteId, new Date().toISOString(), id);

    if (result.changes === 0) {
      throw new Error('Failed to transfer passenger');
    }

    // Log the transfer - FIXED parameter handling
    const transactionId = uuidv4();

    const transferParams = [
      transactionId,
      id,
      conductorId,
      newRouteId,
      'transfer',
      0,
      passenger.current_balance,
      passenger.current_balance,
      `Transferred from route ${passenger.route_name || 'unknown'} to new route`,
      0  // FIXED: Use 0 instead of false for SQLite boolean compatibility
    ];

    try {
      const transferStmt = this.db.prepare(`
      INSERT INTO transactions (
        id, passenger_id, conductor_id, route_id, transaction_type,
        amount, balance_before, balance_after, notes, is_offline,
        transaction_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

      transferStmt.run(...transferParams);
    } catch (error) {
      console.error('SQLite binding error in transferToRoute:', error);
      console.error('Parameters that caused error:', transferParams);
      // Don't throw here as the main operation (route transfer) succeeded
    }

    return this.getById(id);
  }
  // Soft delete passenger
  delete(id) {
  const stmt = this.db.prepare(`
    UPDATE passengers 
    SET is_active = 0, updated_at = ?  -- Use 0 instead of false
    WHERE id = ? AND is_active = 1     -- Use 1 instead of true
  `);

  const result = stmt.run(
    new Date().toISOString(), 
    String(id)
  );

  if (result.changes === 0) {
    throw new Error('Passenger not found or already deleted');
  }

  return { success: true, message: 'Passenger deleted successfully' };
}

// Fixed restore method
restore(id) {
  const stmt = this.db.prepare(`
    UPDATE passengers 
    SET is_active = 1, updated_at = ?  -- Use 1 instead of true
    WHERE id = ? AND is_active = 0     -- Use 0 instead of false
  `);

  const result = stmt.run(
    new Date().toISOString(), 
    String(id)
  );

  if (result.changes === 0) {
    throw new Error('Passenger not found or already active');
  }

  return this.getById(id);
}
  // Get passenger statistics
  getStatistics(routeId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_passengers,
        COUNT(CASE WHEN current_balance > 0 THEN 1 END) as positive_balance,
        COUNT(CASE WHEN current_balance = 0 THEN 1 END) as zero_balance,
        COUNT(CASE WHEN current_balance < 0 THEN 1 END) as negative_balance,
        COUNT(CASE WHEN current_balance BETWEEN 0 AND 30 THEN 1 END) as low_balance,
        SUM(current_balance) as total_balance,
        AVG(current_balance) as average_balance,
        MIN(current_balance) as min_balance,
        MAX(current_balance) as max_balance
      FROM passengers 
      WHERE is_active = true
    `;

    const params = [];
    if (routeId) {
      query += ` AND route_id = ?`;
      params.push(routeId);
    }

    return this.db.prepare(query).get(...params);
  }

  // Get passengers with low balance
  getLowBalancePassengers(threshold = 5, routeId = null) {
    let query = `
      SELECT 
        p.*,
        r.name as route_name,
        r.boarding_area as route_boarding_area
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.is_active = true AND p.current_balance <= ?
    `;

    const params = [threshold];

    if (routeId) {
      query += ` AND p.route_id = ?`;
      params.push(routeId);
    }

    query += ` ORDER BY p.current_balance ASC, p.full_name`;

    return this.db.prepare(query).all(...params);
  }

  // Get passenger transaction history
  getTransactionHistory(id, limit = 20) {
    return this.db.prepare(`
      SELECT 
        t.*,
        c.user_id,
        u.full_name as conductor_name,
        r.name as route_name
      FROM transactions t
      LEFT JOIN conductors c ON t.conductor_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON t.route_id = r.id
      WHERE t.passenger_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(id, limit);
  }

  // Bulk update passengers
  bulkUpdate(updates) {
    const transaction = this.db.transaction(() => {
      updates.forEach(update => {
        this.update(update.id, update.data);
      });
    });

    transaction();
    return { success: true, message: `Updated ${updates.length} passengers` };
  }

  // Search passengers with advanced filters
  search(searchParams) {
    const {
      query,
      routeId,
      ministry,
      boardingArea,
      balanceMin,
      balanceMax,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0
    } = searchParams;

    let sql = `
      SELECT 
        p.*,
        r.name as route_name,
        r.boarding_area as route_boarding_area,
        r.base_fare
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.is_active = true
    `;

    const params = [];

    if (query) {
      sql += ` AND (
        p.full_name LIKE ? OR 
        p.legacy_passenger_id = ? OR
        p.ministry LIKE ?
      )`;
      params.push(`%${query}%`, parseInt(query) || null, `%${query}%`);
    }

    if (routeId) {
      sql += ` AND p.route_id = ?`;
      params.push(routeId);
    }

    if (ministry) {
      sql += ` AND p.ministry = ?`;
      params.push(ministry);
    }

    if (boardingArea) {
      sql += ` AND p.boarding_area = ?`;
      params.push(boardingArea);
    }

    if (balanceMin !== undefined) {
      sql += ` AND p.current_balance >= ?`;
      params.push(balanceMin);
    }

    if (balanceMax !== undefined) {
      sql += ` AND p.current_balance <= ?`;
      params.push(balanceMax);
    }

    if (dateFrom) {
      sql += ` AND p.created_at >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND p.created_at <= ?`;
      params.push(dateTo);
    }

    sql += ` ORDER BY p.full_name LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params);
  }

  // Get balance color status for UI
  getBalanceStatus(balance) {
    if (balance < 0) return 'danger';
    if (balance === 0) return 'red';
    if (balance <= 5) return 'orange';
    return 'green';
  }

  // Validate passenger data
  validateData(data) {
    const errors = [];

    if (!data.fullName || data.fullName.trim().length === 0) {
      errors.push('Full name is required');
    }

    if (!data.ministry || data.ministry.trim().length === 0) {
      errors.push('Ministry is required');
    }

    if (!data.boardingArea || data.boardingArea.trim().length === 0) {
      errors.push('Boarding area is required');
    }

    if (data.currentBalance !== undefined && isNaN(data.currentBalance)) {
      errors.push('Current balance must be a valid number');
    }

    if (data.legacyPassengerId && !Number.isInteger(data.legacyPassengerId)) {
      errors.push('Legacy passenger ID must be an integer');
    }

    return errors;
  }
}

module.exports = Passenger;