import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Users, DollarSign, Clock, Wifi, WifiOff, RefreshCw, Plus, Filter, CreditCard, BarChart3 } from 'lucide-react';
import PassengerPill from './PassengerPill';
import PassengerSearch from './PassengerSearch';
import PassengerRegistration from './PassengerRegistration';
import TopUpComponent from './TopUpComponent';
import LoadingSpinner from '../common/LoadingSpinner';
import { usePassengers } from '../../hooks/usePassengers';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { BarChart, TrendingUp } from 'lucide-react';
import { useBoardingStats } from '../../hooks/useBoardingStats';
import {
  formatCurrency,
  getBalanceStatus,
  sortPassengers,
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

const ConductorDashboard: React.FC<ConductorDashboardProps> = ({ user, currentRoute }) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [activeTab, setActiveTab] = useState<'boarding' | 'topup'>('boarding');
  const [filters, setFilters] = useState<SearchFilters>({
    balance_status: 'all',
    route_id: currentRoute?.id || ''
  });

  // Get the correct conductor ID - try conductor_id first, then fall back to id
  const conductorId = user.conductor_id || user.id;
  const routeId = user.assigned_route_id || currentRoute?.id;

  console.log('ConductorDashboard Debug:', {
    user,
    conductorId,
    routeId,
    userKeys: Object.keys(user),
    registrationProps: {
      conductorId: conductorId,
      routeId: routeId
    }
  });

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
    console.log('Recent boardings type:', typeof recentBoardings);
    console.log('Recent boardings value:', recentBoardings);
    console.log('Is array?', Array.isArray(recentBoardings));
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

    return sortPassengers(filtered);
  }, [passengers, searchQuery, filters]);

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
      // The transformation now happens in apiService.createPassenger
      const response = await api.createPassenger(data);

      if (response.success) {
        // Optionally refresh passenger list or show success
        return;
      }
      throw new Error(response.error || 'Failed to create passenger');
    } catch (error) {
      throw error; // This will be caught in PassengerRegistration's handleSubmit
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
  try {
    if (isOnline) {
      // First sync any pending offline data
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
    // Optionally show error to user
  }
};

  if (loading && passengers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Conductor Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome back, {user.full_name}
            </p>
            {currentRoute && (
              <p className="text-sm text-blue-600 font-medium">
                Route: {currentRoute.name} - {currentRoute.boarding_area}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Online/Offline Status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Sync Status */}
            {syncStatus.pendingTransactions > 0 && (
              <div className="flex items-center space-x-1 text-orange-600 text-sm">
                <Clock size={16} />
                <span>{syncStatus.pendingTransactions} pending</span>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="text-blue-600" size={20} />
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Passengers</p>
                <p className="text-2xl font-bold text-blue-900">{passengers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <DollarSign className="text-green-600" size={20} />
              <div>
                <p className="text-sm text-green-600 font-medium">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(combinedTodayStats.revenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="text-purple-600" size={20} />
              <div>
                <p className="text-sm text-purple-600 font-medium">Today's Boardings</p>
                <p className="text-2xl font-bold text-purple-900">{combinedTodayStats.boardings}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <CreditCard className="text-orange-600" size={20} />
              <div>
                <p className="text-sm text-orange-600 font-medium">Top-ups Today</p>
                <p className="text-2xl font-bold text-orange-900">{combinedTodayStats.topups}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Boardings Section - Fixed height with scroll */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="mr-2" size={20} />
            Recent Boardings
          </h2>

          {statsLoading ? (
            <div className="h-32 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : statsError ? (
            <div className="h-32 flex items-center justify-center">
              <div className="text-red-500 text-sm">{statsError}</div>
            </div>
          ) : safeRecentBoardings.length === 0 ? (
            <div className="h-32 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <div className="text-gray-500 text-sm">No recent boardings found</div>
              </div>
            </div>
          ) : (
            <div className="h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {safeRecentBoardings.map((boarding) => (
                  <div key={boarding.id} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 truncate">{boarding.passenger_name}</h3>
                        <p className="text-sm text-gray-500">ID: {boarding.passenger_id}</p>
                        <p className="text-sm text-gray-400 truncate">{boarding.ministry}</p>
                      </div>
                      <span className="text-sm font-medium text-red-600 ml-2 flex-shrink-0">
                        {formatCurrency(Math.abs(boarding.amount))}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
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

      {/* Daily Stats Summary */}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('boarding')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'boarding'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <Users size={16} />
                <span>Passenger Boarding</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('topup')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'topup'
                ? 'border-purple-500 text-purple-600 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <CreditCard size={16} />
                <span>Balance Top-up</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'boarding' && (
            <>
              {/* Actions Bar */}
              <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <div className="flex-1 max-w-md">
                    <PassengerSearch
                      onSearch={debouncedSearch}
                      placeholder="Search passengers by ID, name, or ministry..."
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Filter Toggle */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700'
                        }`}
                    >
                      <Filter size={16} />
                      <span>Filters</span>
                    </button>

                    {/* Register New Passenger */}
                    <button
                      onClick={() => setShowRegistration(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Plus size={16} />
                      <span>Register</span>
                    </button>
                  </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Filter Passengers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Balance Status
                        </label>
                        <select
                          value={filters.balance_status || 'all'}
                          onChange={(e) => setFilters(prev => ({ ...prev, balance_status: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">All Balances</option>
                          <option value="good">Good Balance</option>
                          <option value="low">Low Balance</option>
                          <option value="zero">Zero Balance</option>
                          <option value="negative">Negative Balance</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ministry
                        </label>
                        <input
                          type="text"
                          value={filters.ministry || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, ministry: e.target.value }))}
                          placeholder="Filter by ministry..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={() => setFilters({ balance_status: 'all', route_id: currentRoute?.id || '' })}
                          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  <p className="font-medium">Error loading passengers</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Passengers Grid Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Passengers ({filteredAndSortedPassengers.length})
                  </h2>
                  {lastSyncTime && (
                    <p className="text-sm text-gray-500">
                      Last synced: {formatRelativeTime(lastSyncTime)}
                    </p>
                  )}
                </div>

                {/* Balance Status Summary */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(balanceStatusCounts).map(([status, count]) => (
                    <span
                      key={status}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${status === 'good' ? 'bg-green-100 text-green-800' :
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
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No passengers found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery || Object.values(filters).some(Boolean) ?
                      'Try adjusting your search or filters.' :
                      'No passengers are assigned to your route.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
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
        </div>
      </div>

      {/* Registration Modal */}
      {showRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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
          <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
            <LoadingSpinner size="sm" />
            <span className="text-gray-700">Updating passengers...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConductorDashboard;