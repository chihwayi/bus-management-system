const { getDatabase } = require('../models/database');
const Transaction = require('../models/Transaction');
const Passenger = require('../models/Passenger');

class SyncService {
  constructor() {
    this.db = getDatabase();
    this.transaction = new Transaction(this.db);
    this.passenger = new Passenger(this.db);
  }

  async processOfflineTransactions(transactions) {
    try {
      const results = [];
      
      for (const tx of transactions) {
        try {
          // Validate transaction
          if (!tx.passengerId || !tx.conductorId || !tx.routeId || !tx.amount) {
            throw new Error('Invalid transaction data');
          }

          // Process transaction
          const passenger = this.passenger.getById(tx.passengerId);
          if (!passenger) {
            throw new Error('Passenger not found');
          }

          const newBalance = passenger.current_balance + tx.amount;
          this.passenger.updateBalance(tx.passengerId, newBalance);

          const createdTx = this.transaction.create({
            ...tx,
            isOffline: true,
            syncStatus: 'synced'
          });

          results.push({ success: true, transactionId: createdTx.id });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  async getPendingSyncItems() {
    try {
      const pendingTransactions = this.transaction.getPendingSync();
      return { transactions: pendingTransactions };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new SyncService();