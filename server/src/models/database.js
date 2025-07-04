const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
  constructor() {
    // Ensure database directory exists
    const dbDir = path.join(__dirname, '../../database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'bus_system.db');
    this.db = new Database(dbPath);

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');

    this.initializeTables();
    this.createDefaultAdmin();
  }

  initializeTables() {
    // Users table (for authentication)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'conductor')),
        full_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Routes/Locations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        boarding_area TEXT NOT NULL,
        distance_km DECIMAL(5,2),
        base_fare DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conductors table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conductors (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        employee_id TEXT UNIQUE,
        assigned_route_id TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_route_id) REFERENCES routes(id) ON DELETE SET NULL
      )
    `);

    // Passengers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passengers (
        id TEXT PRIMARY KEY,
        legacy_passenger_id INTEGER,
        full_name TEXT NOT NULL,
        ministry TEXT NOT NULL,
        boarding_area TEXT NOT NULL,
        route_id TEXT,
        current_balance DECIMAL(10,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
      )
    `);

    // Transactions table (for boarding history and balance changes)
    // Now includes 'transfer' as a valid transaction type
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        passenger_id TEXT NOT NULL,
        conductor_id TEXT NOT NULL,
        route_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('boarding', 'topup', 'adjustment', 'transfer')),
        amount DECIMAL(10,2) NOT NULL,
        balance_before DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        notes TEXT,
        is_offline BOOLEAN DEFAULT false,
        sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE,
        FOREIGN KEY (conductor_id) REFERENCES conductors(id) ON DELETE CASCADE,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
      )
    `);

    // Fare structure table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fare_structure (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        conductor_id TEXT,
        fare_amount DECIMAL(8,2) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        effective_from DATE NOT NULL,
        effective_to DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
        FOREIGN KEY (conductor_id) REFERENCES conductors(id) ON DELETE SET NULL
      )
    `);

    // Sync queue for offline operations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        attempts INTEGER DEFAULT 0,
        last_attempt DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    this.createIndexes();
  }

  createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_passengers_legacy_id ON passengers(legacy_passenger_id)',
      'CREATE INDEX IF NOT EXISTS idx_passengers_route ON passengers(route_id)',
      'CREATE INDEX IF NOT EXISTS idx_passengers_boarding_area ON passengers(boarding_area)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_passenger ON transactions(passenger_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_conductor ON transactions(conductor_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_conductors_route ON conductors(assigned_route_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)'
    ];

    indexes.forEach(index => {
      try {
        this.db.exec(index);
      } catch (error) {
        console.warn(`Index creation warning: ${error.message}`);
      }
    });
  }

  createDefaultAdmin() {
    const bcrypt = require('bcryptjs');

    const existingAdmin = this.db.prepare(`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `).get();

    if (!existingAdmin) {
      const adminId = uuidv4();
      const hashedPassword = bcrypt.hashSync('admin123', 10);

      this.db.prepare(`
        INSERT INTO users (id, username, password_hash, role, full_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(adminId, 'admin', hashedPassword, 'admin', 'System Administrator');

      console.log('Default admin created - Username: admin, Password: admin123');
    }
  }

  // Passenger methods
  createPassenger(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO passengers (id, legacy_passenger_id, full_name, ministry, boarding_area, route_id, current_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.legacyPassengerId || null,
      data.fullName,
      data.ministry,
      data.boardingArea,
      data.routeId || null,
      data.currentBalance || 0.00
    );

    return this.getPassenger(id);
  }

  getPassenger(id) {
    return this.db.prepare(`
      SELECT p.*, r.name as route_name, r.boarding_area as route_boarding_area
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.id = ?
    `).get(id);
  }

  getPassengersByRoute(routeId) {
    return this.db.prepare(`
      SELECT p.*, r.name as route_name
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.route_id = ? AND p.is_active = true
      ORDER BY p.full_name
    `).all(routeId);
  }

  searchPassengers(query, routeId = null) {
    let sql = `
      SELECT p.*, r.name as route_name
      FROM passengers p
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.is_active = true
      AND (p.full_name LIKE ? OR p.legacy_passenger_id = ?)
    `;

    const params = [`%${query}%`, parseInt(query) || null];

    if (routeId) {
      sql += ` AND p.route_id = ?`;
      params.push(routeId);
    }

    sql += ` ORDER BY p.full_name LIMIT 50`;

    return this.db.prepare(sql).all(...params);
  }

  updatePassengerBalance(passengerId, newBalance, transactionDetails) {
    const transaction = this.db.transaction(() => {
      // Update passenger balance
      this.db.prepare(`
        UPDATE passengers 
        SET current_balance = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newBalance, passengerId);

      // Record transaction
      if (transactionDetails) {
        this.createTransaction({
          passengerId,
          ...transactionDetails,
          balanceAfter: newBalance
        });
      }
    });

    transaction();
    return this.getPassenger(passengerId);
  }

  // Transaction methods
  createTransaction(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        id, passenger_id, conductor_id, route_id, transaction_type,
        amount, balance_before, balance_after, notes, is_offline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.passengerId,
      data.conductorId,
      data.routeId,
      data.transactionType,
      data.amount,
      data.balanceBefore,
      data.balanceAfter,
      data.notes || null,
      data.isOffline || false
    );

    return id;
  }

  // Route methods
  createRoute(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO routes (id, name, boarding_area, distance_km, base_fare)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.name, data.boardingArea, data.distanceKm, data.baseFare);
    return this.getRoute(id);
  }

  getRoute(id) {
    return this.db.prepare('SELECT * FROM routes WHERE id = ?').get(id);
  }

  getAllRoutes() {
    return this.db.prepare('SELECT * FROM routes WHERE is_active = true ORDER BY name').all();
  }

  // Conductor methods
  createConductor(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO conductors (id, user_id, employee_id, assigned_route_id)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, data.userId, data.employeeId, data.assignedRouteId);
    return this.getConductor(id);
  }

  getConductor(id) {
    return this.db.prepare(`
      SELECT c.*, u.full_name, u.username, r.name as route_name
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON c.assigned_route_id = r.id
      WHERE c.id = ?
    `).get(id);
  }

  getConductorByUserId(userId) {
    return this.db.prepare(`
      SELECT c.*, u.full_name, u.username, r.name as route_name
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN routes r ON c.assigned_route_id = r.id
      WHERE c.user_id = ?
    `).get(userId);
  }

  // Report methods
  getDailyReport(conductorId, date) {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_boardings,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_revenue,
        COUNT(DISTINCT passenger_id) as unique_passengers
      FROM transactions
      WHERE conductor_id = ? 
      AND DATE(transaction_date) = DATE(?)
      AND transaction_type = 'boarding'
    `).get(conductorId, date);
  }

  getPassengerTransactions(passengerId, limit = 10) {
    return this.db.prepare(`
      SELECT t.*, c.user_id, u.full_name as conductor_name
      FROM transactions t
      JOIN conductors c ON t.conductor_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE t.passenger_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(passengerId, limit);
  }

  // Utility methods
  close() {
    this.db.close();
  }

  backup() {
    const backupPath = path.join(__dirname, '../../database', `backup_${Date.now()}.db`);
    this.db.backup(backupPath);
    return backupPath;
  }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

module.exports = { getDatabase, DatabaseManager };