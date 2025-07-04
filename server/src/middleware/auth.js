// auth.js - FIXED
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const dbManager = getDatabase();
    
    // ✅ Use dbManager.db instead of db.db
    const user = dbManager.db.prepare(`
      SELECT u.*, c.id as conductor_id, c.assigned_route_id
      FROM users u
      LEFT JOIN conductors c ON u.id = c.user_id
      WHERE u.id = ? AND u.is_active = true
    `).get(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token.'
    });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = { auth, requireRole };