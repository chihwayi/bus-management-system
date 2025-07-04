import { useState, useEffect, useCallback, useRef } from 'react';
import syncService, { SyncResult } from '../services/syncService';
import offlineService from '../services/offlineService';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  pendingTransactions: number;
  needsSync: boolean;
  syncProgress: number;
}

export interface UseOfflineSyncReturn {
  syncStatus: SyncStatus;
  syncNow: () => Promise<SyncResult>;
  forceSyncAll: () => Promise<SyncResult>;
  clearOfflineData: () => void;
  getSyncStats: () => {
    passengersCount: number;
    pendingTransactions: number;
    lastSync: Date | null;
    storageUsage: number;
  };
  // Added missing properties
  isOnline: boolean;
  lastSyncTime: Date | null;
}

export const useOfflineSync = (): UseOfflineSyncReturn => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    pendingTransactions: 0,
    needsSync: false,
    syncProgress: 0
  });

  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncListenerRef = useRef<((result: SyncResult) => void) | null>(null);

  const isOnline = syncStatus.isOnline;
  const lastSyncTime = syncStatus.lastSync;

  // Update sync status
  const updateSyncStatus = useCallback(() => {
    const status = syncService.getSyncStatus();
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: status.isSyncing,
      lastSync: status.lastSync,
      pendingTransactions: status.pendingTransactions,
      needsSync: status.needsSync
    }));
  }, []);

  // Handle online/offline status changes
  const handleOnlineStatus = useCallback(() => {
    setSyncStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }));
    updateSyncStatus();
  }, [updateSyncStatus]);

  // Sync listener to track sync progress and results
  const handleSyncResult = useCallback((result: SyncResult) => {
    setLastSyncResult(result);
    updateSyncStatus();
    
    // Calculate progress based on synced items
    const totalItems = result.syncedTransactions + result.syncedPassengers;
    setSyncStatus(prev => ({
      ...prev,
      syncProgress: totalItems > 0 ? 100 : 0
    }));
  }, [updateSyncStatus]);

  // Manual sync trigger
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!navigator.onLine) {
      const offlineResult: SyncResult = {
        success: false,
        syncedTransactions: 0,
        syncedPassengers: 0,
        errors: ['Device is offline'],
        timestamp: new Date()
      };
      return offlineResult;
    }

    setSyncStatus(prev => ({ ...prev, syncProgress: 0 }));
    const result = await syncService.syncData();
    return result;
  }, []);

  // Force sync all data
  const forceSyncAll = useCallback(async (): Promise<SyncResult> => {
    if (!navigator.onLine) {
      const offlineResult: SyncResult = {
        success: false,
        syncedTransactions: 0,
        syncedPassengers: 0,
        errors: ['Device is offline'],
        timestamp: new Date()
      };
      return offlineResult;
    }

    setSyncStatus(prev => ({ ...prev, syncProgress: 0 }));
    const result = await syncService.forceSyncAll();
    return result;
  }, []);

  // Clear offline data
  const clearOfflineData = useCallback(() => {
    offlineService.clearAllOfflineData();
    updateSyncStatus();
  }, [updateSyncStatus]);

  // Get sync statistics
  const getSyncStats = useCallback(() => {
    return offlineService.getOfflineStats();
  }, []);

  // Initialize hook
  useEffect(() => {
    // Initial status update
    updateSyncStatus();

    // Set up sync listener
    syncListenerRef.current = handleSyncResult;
    syncService.addSyncListener(handleSyncResult);

    // Set up online/offline listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    // Periodic status updates
    const statusInterval = setInterval(updateSyncStatus, 5000);

    // Cleanup
    return () => {
      if (syncListenerRef.current) {
        syncService.removeSyncListener(syncListenerRef.current);
      }
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      clearInterval(statusInterval);
    };
  }, [handleSyncResult, handleOnlineStatus, updateSyncStatus]);

   return {
    syncStatus,
    syncNow,
    forceSyncAll, 
    clearOfflineData,
    getSyncStats,
    isOnline,
    lastSyncTime
  };
};