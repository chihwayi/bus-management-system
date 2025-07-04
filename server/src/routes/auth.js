const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/me', auth, authController.getMe);
router.post('/change-password', auth, authController.changePassword);

module.exports = router;

/*
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
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
});

// Get current user
router.get('/me', auth, (req, res) => {
  const user = { ...req.user };
  delete user.password_hash;
  
  res.json({
    success: true,
    data: user
  });
});

// Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
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
    
    db.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
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
});

module.exports = router;
*/