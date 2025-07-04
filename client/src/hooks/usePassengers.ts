import { useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/api';
import offlineService from '../services/offlineService';
import syncService from '../services/syncService';
import { filterPassengers, sortPassengers } from '../utils/helpers';
import type { 
  Passenger, 
  SearchFilters, 
  PassengerFormData,
  ApiResponse,
  Transaction 
} from '../types';

export interface UsePassengersOptions {
  conductorId?: string;
  routeId?: string;
  autoFetch?: boolean;
  enableOffline?: boolean;
}

export interface PassengerAction {
  type: 'boarding' | 'topup';
  passengerId: string;
  amount: number;
  conductorId?: string;
  routeId?: string;
  notes?: string;
}

export interface UsePassengersReturn {
  // Data
  passengers: Passenger[];
  filteredPassengers: Passenger[];
  searchFilters: SearchFilters;
  selectedPassenger: Passenger | null;
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  actionLoading: string | null;
  
  // Error states
  error: string | null;
  actionError: string | null;
  
  // Actions
  fetchPassengers: () => Promise<void>;
  refreshPassengers: () => Promise<void>;
  searchPassengers: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  selectPassenger: (passenger: Passenger | null) => void;
  
  // Passenger operations
  createPassenger: (data: PassengerFormData) => Promise<Passenger | null>;
  updatePassenger: (id: string, data: Partial<PassengerFormData>) => Promise<Passenger | null>;
  deletePassenger: (id: string) => Promise<boolean>;
  
  // Transaction operations - Fixed method signatures
  boardPassenger: (passengerId: string, conductorId: string, routeId: string, fare: number) => Promise<boolean>;
  addBalance: (passengerId: string, amount: number, notes?: string) => Promise<boolean>;
  processBoarding: (passengerId: string, conductorId: string, routeId: string, fare: number) => Promise<boolean>;
  processTopup: (passengerId: string, amount: number, notes?: string) => Promise<boolean>;
  transferPassenger: (passengerId: string, newRouteId: string) => Promise<boolean>;
  
  // Transaction history
  getPassengerTransactions: (passengerId: string) => Promise<Transaction[]>;
  
  // Statistics
  stats: {
    totalPassengers: number;
    activePassengers: number;
    lowBalanceCount: number;
    negativeBalanceCount: number;
    zeroBalanceCount: number;
  };
  
  // Offline capabilities
  isOffline: boolean;
  hasOfflineData: boolean;
}

export const usePassengers = (options: UsePassengersOptions = {}): UsePassengersReturn => {
  const {
    conductorId,
    routeId,
    autoFetch = true,
    enableOffline = true
  } = options;

  // State management
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Error states
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Offline state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Trigger sync when coming back online
      if (enableOffline) {
        syncService.syncData().catch(console.error);
      }
    };
    
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableOffline]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchPassengers();
    }
  }, [autoFetch]); // Only run on mount

  // Computed values
  const filteredPassengers = useMemo(() => {
    let result = passengers;
    
    // Apply search query
    if (searchFilters.query) {
      result = filterPassengers(result, searchFilters.query);
    }
    
    // Apply route filter
    if (searchFilters.route_id) {
      result = result.filter(p => p.route_id === searchFilters.route_id);
    }
    
    // Apply ministry filter
    if (searchFilters.ministry) {
      result = result.filter(p => p.ministry === searchFilters.ministry);
    }
    
    // Apply balance status filter
    if (searchFilters.balance_status && searchFilters.balance_status !== 'all') {
      result = result.filter(p => {
        switch (searchFilters.balance_status) {
          case 'positive':
            return p.current_balance > 0;
          case 'low':
            return p.current_balance > 0 && p.current_balance <= 5;
          case 'zero':
            return p.current_balance === 0;
          case 'negative':
            return p.current_balance < 0;
          default:
            return true;
        }
      });
    }
    
    return sortPassengers(result);
  }, [passengers, searchFilters]);

  const stats = useMemo(() => {
    const activePassengers = passengers.filter(p => p.is_active);
    return {
      totalPassengers: passengers.length,
      activePassengers: activePassengers.length,
      lowBalanceCount: activePassengers.filter(p => p.current_balance > 0 && p.current_balance <= 5).length,
      negativeBalanceCount: activePassengers.filter(p => p.current_balance < 0).length,
      zeroBalanceCount: activePassengers.filter(p => p.current_balance === 0).length,
    };
  }, [passengers]);

  const hasOfflineData = useMemo(() => {
    return enableOffline && offlineService.getOfflinePassengers().length > 0;
  }, [enableOffline]);

  // Fetch passengers from API or offline storage
  const fetchPassengers = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (isOffline && enableOffline) {
        // Load from offline storage
        const offlinePassengers = offlineService.getOfflinePassengers();
        setPassengers(offlinePassengers);
      } else {
        // Load from API
        let response: ApiResponse<Passenger[]>;
        
        if (conductorId) {
          response = await apiService.getConductorPassengers(conductorId);
        } else if (routeId) {
          response = await apiService.getRoutePassengers(routeId);
        } else {
          response = await apiService.getAllPassengers(searchFilters);
        }
        
        if (response.success && response.data) {
          setPassengers(response.data);
          
          // Save to offline storage if enabled
          if (enableOffline) {
            offlineService.saveOfflinePassengers(response.data);
          }
        } else {
          throw new Error(response.error || 'Failed to fetch passengers');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch passengers';
      setError(errorMessage);
      
      // Fallback to offline data if available
      if (enableOffline && !isOffline) {
        const offlinePassengers = offlineService.getOfflinePassengers();
        if (offlinePassengers.length > 0) {
          setPassengers(offlinePassengers);
          setError(`${errorMessage} (showing offline data)`);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [conductorId, routeId, searchFilters, isOffline, enableOffline, loading]);

  // Refresh passengers
  const refreshPassengers = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    setError(null);
    
    try {
      await fetchPassengers();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPassengers, refreshing]);

  // Search passengers
  const searchPassengers = useCallback((query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  }, []);

  // Set filters
  const setFilters = useCallback((filters: Partial<SearchFilters>) => {
    setSearchFilters(prev => ({ ...prev, ...filters }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchFilters({});
  }, []);

  // Select passenger
  const selectPassenger = useCallback((passenger: Passenger | null) => {
    setSelectedPassenger(passenger);
  }, []);

  // Create passenger
  const createPassenger = useCallback(async (data: PassengerFormData): Promise<Passenger | null> => {
    setActionError(null);
    
    try {
      const response = await apiService.createPassenger({
        ...data,
        initial_balance: (data as any).current_balance ?? 0,
      });
      
      if (response.success && response.data) {
        // Add to local state
        setPassengers(prev => response.data ? [...prev, response.data] : prev);
        
        // Add to offline storage if enabled
        if (enableOffline) {
          offlineService.addOfflinePassenger(response.data);
        }
        
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create passenger');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create passenger';
      setActionError(errorMessage);
      return null;
    }
  }, [enableOffline]);

  // Update passenger
  const updatePassenger = useCallback(async (id: string, data: Partial<PassengerFormData>): Promise<Passenger | null> => {
    setActionError(null);
    
    try {
      const response = await apiService.updatePassenger(id, data);
      
      if (response.success && response.data) {
        // Update local state
        setPassengers(prev => prev.map(p => (p.id === id && response.data) ? response.data : p));
        
        // Update offline storage if enabled
        if (enableOffline) {
          offlineService.updateOfflinePassenger(id, response.data);
        }
        
        // Update selected passenger if it's the one being updated
        if (selectedPassenger?.id === id) {
          setSelectedPassenger(response.data);
        }
        
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update passenger');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update passenger';
      setActionError(errorMessage);
      return null;
    }
  }, [selectedPassenger, enableOffline]);

  // Delete passenger
  const deletePassenger = useCallback(async (id: string): Promise<boolean> => {
    setActionError(null);
    
    try {
      const response = await apiService.deletePassenger(id);
      
      if (response.success) {
        // Remove from local state
        setPassengers(prev => prev.filter(p => p.id !== id));
        
        // Clear selection if deleted passenger was selected
        if (selectedPassenger?.id === id) {
          setSelectedPassenger(null);
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete passenger');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete passenger';
      setActionError(errorMessage);
      return false;
    }
  }, [selectedPassenger]);

  // Process boarding - keeping original method name
  const processBoarding = useCallback(async (
  passengerId: string, 
  conductorId: string, 
  routeId: string, 
  fare: number
): Promise<boolean> => {
  setActionLoading(passengerId);
  setActionError(null);
  
  try {
    if (isOffline && enableOffline) {
      // Process offline boarding
      const result = offlineService.processOfflineBoarding(passengerId, conductorId, routeId, fare);
      
      if (result.success && result.passenger) {
        // Update local state
        setPassengers(prev => prev.map(p => 
          p.id === passengerId ? result.passenger! : p
        ));
        
        // Update selected passenger if it's the one being boarded
        if (selectedPassenger?.id === passengerId) {
          setSelectedPassenger(result.passenger);
        }
        
        return true;
      } else {
        throw new Error(result.error || 'Failed to process offline boarding');
      }
    } else {
      // Process online boarding
      const response = await apiService.boardPassenger(passengerId, conductorId, routeId, fare);
      
      if (response.success && response.data) {
        // Update local state with new balance
        setPassengers(prev => prev.map(p => 
          (p.id === passengerId && response.data) ? { ...p, current_balance: response.data.current_balance } : p
        ));
        
        // Update selected passenger
        if (selectedPassenger?.id === passengerId && response.data) {
          setSelectedPassenger(prev => prev ? { ...prev, current_balance: response.data!.current_balance } : null);
        }
        
        // Update offline storage if enabled
        if (enableOffline) {
          offlineService.updateOfflinePassenger(passengerId, { current_balance: response.data.current_balance });
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to process boarding');
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to process boarding';
    setActionError(errorMessage);
    return false;
  } finally {
    setActionLoading(null);
  }
}, [isOffline, enableOffline, selectedPassenger]);

  // Board passenger - match interface signature
  const boardPassenger = useCallback(async (
    passengerId: string, 
    conductorId: string, 
    routeId: string, 
    fare: number
  ): Promise<boolean> => {
    if (!conductorId || !routeId) {
      setActionError('Conductor ID and Route ID are required for boarding');
      return false;
    }
    return processBoarding(passengerId, conductorId, routeId, fare);
  }, [processBoarding]);

  // Process top-up - keeping original method name
  const processTopup = useCallback(async (
    passengerId: string, 
    amount: number, 
    notes?: string
  ): Promise<boolean> => {
    setActionLoading(passengerId);
    setActionError(null);
    
    try {
      if (isOffline && enableOffline && conductorId && routeId) {
        // Process offline top-up
        const result = offlineService.processOfflineTopup(passengerId, amount, conductorId, routeId);
        
        if (result.success && result.passenger) {
          // Update local state
          setPassengers(prev => prev.map(p => 
            p.id === passengerId ? result.passenger! : p
          ));
          
          // Update selected passenger if it's the one being topped up
          if (selectedPassenger?.id === passengerId) {
            setSelectedPassenger(result.passenger);
          }
          
          return true;
        } else {
          throw new Error(result.error || 'Failed to process offline top-up');
        }
      } else {
        // Process online top-up
        const response = await apiService.topupPassenger(passengerId, amount, notes);
        
        if (response.success && response.data) {
          // Update local state with new balance
          setPassengers(prev => prev.map(p => 
            (p.id === passengerId && response.data) ? { ...p, current_balance: response.data.balance_after } : p
          ));
          
          // Update selected passenger
          if (selectedPassenger?.id === passengerId) {
            setSelectedPassenger(prev => (prev && response.data) ? { ...prev, current_balance: response.data.balance_after } : prev);
          }
          
          // Update offline storage if enabled
          if (enableOffline) {
            offlineService.updateOfflinePassenger(passengerId, { current_balance: response.data.balance_after });
          }
          
          return true;
        } else {
          throw new Error(response.error || 'Failed to process top-up');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process top-up';
      setActionError(errorMessage);
      return false;
    } finally {
      setActionLoading(null);
    }
  }, [isOffline, enableOffline, conductorId, routeId, selectedPassenger]);

  // Add balance - alias for cleaner interface
  const addBalance = useCallback(async (
    passengerId: string, 
    amount: number, 
    notes?: string
  ): Promise<boolean> => {
    return processTopup(passengerId, amount, notes);
  }, [processTopup]);

  // Transfer passenger
  const transferPassenger = useCallback(async (passengerId: string, newRouteId: string): Promise<boolean> => {
    setActionError(null);
    
    try {
      const response = await apiService.transferPassenger(passengerId, newRouteId);
      
      if (response.success && response.data) {
        // Update local state
        setPassengers(prev => prev.map(p => 
          p.id === passengerId ? { ...p, route_id: newRouteId } : p
        ));
        
        // Update selected passenger
        if (selectedPassenger?.id === passengerId) {
          setSelectedPassenger(prev => prev ? { ...prev, route_id: newRouteId } : null);
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to transfer passenger');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transfer passenger';
      setActionError(errorMessage);
      return false;
    }
  }, [selectedPassenger]);

  // Get passenger transactions
  const getPassengerTransactions = useCallback(async (passengerId: string): Promise<Transaction[]> => {
    try {
      const response = await apiService.getPassengerTransactions(passengerId);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch passenger transactions');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch passenger transactions';
      setActionError(errorMessage);
      return [];
    }
  }, []);

  return {
    // Data
    passengers,
    filteredPassengers,
    searchFilters,
    selectedPassenger,
    
    // Loading states
    loading,
    refreshing,
    actionLoading,
    
    // Error states
    error,
    actionError,
    
    // Actions
    fetchPassengers,
    refreshPassengers,
    searchPassengers,
    setFilters,
    clearFilters,
    selectPassenger,
    
    // Passenger operations
    createPassenger,
    updatePassenger,
    deletePassenger,
    
    // Transaction operations - Both original and alias methods
    processBoarding,
    processTopup,
    boardPassenger,
    addBalance,
    transferPassenger,
    
    // Transaction history
    getPassengerTransactions,
    
    // Statistics
    stats,
    
    // Offline capabilities
    isOffline,
    hasOfflineData,
  };
};