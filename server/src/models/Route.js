const { v4: uuidv4 } = require('uuid');

class Route {
  constructor(db) {
    this.db = db;
  }

  create(data) {
    const id = uuidv4();
    // Use CURRENT_TIMESTAMP for SQLite compatibility
    
    const stmt = this.db.prepare(`
      INSERT INTO routes (
        id, name, boarding_area, distance_km, base_fare, 
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      id,
      data.name,
      data.boardingArea,
      data.distanceKm || 0,
      data.baseFare || 0,
      1 // Use 1 instead of true for SQLite boolean compatibility
    );
    
    return this.getById(id);
  }

  getById(id) {
    return this.db.prepare(`
      SELECT * FROM routes WHERE id = ?
    `).get(id);
  }

  getAll() {
    return this.db.prepare(`
      SELECT * FROM routes WHERE is_active = 1 ORDER BY name
    `).all();
  }

  update(id, data) {
    const allowedFields = ['name', 'boarding_area', 'distance_km', 'base_fare'];
    const updates = [];
    const params = [];
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(data[key]);
      }
    });
    
    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE routes SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...params);
    return this.getById(id);
  }

  delete(id) {
    const stmt = this.db.prepare(`
      UPDATE routes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getPassengers(id) {
    return this.db.prepare(`
      SELECT * FROM passengers 
      WHERE route_id = ? AND is_active = 1
      ORDER BY full_name
    `).all(id);
  }

  getConductors(id) {
    return this.db.prepare(`
      SELECT c.*, u.full_name, u.username 
      FROM conductors c
      JOIN users u ON c.user_id = u.id
      WHERE c.assigned_route_id = ? AND c.is_active = 1
      ORDER BY u.full_name
    `).all(id);
  }

  getStatistics(id) {
    return this.db.prepare(`
      SELECT 
        COUNT(DISTINCT p.id) as total_passengers,
        COUNT(DISTINCT c.id) as total_conductors,
        COUNT(DISTINCT t.id) as total_transactions,
        SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_revenue
      FROM routes r
      LEFT JOIN passengers p ON p.route_id = r.id
      LEFT JOIN conductors c ON c.assigned_route_id = r.id
      LEFT JOIN transactions t ON t.route_id = r.id
      WHERE r.id = ?
    `).get(id);
  }
}

module.exports = Route;