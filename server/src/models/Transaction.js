const { v4: uuidv4 } = require('uuid');

class Transaction {
  constructor(db) {
    this.db = db;
  }

  create(data) {
    const id = uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        id, passenger_id, conductor_id, route_id, transaction_type,
        amount, balance_before, balance_after, notes, is_offline,
        sync_status, transaction_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.isOffline || false,
      data.syncStatus || 'synced',
      data.transactionDate || new Date().toISOString(),
      new Date().toISOString()
    );
    
    return this.getById(id);
  }

  getById(id) {
    return this.db.prepare(`
      SELECT t.*, 
        p.full_name as passenger_name,
        p.legacy_passenger_id,
        c.user_id as conductor_user_id,
        u.full_name as conductor_name,
        r.name as route_name
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN conductors c ON t.conductor_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.id = ?
    `).get(id);
  }

  getByPassenger(passengerId, limit = 50) {
    return this.db.prepare(`
      SELECT t.*, 
        c.user_id as conductor_user_id,
        u.full_name as conductor_name,
        r.name as route_name
      FROM transactions t
      JOIN conductors c ON t.conductor_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.passenger_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(passengerId, limit);
  }

  getByConductor(conductorId, limit = 50) {
    return this.db.prepare(`
      SELECT t.*, 
        p.full_name as passenger_name,
        p.legacy_passenger_id,
        r.name as route_name
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.conductor_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(conductorId, limit);
  }

  getByRoute(routeId, limit = 50) {
    return this.db.prepare(`
      SELECT t.*, 
        p.full_name as passenger_name,
        p.legacy_passenger_id,
        c.user_id as conductor_user_id,
        u.full_name as conductor_name
      FROM transactions t
      JOIN passengers p ON t.passenger_id = p.id
      JOIN conductors c ON t.conductor_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE t.route_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT ?
    `).all(routeId, limit);
  }

  getPendingSync() {
    return this.db.prepare(`
      SELECT * FROM transactions 
      WHERE sync_status = 'pending' 
      ORDER BY created_at
    `).all();
  }

  markAsSynced(id) {
    const stmt = this.db.prepare(`
      UPDATE transactions 
      SET sync_status = 'synced' 
      WHERE id = ?
    `);
    
    return stmt.run(id).changes > 0;
  }

  getDailySummary(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    return this.db.prepare(`
      SELECT 
        DATE(transaction_date) as date,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT passenger_id) as unique_passengers,
        COUNT(DISTINCT conductor_id) as active_conductors,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_revenue,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_topups
      FROM transactions
      WHERE DATE(transaction_date) = DATE(?)
    `).get(targetDate);
  }
}

module.exports = Transaction;