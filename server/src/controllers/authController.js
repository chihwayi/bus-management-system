const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');

const authController = {
  // Login user
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      const db = getDatabase();
      const user = db.db.prepare(`
        SELECT u.*, c.id as conductor_id, c.assigned_route_id
        FROM users u
        LEFT JOIN conductors c ON u.id = c.user_id
        WHERE u.username = ? AND u.is_active = true
      `).get(username);

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Remove sensitive data
      delete user.password_hash;

      res.json({
        success: true,
        data: {
          user,
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  },

  // Get current user
  async getMe(req, res) {
    try {
      const user = { ...req.user };
      delete user.password_hash;
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user data'
      });
    }
  },

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 6 characters long'
        });
      }

      const db = getDatabase();
      const user = db.db.prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(req.user.id);

      if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      
      db.db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashedPassword, req.user.id);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }
};

module.exports = authController;