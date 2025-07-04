import { 
  LOCAL_STORAGE_KEYS, 
  MAX_OFFLINE_TRANSACTIONS, 
  SYNC_STATUS 
} from '../utils/constants';
import { generateId } from '../utils/helpers';
import type { 
  OfflineTransaction, 
  Passenger, 
  Transaction, 
  SyncData 
} from '../types';

class OfflineService {
  private readonly OFFLINE_PASSENGERS_KEY = LOCAL_STORAGE_KEYS.OFFLINE_PASSENGERS;
  private readonly OFFLINE_TRANSACTIONS_KEY = LOCAL_STORAGE_KEYS.OFFLINE_TRANSACTIONS;
  private readonly LAST_SYNC_KEY = LOCAL_STORAGE_KEYS.LAST_SYNC;

  // Offline Passengers Management
  getOfflinePassengers(): Passenger[] {
    try {
      const passengers = localStorage.getItem(this.OFFLINE_PASSENGERS_KEY);
      return passengers ? JSON.parse(passengers) : [];
    } catch (error) {
      console.error('Error retrieving offline passengers:', error);
      return [];
    }
  }

  saveOfflinePassengers(passengers: Passenger[]): void {
    try {
      localStorage.setItem(this.OFFLINE_PASSENGERS_KEY, JSON.stringify(passengers));
    } catch (error) {
      console.error('Error saving offline passengers:', error);
    }
  }

  updateOfflinePassenger(passengerId: string, updates: Partial<Passenger>): Passenger | null {
    const passengers = this.getOfflinePassengers();
    const index = passengers.findIndex(p => p.id === passengerId);
    
    if (index !== -1) {
      passengers[index] = { ...passengers[index], ...updates };
      this.saveOfflinePassengers(passengers);
      return passengers[index];
    }
    
    return null;
  }

  addOfflinePassenger(passenger: Passenger): void {
    const passengers = this.getOfflinePassengers();
    passengers.push(passenger);
    this.saveOfflinePassengers(passengers);
  }

  // Offline Transactions Management
  getOfflineTransactions(): OfflineTransaction[] {
    try {
      const transactions = localStorage.getItem(this.OFFLINE_TRANSACTIONS_KEY);
      return transactions ? JSON.parse(transactions) : [];
    } catch (error) {
      console.error('Error retrieving offline transactions:', error);
      return [];
    }
  }

  saveOfflineTransactions(transactions: OfflineTransaction[]): void {
    try {
      // Limit the number of offline transactions
      const limitedTransactions = transactions.slice(-MAX_OFFLINE_TRANSACTIONS);
      localStorage.setItem(this.OFFLINE_TRANSACTIONS_KEY, JSON.stringify(limitedTransactions));
    } catch (error) {
      console.error('Error saving offline transactions:', error);
    }
  }

  addOfflineTransaction(transaction: Omit<OfflineTransaction, 'id' | 'timestamp' | 'synced'>): OfflineTransaction {
    const offlineTransaction: OfflineTransaction = {
      ...transaction,
      id: generateId(),
      timestamp: Date.now(),
      synced: false
    };

    const transactions = this.getOfflineTransactions();
    transactions.push(offlineTransaction);
    this.saveOfflineTransactions(transactions);
    
    return offlineTransaction;
  }

  markTransactionAsSynced(transactionId: string): void {
    const transactions = this.getOfflineTransactions();
    const index = transactions.findIndex(t => t.id === transactionId);
    
    if (index !== -1) {
      transactions[index].synced = true;
      this.saveOfflineTransactions(transactions);
    }
  }

  removeTransaction(transactionId: string): void {
    const transactions = this.getOfflineTransactions();
    const filteredTransactions = transactions.filter(t => t.id !== transactionId);
    this.saveOfflineTransactions(filteredTransactions);
  }

  getPendingTransactions(): OfflineTransaction[] {
    return this.getOfflineTransactions().filter(t => !t.synced);
  }

  getPendingTransactionsCount(): number {
  return this.getPendingTransactions().length;
}

  // Boarding Operation (Offline)
  processOfflineBoarding(
    passengerId: string, 
    conductorId: string, 
    routeId: string, 
    fare: number
  ): { success: boolean; transaction?: OfflineTransaction; passenger?: Passenger; error?: string } {
    try {
      // Get current passenger data
      const passengers = this.getOfflinePassengers();
      const passenger = passengers.find(p => p.id === passengerId);
      
      if (!passenger) {
        return { success: false, error: 'Passenger not found' };
      }

      // Check if passenger has sufficient balance
      if (passenger.current_balance < fare) {
        return { success: false, error: 'Insufficient balance' };
      }

      // Calculate new balance
      const balanceBefore = passenger.current_balance;
      const balanceAfter = balanceBefore - fare;

      // Create offline transaction
      const transaction = this.addOfflineTransaction({
        passenger_id: passengerId,
        conductor_id: conductorId,
        route_id: routeId,
        transaction_type: 'boarding',
        amount: -fare, // Negative because it's a deduction
        balance_before: balanceBefore,
        balance_after: balanceAfter
      });

      // Update passenger balance
      const updatedPassenger = this.updateOfflinePassenger(passengerId, {
        current_balance: balanceAfter
      });

      return {
        success: true,
        transaction,
        passenger: updatedPassenger!
      };
    } catch (error) {
      console.error('Error processing offline boarding:', error);
      return { success: false, error: 'Failed to process boarding' };
    }
  }

  // Top-up Operation (Offline)
  processOfflineTopup(
    passengerId: string,
    amount: number,
    conductorId: string,
    routeId: string
  ): { success: boolean; transaction?: OfflineTransaction; passenger?: Passenger; error?: string } {
    try {
      // Get current passenger data
      const passengers = this.getOfflinePassengers();
      const passenger = passengers.find(p => p.id === passengerId);
      
      if (!passenger) {
        return { success: false, error: 'Passenger not found' };
      }

      if (amount <= 0) {
        return { success: false, error: 'Top-up amount must be positive' };
      }

      // Calculate new balance
      const balanceBefore = passenger.current_balance;
      const balanceAfter = balanceBefore + amount;

      // Create offline transaction
      const transaction = this.addOfflineTransaction({
        passenger_id: passengerId,
        conductor_id: conductorId,
        route_id: routeId,
        transaction_type: 'topup',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter
      });

      // Update passenger balance
      const updatedPassenger = this.updateOfflinePassenger(passengerId, {
        current_balance: balanceAfter
      });

      return {
        success: true,
        transaction,
        passenger: updatedPassenger!
      };
    } catch (error) {
      console.error('Error processing offline top-up:', error);
      return { success: false, error: 'Failed to process top-up' };
    }
  }

  // Search passengers offline
  searchOfflinePassengers(query: string): Passenger[] {
    const passengers = this.getOfflinePassengers();
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) return passengers;
    
    return passengers.filter(passenger => {
      const matchesName = passenger.full_name.toLowerCase().includes(lowerQuery);
      const matchesId = passenger.legacy_passenger_id?.toString().includes(lowerQuery);
      const matchesMinistry = passenger.ministry.toLowerCase().includes(lowerQuery);
      const matchesBoardingArea = passenger.boarding_area.toLowerCase().includes(lowerQuery);
      
      return matchesName || matchesId || matchesMinistry || matchesBoardingArea;
    });
  }

  // Sync Management
  getLastSyncTime(): Date | null {
    try {
      const timestamp = localStorage.getItem(this.LAST_SYNC_KEY);
      return timestamp ? new Date(parseInt(timestamp)) : null;
    } catch (error) {
      console.error('Error retrieving last sync time:', error);
      return null;
    }
  }

  setLastSyncTime(date: Date = new Date()): void {
    try {
      localStorage.setItem(this.LAST_SYNC_KEY, date.getTime().toString());
    } catch (error) {
      console.error('Error setting last sync time:', error);
    }
  }

  getSyncData(): SyncData {
    return {
      transactions: this.getPendingTransactions(),
      passengers: this.getOfflinePassengers().map(p => ({
        id: p.id,
        current_balance: p.current_balance,
        updated_at: p.updated_at
      }))
    };
  }

  // Storage Management
  getStorageUsage(): { used: number; total: number; percentage: number } {
    try {
      const used = JSON.stringify(localStorage).length;
      const total = 5 * 1024 * 1024; // Approximate 5MB limit for localStorage
      const percentage = Math.round((used / total) * 100);
      
      return { used, total, percentage };
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  clearStorageIfNeeded(): void {
    const { percentage } = this.getStorageUsage();
    
    if (percentage > 80) {
      // Remove old synced transactions
      const transactions = this.getOfflineTransactions();
      const unsyncedTransactions = transactions.filter(t => !t.synced);
      this.saveOfflineTransactions(unsyncedTransactions);
      
      console.log('Cleared old synced transactions due to storage limit');
    }
  }

  // Clear all offline data
  clearAllOfflineData(): void {
    try {
      localStorage.removeItem(this.OFFLINE_PASSENGERS_KEY);
      localStorage.removeItem(this.OFFLINE_TRANSACTIONS_KEY);
      localStorage.removeItem(this.LAST_SYNC_KEY);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  // Check if running in offline mode
  isOfflineMode(): boolean {
    return !navigator.onLine;
  }

  // Get offline statistics
  getOfflineStats(): {
    passengersCount: number;
    pendingTransactions: number;
    lastSync: Date | null;
    storageUsage: number;
  } {
    return {
      passengersCount: this.getOfflinePassengers().length,
      pendingTransactions: this.getPendingTransactions().length,
      lastSync: this.getLastSyncTime(),
      storageUsage: this.getStorageUsage().percentage
    };
  }
}

// Create and export singleton instance
const offlineService = new OfflineService();
export default offlineService;