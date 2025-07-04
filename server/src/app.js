require('dotenv').config();

// Debug environment variables
console.log('🔍 Environment Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);
console.log('All JWT related vars:', Object.keys(process.env).filter(key => key.includes('JWT')));

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const passengerRoutes = require('./routes/passengers');
const conductorRoutes = require('./routes/conductors');
const routeRoutes = require('./routes/routes');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const boardingRoutes = require('./routes/boarding');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { auth } = require('./middleware/auth');

// Import database
const { getDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database
const db = getDatabase();
console.log('📊 Database initialized successfully');

// Middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, specify allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://173.212.195.88:8090',
      'http://173.212.195.88',
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/passengers', auth, passengerRoutes);
app.use('/api/conductors', auth, conductorRoutes);
app.use('/api/routes', auth, routeRoutes);
app.use('/api/reports', auth, reportRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api/boarding', auth, boardingRoutes);

// Sync endpoint for offline operations
app.post('/api/sync', auth, async (req, res) => {
  try {
    const { transactions, passengers } = req.body;
    const results = {
      transactions: { success: 0, failed: 0 },
      passengers: { success: 0, failed: 0 }
    };

    // Process offline transactions
    if (transactions && Array.isArray(transactions)) {
      for (const transaction of transactions) {
        try {
          // Validate and process transaction
          db.createTransaction({
            ...transaction,
            isOffline: true,
            syncStatus: 'synced'
          });
          results.transactions.success++;
        } catch (error) {
          results.transactions.failed++;
          console.error('Transaction sync error:', error);
        }
      }
    }

    // Process offline passenger updates
    if (passengers && Array.isArray(passengers)) {
      for (const passenger of passengers) {
        try {
          db.updatePassengerBalance(
            passenger.id,
            passenger.currentBalance,
            null // No transaction details needed for sync
          );
          results.passengers.success++;
        } catch (error) {
          results.passengers.failed++;
          console.error('Passenger sync error:', error);
        }
      }
    }

    res.json({
      success: true,
      results,
      message: 'Sync completed'
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed'
    });
  }
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Detailed error logging
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    error: err,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.url,
      body: req.body
    }
  });
  next(err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Shutting down gracefully...');
  db.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚌 PSC Bus Management System API');
  console.log('=' .repeat(40));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database: SQLite`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log('=' .repeat(40));
});

module.exports = app;