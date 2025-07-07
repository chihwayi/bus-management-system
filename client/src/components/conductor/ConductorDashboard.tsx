import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Users, DollarSign, Clock, Wifi, WifiOff, RefreshCw, Plus, Filter, CreditCard, BarChart3, Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import PassengerPill from './PassengerPill';
import PassengerSearch from './PassengerSearch';
import PassengerRegistration from './PassengerRegistration';
import TopUpComponent from './TopUpComponent';
import BalanceEditComponent from './BalanceEditComponent';
import LoadingSpinner from '../common/LoadingSpinner';
import { usePassengers } from '../../hooks/usePassengers';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { BarChart, TrendingUp } from 'lucide-react';
import { useBoardingStats } from '../../hooks/useBoardingStats';
import {
  formatCurrency,
  getBalanceStatus,
  filterPassengers,
  formatRelativeTime,
  debounce
} from '../../utils/helpers';
import { DEBOUNCE_DELAY, BALANCE_THRESHOLDS } from '../../utils/constants';
import type { Passenger, User, Route, SearchFilters, CreatePassengerData } from '../../types';
import api from '../../services/api';

interface ConductorDashboardProps {
  user: User;
  currentRoute?: Route;
}

// Enhanced sorting types
type SortField = 'name' | 'balance' | 'legacy_id';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

// Enhanced sorting function
const sortPassengers = (passengers: Passenger[], sortConfig: SortConfig): Passenger[] => {
  return [...passengers].sort((a, b) => {
    const { field, order } = sortConfig;
    let aValue: string | number;
    let bValue: string | number;

    switch (field) {
      case 'name':
        aValue = a.full_name.toLowerCase();
        bValue = b.full_name.toLowerCase();
        break;
      case 'balance':
        aValue = a.current_balance;
        bValue = b.current_balance;
        break;
      case 'legacy_id':
        aValue = a.legacy_passenger_id || '';
        bValue = b.legacy_passenger_id || '';
        break;
      default:
        return 0;
    }

    let comparison = 0;
    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return order === 'desc' ? comparison * -1 : comparison;
  });
};

const ConductorDashboard: React.FC<ConductorDashboardProps> = ({ user, currentRoute }) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [activeTab, setActiveTab] = useState<'boarding' | 'topup' | 'edit'>('boarding');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', order: 'asc' });
  const [filters, setFilters] = useState<SearchFilters>({
    balance_status: 'all',
    route_id: currentRoute?.id || ''
  });

  // Get the correct conductor ID - try conductor_id first, then fall back to id
  const conductorId = user.conductor_id || user.id;
  const routeId = user.assigned_route_id || currentRoute?.id;

  const {
    todayStats: apiTodayStats,
    recentBoardings,
    loading: statsLoading,
    error: statsError,
    refreshStats
  } = useBoardingStats(conductorId);

  // Safety check: Ensure recentBoardings is always an array
  const safeRecentBoardings = Array.isArray(recentBoardings) ? recentBoardings : [];

  const { value: localTodayStats, setValue: setLocalTodayStats } = useLocalStorage<{
    boardings: number;
    revenue: number;
    topups: number;
    topupAmount: number;
    lastReset: string;
  }>('conductor_daily_stats', {
    boardings: 0,
    revenue: 0,
    topups: 0,
    topupAmount: 0,
    lastReset: new Date().toDateString()
  });

  const combinedTodayStats = useMemo(() => {
    return {
      boardings: (apiTodayStats?.stats.totalBoardings || 0) + localTodayStats.boardings,
      revenue: (apiTodayStats?.stats.totalRevenue || 0) + localTodayStats.revenue,
      topups: localTodayStats.topups,
      topupAmount: localTodayStats.topupAmount,
      lastReset: localTodayStats.lastReset
    };
  }, [apiTodayStats, localTodayStats]);

  // Hooks - Fixed destructuring
  const {
    passengers,
    loading,
    error,
    refreshPassengers,
    boardPassenger,
    addBalance,
    createPassenger
  } = usePassengers({
    conductorId: conductorId,
    routeId: routeId
  });

  const {
    isOnline,
    syncStatus,
    forceSyncAll,
    lastSyncTime
  } = useOfflineSync();

  // Reset daily stats if new day
  useEffect(() => {
    const today = new Date().toDateString();
    if (localTodayStats.lastReset !== today) {
      setLocalTodayStats({
        boardings: 0,
        revenue: 0,
        topups: 0,
        topupAmount: 0,
        lastReset: today
      });
    }
  }, [localTodayStats.lastReset, setLocalTodayStats]);

  // Debounced search for filters
  const debouncedSearch = useCallback(
    debounce((filters: SearchFilters) => {
      setFilters(prev => ({
        ...prev,
        ...filters
      }));
      setSearchQuery(filters.query || '');
    }, DEBOUNCE_DELAY),
    []
  );

  // Handle sorting
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Filter and sort passengers
  const filteredAndSortedPassengers = useMemo(() => {
    let filtered = filterPassengers(passengers, searchQuery);

    // Apply additional filters
    if (filters.balance_status && filters.balance_status !== 'all') {
      filtered = filtered.filter(passenger => {
        const status = getBalanceStatus(passenger.current_balance);
        return status === filters.balance_status;
      });
    }

    if (filters.route_id && filters.route_id !== 'all') {
      filtered = filtered.filter(passenger => passenger.route_id === filters.route_id);
    }

    if (filters.ministry) {
      filtered = filtered.filter(passenger =>
        passenger.ministry.toLowerCase().includes(filters.ministry!.toLowerCase())
      );
    }

    // Apply sorting
    return sortPassengers(filtered, sortConfig);
  }, [passengers, searchQuery, filters, sortConfig]);

  // Balance status counts
  const balanceStatusCounts = useMemo(() => {
    return passengers.reduce((counts, passenger) => {
      const status = getBalanceStatus(passenger.current_balance);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }, [passengers]);

  // Handle passenger boarding
  const handleBoardPassenger = async (passenger: Passenger) => {
    if (!currentRoute) return;

    if (passenger.current_balance < currentRoute.base_fare) {
      alert(`Insufficient balance. Required: ${formatCurrency(currentRoute.base_fare)}, Available: ${formatCurrency(passenger.current_balance)}`);
      return;
    }

    try {
      await boardPassenger(
        passenger.id,
        conductorId || '',
        currentRoute.id,
        currentRoute.base_fare
      );

      // Update local stats
      setLocalTodayStats(prev => ({
        ...prev,
        boardings: prev.boardings + 1,
        revenue: prev.revenue + currentRoute.base_fare
      }));

      console.log(`${passenger.full_name} boarded successfully`);
    } catch (error) {
      console.error('Boarding failed:', error);
      alert('Failed to process boarding. Please try again.');
    }
  };

  // Handle passenger top-up - this is now handled by TopUpComponent
  const handlePassengerUpdate = (updatedPassenger: Passenger) => {
    // Update daily stats if it's a top-up (balance increased)
    const originalPassenger = passengers.find(p => p.id === updatedPassenger.id);
    if (originalPassenger && updatedPassenger.current_balance > originalPassenger.current_balance) {
      const topupAmount = updatedPassenger.current_balance - originalPassenger.current_balance;
      setLocalTodayStats(prev => ({
        ...prev,
        topups: prev.topups + 1,
        topupAmount: prev.topupAmount + topupAmount
      }));
    }
  };

  // Handle new passenger registration
  const handleRegisterPassenger = async (passengerData: any) => {
    try {
      await createPassenger({
        ...passengerData,
        route_id: routeId
      });
      setShowRegistration(false);
      console.log('New passenger registered successfully');
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Failed to register passenger. Please try again.');
    }
  };

  const handleCreatePassenger = async (data: CreatePassengerData) => {
    try {
      const response = await api.createPassenger(data);
      if (response.success) {
        return;
      }
      throw new Error(response.error || 'Failed to create passenger');
    } catch (error) {
      throw error;
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      if (isOnline) {
        if (syncStatus.needsSync) {
          await forceSyncAll();
        }
        await Promise.all([
          refreshPassengers(),
          refreshStats()
        ]);
      } else {
        refreshPassengers();
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  // Sort button component
  const SortButton: React.FC<{ field: SortField; label: string; icon?: React.ReactNode }> = ({ field, label, icon }) => {
    const isActive = sortConfig.field === field;
    const order = sortConfig.order;

    return (
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center space-x-1 px-2 py-1 sm:px-3 sm:py-2 rounded-lg border text-xs sm:text-sm transition-colors ${
          isActive
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{label}</span>
        <span className="flex-shrink-0">
          {isActive ? (
            order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
          ) : (
            <ArrowUpDown size={14} className="opacity-50" />
          )}
        </span>
      </button>
    );
  };

  if (loading && passengers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto p-2 sm:p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Conductor Dashboard
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Welcome back, {user.full_name}
            </p>
            {currentRoute && (
              <p className="text-xs sm:text-sm text-blue-600 font-medium">
                Route: {currentRoute.name} - {currentRoute.boarding_area}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Online/Offline Status */}
            <div className={`flex items-center space-x-2 px-2 py-1 rounded-full text-xs sm:text-sm ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Sync Status */}
            {syncStatus.pendingTransactions > 0 && (
              <div className="flex items-center space-x-1 text-orange-600 text-xs sm:text-sm">
                <Clock size={14} />
                <span>{syncStatus.pendingTransactions} pending</span>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs sm:text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Daily Stats - Stack on mobile, grid on larger screens */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          <div className="bg-blue-50 p-2 sm:p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="text-blue-600" size={16} />
              <div>
                <p className="text-xs sm:text-sm text-blue-600 font-medium">Passengers</p>
                <p className="text-lg sm:text-xl font-bold text-blue-900">{passengers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-2 sm:p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <DollarSign className="text-green-600" size={16} />
              <div>
                <p className="text-xs sm:text-sm text-green-600 font-medium">Revenue</p>
                <p className="text-lg sm:text-xl font-bold text-green-900">
                  {formatCurrency(combinedTodayStats.revenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-2 sm:p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="text-purple-600" size={16} />
              <div>
                <p className="text-xs sm:text-sm text-purple-600 font-medium">Boardings</p>
                <p className="text-lg sm:text-xl font-bold text-purple-900">{combinedTodayStats.boardings}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-2 sm:p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <CreditCard className="text-orange-600" size={16} />
              <div>
                <p className="text-xs sm:text-sm text-orange-600 font-medium">Top-ups</p>
                <p className="text-lg sm:text-xl font-bold text-orange-900">{combinedTodayStats.topups}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Boardings Section */}
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mt-4 sm:mt-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <BarChart3 className="mr-2" size={16} />
            Recent Boardings
          </h2>

          {statsLoading ? (
            <div className="h-24 sm:h-32 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : statsError ? (
            <div className="h-24 sm:h-32 flex items-center justify-center">
              <div className="text-red-500 text-xs sm:text-sm">{statsError}</div>
            </div>
          ) : safeRecentBoardings.length === 0 ? (
            <div className="h-24 sm:h-32 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="mx-auto h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mb-1 sm:mb-2" />
                <div className="text-gray-500 text-xs sm:text-sm">No recent boardings</div>
              </div>
            </div>
          ) : (
            <div className="h-40 sm:h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                {safeRecentBoardings.map((boarding) => (
                  <div key={boarding.id} className="border rounded-lg p-2 sm:p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 truncate text-sm sm:text-base">{boarding.passenger_name}</h3>
                        <p className="text-xs text-gray-500">ID: {boarding.passenger_id}</p>
                        <p className="text-xs text-gray-400 truncate">{boarding.ministry}</p>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-red-600 ml-2 flex-shrink-0">
                        {formatCurrency(Math.abs(boarding.amount))}
                      </span>
                    </div>
                    <div className="mt-1 sm:mt-2 flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-500">
                        {new Date(boarding.transaction_date).toLocaleTimeString()}
                      </span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(boarding.balance_after)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400 truncate">
                      {boarding.boarding_area} • {boarding.route_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('boarding')}
              className={`px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'boarding'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Users size={14} />
                <span>Boarding</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('topup')}
              className={`px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'topup'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <CreditCard size={14} />
                <span>Top-up</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'edit'
                  ? 'border-orange-500 text-orange-600 bg-orange-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Edit size={14} />
                <span>Edit Balance</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-2 sm:p-4">
          {activeTab === 'boarding' && (
            <>
              {/* Actions Bar */}
              <div className="mb-4 sm:mb-6">
                <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <PassengerSearch
                      onSearch={debouncedSearch}
                      placeholder="Search passengers..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Filter Toggle */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center space-x-1 px-3 py-1 sm:px-4 sm:py-2 rounded-lg border text-xs sm:text-sm ${showFilters
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'border-gray-300 text-gray-700'
                        }`}
                    >
                      <Filter size={14} />
                      <span>Filters</span>
                    </button>

                    {/* Register New Passenger */}
                    <button
                      onClick={() => setShowRegistration(true)}
                      className="flex items-center space-x-1 px-3 py-1 sm:px-4 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm"
                    >
                      <Plus size={14} />
                      <span>Register</span>
                    </button>
                  </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="mt-3 p-3 sm:p-4 bg-gray-50 rounded-lg border">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3">Filter & Sort Passengers</h3>
                    
                    {/* Sorting Controls */}
                    <div className="mb-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Sort by:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <SortButton 
                          field="name" 
                          label="Name" 
                          icon={<Users size={14} />} 
                        />
                        <SortButton 
                          field="balance" 
                          label="Balance" 
                          icon={<DollarSign size={14} />} 
                        />
                        <SortButton 
                          field="legacy_id" 
                          label="ID" 
                          icon={<span className="text-xs font-mono">#</span>} 
                        />
                      </div>
                    </div>

                    {/* Existing Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Balance Status
                        </label>
                        <select
                          value={filters.balance_status || 'all'}
                          onChange={(e) => setFilters(prev => ({ ...prev, balance_status: e.target.value as any }))}
                          className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                        >
                          <option value="all">All Balances</option>
                          <option value="good">Good Balance</option>
                          <option value="low">Low Balance</option>
                          <option value="zero">Zero Balance</option>
                          <option value="negative">Negative Balance</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Ministry
                        </label>
                        <input
                          type="text"
                          value={filters.ministry || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, ministry: e.target.value }))}
                          placeholder="Filter by ministry..."
                          className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={() => {
                            setFilters({ balance_status: 'all', route_id: currentRoute?.id || '' });
                            setSortConfig({ field: 'name', order: 'asc' });
                          }}
                          className="px-3 py-1 sm:px-4 sm:py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          Reset All
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 sm:mb-6 text-xs sm:text-sm">
                  <p className="font-medium">Error loading passengers</p>
                  <p>{error}</p>
                </div>
              )}

              {/* Passengers Grid Header */}
              <div className="mb-3 sm:mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    Passengers ({filteredAndSortedPassengers.length})
                  </h2>
                  <div className="flex items-center space-x-2">
                    {/* Current sort indicator */}
                    <span className="text-xs sm:text-sm text-gray-500">
                      Sorted by {sortConfig.field} ({sortConfig.order === 'asc' ? 'A-Z' : 'Z-A'})
                    </span>
                    {lastSyncTime && (
                      <p className="text-xs sm:text-sm text-gray-500">
                        Last synced: {formatRelativeTime(lastSyncTime)}
                      </p>
                    )}
                  </div>
                </div>

               {/* Balance Status Summary */}
                <div className="mt-1 sm:mt-2 flex flex-wrap gap-1 sm:gap-2">
                  {Object.entries(balanceStatusCounts).map(([status, count]) => (
                    <span
                      key={status}
                      className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                        status === 'good' ? 'bg-green-100 text-green-800' :
                        status === 'low' ? 'bg-orange-100 text-orange-800' :
                        status === 'zero' ? 'bg-red-100 text-red-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Passengers Grid */}
              {filteredAndSortedPassengers.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <Users className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                  <h3 className="mt-1 sm:mt-2 text-sm font-medium text-gray-900">No passengers found</h3>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">
                    {searchQuery || Object.values(filters).some(Boolean) ?
                      'Try adjusting your search or filters.' :
                      'No passengers are assigned to your route.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                  {filteredAndSortedPassengers.map((passenger) => (
                    <PassengerPill
                      key={passenger.id}
                      passenger={passenger}
                      conductorId={conductorId}
                      routeId={routeId}
                      onSelect={() => setSelectedPassenger(passenger)}
                      onBoard={() => handleBoardPassenger(passenger)}
                      isSelected={selectedPassenger?.id === passenger.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'topup' && (
            <TopUpComponent
              passengers={passengers}
              onPassengerUpdate={handlePassengerUpdate}
            />
          )}
          {activeTab === 'edit' && (
            <BalanceEditComponent
              passengers={passengers}
              onPassengerUpdate={handlePassengerUpdate}
            />
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {showRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <PassengerRegistration
              conductorId={conductorId}
              routeId={routeId}
              onSubmit={handleCreatePassenger}
              onCancel={() => setShowRegistration(false)}
              defaultRoute={currentRoute}
            />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && passengers.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-3 sm:p-4 flex items-center space-x-2 sm:space-x-3">
            <LoadingSpinner size="sm" />
            <span className="text-xs sm:text-sm text-gray-700">Updating passengers...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConductorDashboard;