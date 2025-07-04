const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');

// Add debug logging and fallback for JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;

// Debug logging (remove after fixing)
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not defined in environment variables');
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('JWT')));
}

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Check if JWT_SECRET is available
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET is undefined during token verification');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error. Please contact administrator.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
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
    console.error('Auth middleware error:', error.message);
    
    // More specific error handling
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format.'
      });
    }
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed.'
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
/*
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
*/