const { v4: uuidv4 } = require('uuid');

class FareStructure {
  constructor(db) {
    this.db = db;
  }

  create(data) {
    const id = uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT INTO fare_structure (
        id, route_id, conductor_id, fare_amount, 
        is_default, effective_from, effective_to, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.routeId,
      data.conductorId || null,
      data.fareAmount,
      data.isDefault || false,
      data.effectiveFrom || new Date().toISOString(),
      data.effectiveTo || null,
      new Date().toISOString()
    );
    
    return this.getById(id);
  }

  getById(id) {
    return this.db.prepare(`
      SELECT f.*, 
        r.name as route_name,
        c.user_id as conductor_user_id,
        u.full_name as conductor_name
      FROM fare_structure f
      LEFT JOIN routes r ON f.route_id = r.id
      LEFT JOIN conductors c ON f.conductor_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE f.id = ?
    `).get(id);
  }

  getCurrentFare(routeId, conductorId = null) {
    const now = new Date().toISOString();
    
    return this.db.prepare(`
      SELECT * FROM fare_structure
      WHERE route_id = ?
      AND (conductor_id = ? OR conductor_id IS NULL)
      AND (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))
      ORDER BY is_default DESC, conductor_id DESC
      LIMIT 1
    `).get(routeId, conductorId, now, now);
  }

  getByRoute(routeId) {
    return this.db.prepare(`
      SELECT f.*, 
        c.user_id as conductor_user_id,
        u.full_name as conductor_name
      FROM fare_structure f
      LEFT JOIN conductors c ON f.conductor_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE f.route_id = ?
      ORDER BY f.effective_from DESC
    `).all(routeId);
  }

  update(id, data) {
    const allowedFields = ['fare_amount', 'effective_from', 'effective_to'];
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
    
    params.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE fare_structure SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...params);
    return this.getById(id);
  }

  delete(id) {
    const stmt = this.db.prepare('DELETE FROM fare_structure WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  setDefault(routeId, fareId) {
    const transaction = this.db.transaction(() => {
      // Clear any existing default for this route
      this.db.prepare(`
        UPDATE fare_structure 
        SET is_default = false 
        WHERE route_id = ?
      `).run(routeId);
      
      // Set new default
      this.db.prepare(`
        UPDATE fare_structure 
        SET is_default = true 
        WHERE id = ? AND route_id = ?
      `).run(fareId, routeId);
    });
    
    transaction();
    return this.getById(fareId);
  }
}

module.exports = FareStructure;