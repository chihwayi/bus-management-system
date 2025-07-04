import apiService from './api';
import offlineService from './offlineService';
import { OFFLINE_SYNC_INTERVAL } from '../utils/constants';
import type { OfflineTransaction, Passenger } from '../types';

export interface SyncResult {
  success: boolean;
  syncedTransactions: number;
  syncedPassengers: number;
  errors: string[];
  timestamp: Date;
}

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private syncListeners: ((result: SyncResult) => void)[] = [];
  private isInitialized = false;
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor() {
    // Bind event handlers to preserve 'this' context
    this.onlineHandler = this.handleOnline.bind(this);
    this.offlineHandler = this.handleOffline.bind(this);
  }

  // Start automatic sync
  startAutoSync(): void {
    this.stopAutoSync(); // Clear any existing interval
    
    this.syncInterval = setInterval(async () => {
      if (!this.isSyncing && navigator.onLine && apiService.isAuthenticated()) {
        await this.syncData();
      }
    }, OFFLINE_SYNC_INTERVAL);

    console.log('Auto sync started');
  }

  // Stop automatic sync
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto sync stopped');
    }
  }

  // Add sync listener
  addSyncListener(listener: (result: SyncResult) => void): void {
    this.syncListeners.push(listener);
  }

  // Remove sync listener
  removeSyncListener(listener: (result: SyncResult) => void): void {
    this.syncListeners = this.syncListeners.filter(l => l !== listener);
  }

  // Notify sync listeners
  private notifySyncListeners(result: SyncResult): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  // Main sync function
  async syncData(force = false): Promise<SyncResult> {
    if (this.isSyncing && !force) {
      console.log('Sync already in progress');
      return {
        success: false,
        syncedTransactions: 0,
        syncedPassengers: 0,
        errors: ['Sync already in progress'],
        timestamp: new Date()
      };
    }

    if (!navigator.onLine) {
      console.log('Cannot sync - offline');
      return {
        success: false,
        syncedTransactions: 0,
        syncedPassengers: 0,
        errors: ['Device is offline'],
        timestamp: new Date()
      };
    }

    // Check if user is authenticated before syncing
    if (!apiService.isAuthenticated()) {
      console.log('Cannot sync - not authenticated');
      return {
        success: false,
        syncedTransactions: 0,
        syncedPassengers: 0,
        errors: ['User not authenticated'],
        timestamp: new Date()
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedTransactions: 0,
      syncedPassengers: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      console.log('Starting data sync...');

      // 1. Sync pending transactions
      await this.syncTransactions(result);

      // 2. Sync passenger data (download latest)
      await this.syncPassengers(result);

      // 3. Update last sync time
      if (result.errors.length === 0) {
        offlineService.setLastSyncTime(result.timestamp);
        console.log('Sync completed successfully');
      } else {
        result.success = false;
        console.log('Sync completed with errors:', result.errors);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
      this.notifySyncListeners(result);
    }

    return result;
  }

  // Sync offline transactions to server
  private async syncTransactions(result: SyncResult): Promise<void> {
    const pendingTransactions = offlineService.getPendingTransactions();
    
    if (pendingTransactions.length === 0) {
      console.log('No pending transactions to sync');
      return;
    }

    console.log(`Syncing ${pendingTransactions.length} transactions...`);

    for (const transaction of pendingTransactions) {
      try {
        await this.syncSingleTransaction(transaction);
        offlineService.markTransactionAsSynced(transaction.id);
        result.syncedTransactions++;
      } catch (error) {
        const errorMsg = `Failed to sync transaction ${transaction.id}: ${error}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  // Sync a single transaction
  private async syncSingleTransaction(transaction: OfflineTransaction): Promise<void> {
    try {
      if (transaction.transaction_type === 'boarding') {
        await apiService.boardPassenger(
          transaction.passenger_id,
          transaction.conductor_id,
          transaction.route_id,
          Math.abs(transaction.amount) // Convert back to positive for API
        );
      } else if (transaction.transaction_type === 'topup') {
        await apiService.topupPassenger(
          transaction.passenger_id,
          transaction.amount,
          `Offline sync - ${new Date(transaction.timestamp).toISOString()}`
        );
      }
    } catch (error) {
      // If it's a 404 (passenger not found), remove the transaction
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as any;
        if (apiError.response?.status === 404) {
          console.log(`Removing transaction for deleted passenger: ${transaction.passenger_id}`);
          offlineService.removeTransaction(transaction.id);
          return;
        }
      }
      throw error;
    }
  }

  // Sync passenger data from server
  private async syncPassengers(result: SyncResult): Promise<void> {
    try {
      console.log('Syncing passenger data...');
      
      // Get current user - FIXED: Now using await
      let user = await apiService.getCurrentUser();
      
      if (!user) {
        // Try to fetch user from API if not in localStorage
        try {
          const userResponse = await apiService.getMe();
          if (!userResponse.success || !userResponse.data) {
            result.errors.push('No authenticated user found');
            return;
          }
          user = userResponse.data;
        } catch (error) {
          result.errors.push('Failed to fetch user data');
          return;
        }
      }

      if (!user) {
        result.errors.push('Unable to get user data');
        return;
      }

      let passengers: Passenger[] = [];

      if (user.role === 'admin') {
        // Admin gets all passengers
        const response = await apiService.getAllPassengers();
        passengers = response.data ?? [];
      } else if (user.role === 'conductor' && user.conductor_id) {
        // Conductor gets only their assigned passengers
        const response = await apiService.getConductorPassengers(user.conductor_id);
        passengers = response.data ?? [];
      } else {
        result.errors.push('User role not recognized or conductor not assigned');
        return;
      }

      // Update offline passenger data
      offlineService.saveOfflinePassengers(passengers);
      result.syncedPassengers = passengers.length;
      
      console.log(`Synced ${passengers.length} passengers`);

    } catch (error) {
      const errorMsg = `Failed to sync passengers: ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // Force sync all data
  async forceSyncAll(): Promise<SyncResult> {
    console.log('Forcing complete data sync...');
    return this.syncData(true);
  }

  // Sync specific passenger
  async syncPassenger(passengerId: string): Promise<boolean> {
    try {
      const response = await apiService.getPassenger(passengerId);
      const passenger = response?.data;
      if (passenger) {
        const currentPassengers = offlineService.getOfflinePassengers();
        const index = currentPassengers.findIndex(p => p.id === passengerId);
        
        if (index !== -1) {
          currentPassengers[index] = passenger;
        } else {
          currentPassengers.push(passenger);
        }
        
        offlineService.saveOfflinePassengers(currentPassengers);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to sync passenger ${passengerId}:`, error);
      return false;
    }
  }

  // Check if sync is needed
  needsSync(): boolean {
    // Don't sync if not authenticated
    if (!apiService.isAuthenticated()) {
      return false;
    }

    const pendingTransactions = offlineService.getPendingTransactions();
    const lastSync = offlineService.getLastSyncTime();
    const now = new Date();
    
    // Sync if there are pending transactions
    if (pendingTransactions.length > 0) {
      return true;
    }
    
    // Sync if last sync was more than 1 hour ago
    if (!lastSync || (now.getTime() - lastSync.getTime()) > 3600000) {
      return true;
    }
    
    return false;
  }

  // Get sync status
  getSyncStatus(): {
    isSyncing: boolean;
    lastSync: Date | null;
    pendingTransactions: number;
    needsSync: boolean;
  } {
    return {
      isSyncing: this.isSyncing,
      lastSync: offlineService.getLastSyncTime(),
      pendingTransactions: offlineService.getPendingTransactions().length,
      needsSync: this.needsSync()
    };
  }

  // Resolve sync conflicts (if any)
  async resolveSyncConflicts(): Promise<void> {
    const pendingTransactions = offlineService.getPendingTransactions();
    const conflictedTransactions = pendingTransactions.filter(t => {
      // Check if transaction timestamp is older than a certain threshold
      const transactionAge = Date.now() - t.timestamp;
      return transactionAge > 24 * 60 * 60 * 1000; // 24 hours
    });

    if (conflictedTransactions.length > 0) {
      console.log(`Found ${conflictedTransactions.length} potentially conflicted transactions`);
      
      // For now, we'll just log them. In a real implementation,
      // you might want to present these to the user for manual resolution
      for (const transaction of conflictedTransactions) {
        console.log(`Conflicted transaction: ${transaction.id}`, transaction);
      }
    }
  }

  // Clear sync data
  clearSyncData(): void {
    this.stopAutoSync();
    offlineService.clearAllOfflineData();
    console.log('Sync data cleared');
  }

  // Initialize sync service - only call this after user is authenticated
  async initialize(): Promise<void> {
    try {
      // Reset initialization status
      if (this.isInitialized) {
        this.destroy(); // Clean up existing initialization
      }

      // Only initialize if user is authenticated
      if (!apiService.isAuthenticated()) {
        console.log('Sync service not initialized - user not authenticated');
        return;
      }
      
      console.log('Initializing sync service...');
      
      // Check if we're online and perform initial sync
      if (navigator.onLine) {
        await this.syncData();
      }
      
      // Start auto sync
      this.startAutoSync();
      
      // Listen for online/offline events
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
      
      this.isInitialized = true;
      console.log('Sync service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
    }
  }

  // Handle online event
  private async handleOnline(): Promise<void> {
    console.log('Device came online, starting sync...');
    if (apiService.isAuthenticated()) {
      await this.syncData();
    }
  }

  // Handle offline event
  private handleOffline(): void {
    console.log('Device went offline');
    // Could perform cleanup here if needed
  }

  // Reset sync service (call this on logout)
  reset(): void {
    this.stopAutoSync();
    this.isInitialized = false;
    console.log('Sync service reset');
  }

  // Cleanup resources
  destroy(): void {
    this.stopAutoSync();
    
    // Remove event listeners using the bound functions
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    
    this.syncListeners = [];
    this.isInitialized = false;
    console.log('Sync service destroyed');
  }

  // Check if sync service is initialized
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  // Get sync service status
  getServiceStatus(): {
    isInitialized: boolean;
    isSyncing: boolean;
    isAuthenticated: boolean;
    isOnline: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      isSyncing: this.isSyncing,
      isAuthenticated: apiService.isAuthenticated(),
      isOnline: navigator.onLine
    };
  }

  // Wait for sync to complete (useful for testing or ensuring sync is done)
  async waitForSync(timeout = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isSyncing) {
        resolve(true);
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve(false);
      }, timeout);

      const checkSync = () => {
        if (!this.isSyncing) {
          clearTimeout(timeoutId);
          resolve(true);
        } else {
          setTimeout(checkSync, 100);
        }
      };

      checkSync();
    });
  }

  // Get pending transactions count
  getPendingTransactionsCount(): number {
    return offlineService.getPendingTransactions().length;
  }

  // Get last sync time
  getLastSyncTime(): Date | null {
    return offlineService.getLastSyncTime();
  }

  // Manual sync trigger (for UI buttons, etc.)
  async manualSync(): Promise<SyncResult> {
    console.log('Manual sync triggered');
    return this.syncData(true);
  }
}

// Create and export singleton instance
const syncService = new SyncService();
export default syncService;