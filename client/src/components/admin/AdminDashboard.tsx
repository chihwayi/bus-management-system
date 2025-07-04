import React, { useState, useEffect } from 'react';
import {
  Users,
  Bus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  UserCheck,
  MapPin,
  Calendar,
  RefreshCw,
  Download,
  Eye,
  BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import { formatCurrency, formatDate, getBalanceStatus } from '../../utils/helpers';
import LoadingSpinner from '../common/LoadingSpinner';
import type { DashboardStats, Passenger, Conductor, Route, Transaction } from '../../types';

interface AdminDashboardProps {
  className?: string;
}

interface ExtendedDashboardStats extends DashboardStats {
  totalRoutes: number;
  totalConductors: number;
  totalRevenue: number;
  averageBalance: number;
  recentTransactions: Transaction[];
  topRoutes: Array<{ route_name: string; passenger_count: number; revenue: number }>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<ExtendedDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const navigate = useNavigate();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setError(null);

      // Fetch all required data in parallel
      const [
        passengersResponse,
        conductorsResponse,
        routesResponse,
        recentTransactionsResponse
      ] = await Promise.all([
        apiService.getAllPassengers(),
        apiService.getAllConductors(),
        apiService.getAllRoutes(),
        apiService.getAdminRecentTransactions(10)
      ]);

      // Check if all responses are successful
      if (!passengersResponse.success || !conductorsResponse.success ||
        !routesResponse.success || !recentTransactionsResponse.success) {
        throw new Error('One or more API calls failed');
      }

      const passengers = passengersResponse.data || [];
      const conductors = conductorsResponse.data || [];
      const routes = routesResponse.data || [];
      const recentTransactions = recentTransactionsResponse.data || [];

      // Calculate statistics
      const totalPassengers = passengers.length;
      const activePassengers = passengers.filter(p => p.is_active).length;
      const lowBalancePassengers = passengers.filter(p =>
        getBalanceStatus(p.current_balance) === 'low'
      ).length;
      const negativeBalancePassengers = passengers.filter(p =>
        p.current_balance < 0
      ).length;

      const totalRoutes = routes.filter(r => r.is_active).length;
      const totalConductors = conductors.filter(c => c.is_active).length;
      const activeConductors = conductors.filter(c =>
        c.is_active && c.assigned_route_id
      ).length;

      // Calculate today's transactions
      const today = new Date().toISOString().split('T')[0];
      const todayTransactions = recentTransactions.filter((t: Transaction) =>
        t.transaction_date.startsWith(today)
      );

      const totalBoardingsToday = todayTransactions.filter((t: Transaction) =>
        t.transaction_type === 'boarding'
      ).length;

      const totalRevenueToday = todayTransactions
        .filter((t: Transaction) => t.transaction_type === 'boarding')
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      const totalRevenue = recentTransactions
        .filter((t: Transaction) => t.transaction_type === 'boarding')
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      const averageBalance = passengers.length > 0
        ? passengers.reduce((sum, p) => sum + p.current_balance, 0) / passengers.length
        : 0;

      // Calculate top routes by passenger count
      const routeStats = routes.map(route => {
        const routePassengers = passengers.filter(p => p.route_id === route.id);
        const routeTransactions = recentTransactions.filter((t: Transaction) => t.route_id === route.id);
        const routeRevenue = routeTransactions
          .filter((t: Transaction) => t.transaction_type === 'boarding')
          .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

        return {
          route_name: route.name,
          passenger_count: routePassengers.length,
          revenue: routeRevenue
        };
      }).sort((a, b) => b.passenger_count - a.passenger_count).slice(0, 5);

      const dashboardStats: ExtendedDashboardStats = {
        totalPassengers: activePassengers,
        totalBoardingsToday,
        totalRevenueToday,
        activeRoutes: totalRoutes,
        activeConductors,
        lowBalancePassengers,
        negativeBalancePassengers,
        totalRoutes,
        totalConductors,
        totalRevenue,
        averageBalance,
        recentTransactions: recentTransactions.slice(0, 5),
        topRoutes: routeStats
      };

      setStats(dashboardStats);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);

      // More specific error handling
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(apiService.handleApiError(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  // Export dashboard report
  const handleExportReport = async () => {
    try {
      // Map selectedPeriod to API expected values
      const periodMap: Record<'today' | 'week' | 'month', 'daily' | 'weekly' | 'monthly'> = {
        today: 'daily',
        week: 'weekly',
        month: 'monthly'
      };
      const apiPeriod = periodMap[selectedPeriod];
      const response = await apiService.exportReport(apiPeriod, 'csv');
      let blob: Blob;
      if (response instanceof Blob) {
        blob = response;
      } else if (typeof response === 'string') {
        blob = new Blob([response], { type: 'text/csv' });
      } else if (response && typeof response === 'object' && 'data' in response) {
        // Assume ApiResponse with CSV data in .data
        blob = new Blob([response.data], { type: 'text/csv' });
      } else {
        throw new Error('Unexpected response type for export');
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `admin-dashboard-${formatDate(new Date(), 'short')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Error</span>
        </div>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            System overview and key metrics
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'today' | 'week' | 'month')}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Passengers */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Passengers</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPassengers}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Today's Boardings */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Boardings</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBoardingsToday}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenueToday)}</p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Active Routes */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Routes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeRoutes}</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <MapPin className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Conductors */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Conductors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeConductors}</p>
              <p className="text-xs text-gray-500">of {stats.totalConductors} total</p>
            </div>
            <div className="bg-indigo-100 rounded-full p-3">
              <UserCheck className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Average Balance */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Balance</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.averageBalance)}</p>
              <p className="text-xs text-gray-500">per passenger</p>
            </div>
            <div className="bg-teal-100 rounded-full p-3">
              <TrendingUp className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs text-gray-500">all time</p>
            </div>
            <div className="bg-emerald-100 rounded-full p-3">
              <BarChart3 className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats.lowBalancePassengers > 0 || stats.negativeBalancePassengers > 0) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            Alerts & Notifications
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.lowBalancePassengers > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-orange-100 rounded-full p-2 mr-3">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-800">Low Balance Alert</p>
                    <p className="text-sm text-orange-600">
                      {stats.lowBalancePassengers} passengers have low balance
                    </p>
                  </div>
                </div>
              </div>
            )}
            {stats.negativeBalancePassengers > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-red-100 rounded-full p-2 mr-3">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-red-800">Negative Balance Alert</p>
                    <p className="text-sm text-red-600">
                      {stats.negativeBalancePassengers} passengers have negative balance
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Routes by Passengers</h2>
          <div className="space-y-4">
            {stats.topRoutes.map((route, index) => (
              <div
                key={`route-${route.route_name}-${index}-${route.revenue}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{route.route_name}</p>
                    <p className="text-sm text-gray-600">{route.passenger_count} passengers</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatCurrency(route.revenue)}</p>
                  <p className="text-sm text-gray-600">revenue</p>
                </div>
              </div>
            ))}
            {stats.topRoutes.length === 0 && (
              <p className="text-gray-500 text-center py-4">No route data available</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h2>
          <div className="space-y-3">
            {stats.recentTransactions.map((transaction) => (
              <div
                key={`txn-${transaction.id}-${transaction.transaction_date}-${transaction.amount}`}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${transaction.transaction_type === 'boarding' ? 'bg-red-500' :
                      transaction.transaction_type === 'topup' ? 'bg-green-500' : 'bg-blue-500'
                    }`} />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {transaction.transaction_type === 'boarding' ? 'Boarding' :
                        transaction.transaction_type === 'topup' ? 'Top-up' : 'Adjustment'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {transaction.conductor_name} • {formatDate(transaction.transaction_date, 'datetime')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium text-sm ${transaction.transaction_type === 'boarding' ? 'text-red-600' : 'text-green-600'
                    }`}>
                    {transaction.transaction_type === 'boarding' ? '-' : '+'}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentTransactions.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent transactions</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('passengers')} // Relative path
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">Manage Passengers</span>
          </button>
          <button
            onClick={() => navigate('conductors')} // Relative path
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <UserCheck className="h-5 w-5 text-green-600" />
            <span className="font-medium text-gray-900">Manage Conductors</span>
          </button>
          <button
            onClick={() => navigate('routes')} // Relative path
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MapPin className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-gray-900">Manage Routes</span>
          </button>
          <button
            onClick={() => navigate('fares')} // Relative path
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="h-5 w-5 text-orange-600" />
            <span className="font-medium text-gray-900">Manage Fares</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;