import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Clock,
  ChevronLeft,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  debounce
} from '../../utils/helpers';
import apiService from '../../services/api';
import type { ReportData, Transaction } from '../../types';

interface ConductorReportsProps {
  conductorId: string;
  className?: string;
  onRefresh?: () => Promise<void>;
}

const ConductorReports: React.FC<ConductorReportsProps> = ({
  conductorId,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransactionType, setSelectedTransactionType] = useState<'all' | 'boarding' | 'topup' | 'adjustment'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Debounced search function
  const debouncedSearch = debounce((query: string) => {
    applyFilters(query, selectedTransactionType);
  }, 300);

  useEffect(() => {
    loadReportData();
  }, [activeTab, selectedDate, conductorId]);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let response;
      switch (activeTab) {
        case 'daily':
          response = await apiService.getConductorDailyReport(conductorId, selectedDate);
          break;
        case 'weekly':
          response = await apiService.getConductorWeeklyReport(conductorId, selectedDate);
          break;
        case 'monthly':
          const date = new Date(selectedDate);
          const month = (date.getMonth() + 1).toString();
          const year = date.getFullYear().toString();
          response = await apiService.getConductorMonthlyReport(conductorId, month);
          break;
      }

      if (response.success && response.data) {
        setReportData(response.data);
        // Extract transactions from the response data
        extractTransactions(response.data);
      } else {
        throw new Error(response.error || 'Failed to load report data');
      }
    } catch (err) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to load report data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const extractTransactions = (data: ReportData) => {
    let allTransactions: Transaction[] = [];

    // Extract transactions based on report type
    if (activeTab === 'daily') {
      // For daily reports, get transactions from passenger details
      allTransactions = data.passengerDetails?.flatMap(passenger =>
        passenger.transactions || []
      ) || [];
    } else if (activeTab === 'weekly') {
      // For weekly reports, get transactions from transactions
      allTransactions = data.transactions || [];
    } else if (activeTab === 'monthly') {
      // For monthly reports, get transactions from transactions
      allTransactions = data.transactions || [];
    }

    setTransactions(allTransactions);
  };

  const applyFilters = (query: string, transactionType: string) => {
    let filtered = [...transactions];

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      filtered = filtered.filter(transaction => {
        const matchesId = transaction.id.toLowerCase().includes(lowerQuery);
        const matchesPassengerId = transaction.passenger_id.toLowerCase().includes(lowerQuery);
        const matchesNotes = transaction.notes?.toLowerCase().includes(lowerQuery);
        const matchesAmount = transaction.amount.toString().includes(lowerQuery);
        const matchesConductor = transaction.conductor_name?.toLowerCase().includes(lowerQuery);
        // const matchesPassengerName = transaction.passenger_name?.toLowerCase().includes(lowerQuery);

        return matchesId || matchesPassengerId || matchesNotes || matchesAmount || matchesConductor;
      });
    }

    // Filter by transaction type
    if (transactionType !== 'all') {
      filtered = filtered.filter(transaction => transaction.transaction_type === transactionType);
    }

    return filtered;
  };

  const filteredTransactions = applyFilters(searchQuery, selectedTransactionType);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleTransactionTypeChange = (type: typeof selectedTransactionType) => {
    setSelectedTransactionType(type);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      let filters: any = { conductorId };

      if (activeTab === 'daily') {
        filters.startDate = selectedDate;
      } else if (activeTab === 'weekly') {
        const date = new Date(selectedDate);
        const startDate = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
        filters.startDate = startDate.toISOString().split('T')[0];
        filters.endDate = selectedDate;
      } else if (activeTab === 'monthly') {
        const date = new Date(selectedDate);
        filters.month = (date.getMonth() + 1).toString();
        filters.year = date.getFullYear().toString();
      }

      const response = await apiService.exportReport(activeTab, 'csv', filters);

      // Since the backend returns CSV content directly, we need to handle it properly
      if (response) {
        // If response is a string (CSV content), create blob directly
        let csvContent = '';
        if (typeof response === 'string') {
          csvContent = response;
        } else if (response.data) {
          csvContent = response.data;
        } else {
          throw new Error('Invalid response format');
        }

        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeTab}_report_${selectedDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = async () => {
    await loadReportData();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTransactionType('all');
    setShowFilters(false);
  };

  const tabs = [
    { key: 'daily', label: 'Daily', icon: Calendar },
    { key: 'weekly', label: 'Weekly', icon: TrendingUp },
    { key: 'monthly', label: 'Monthly', icon: FileText }
  ];

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'boarding': return 'text-blue-600 bg-blue-100';
      case 'topup': return 'text-green-600 bg-green-100';
      case 'adjustment': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <h3 className="text-lg font-medium text-gray-900">
            Conductor Reports
          </h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || !reportData}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 mr-2 ${isExporting ? 'animate-spin' : ''}`} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 sm:px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs - Mobile Scrollable */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 px-4 sm:px-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center py-4 px-3 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Date Picker */}
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="text-sm text-gray-600">
            <span className="hidden sm:inline">Showing {activeTab} report for </span>
            <span className="font-medium">{formatDate(selectedDate, 'short')}</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading report data...</span>
        </div>
      )}

      {/* Report Content */}
      {!isLoading && reportData && (
        <>
          {/* Stats Cards - Mobile Stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 p-4 sm:p-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 sm:p-6 text-white">
              <div className="flex items-center">
                <Users className="w-6 h-6 sm:w-8 sm:h-8" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-blue-100 text-xs sm:text-sm">Total Passengers</p>
                  <p className="text-xl sm:text-2xl font-bold">{reportData.summary.unique_passengers}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 sm:p-6 text-white">
              <div className="flex items-center">
                <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-green-100 text-xs sm:text-sm">Total Boardings</p>
                  <p className="text-xl sm:text-2xl font-bold">{reportData.summary.total_boardings}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 sm:p-6 text-white">
              <div className="flex items-center">
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-purple-100 text-xs sm:text-sm">Total Revenue</p>
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(reportData.summary.total_revenue)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 sm:p-6 text-white">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-orange-100 text-xs sm:text-sm">Total Top-ups</p>
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(reportData.summary.total_topups || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Breakdown - Mobile Optimized */}
          {reportData.hourlyBreakdown && (
            <div className="px-4 sm:px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Hourly Breakdown</h4>
              <div className="bg-white shadow rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
                  {reportData.hourlyBreakdown.map((hour) => (
                    <div key={hour.hour} className="text-center p-3 border rounded-lg">
                      <div className="font-medium text-sm sm:text-base">{hour.hour}:00</div>
                      <div className="text-xs sm:text-sm text-gray-600">{hour.boardings} boardings</div>
                      <div className="text-xs sm:text-sm text-green-600 font-medium">{formatCurrency(hour.revenue)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Daily Breakdown - Mobile Cards */}
          {(activeTab === 'weekly' || activeTab === 'monthly') && reportData.dailyBreakdown && (
            <div className="px-4 sm:px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Daily Breakdown</h4>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boardings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Passengers</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.dailyBreakdown.map((day) => (
                        <tr key={day.date}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatDate(day.date, 'short')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {day.boardings}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {day.unique_passengers}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {formatCurrency(day.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden max-h-96 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {reportData.dailyBreakdown.map((day) => (
                      <div key={day.date} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-900">
                            {formatDate(day.date, 'short')}
                          </div>
                          <div className="text-green-600 font-medium">
                            {formatCurrency(day.revenue)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Boardings:</span>
                            <span className="ml-2 font-medium">{day.boardings}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Passengers:</span>
                            <span className="ml-2 font-medium">{day.unique_passengers}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Report - All Passengers - Mobile Cards */}
          {activeTab === 'monthly' && reportData.allPassengers && (
            <div className="px-4 sm:px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">All Passengers (Month-end Balances)</h4>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden lg:block max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boarding Area</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month-end Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.allPassengers.map((passenger) => (
                        <tr key={passenger.legacy_passenger_id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{passenger.full_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{passenger.legacy_passenger_id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{passenger.ministry}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{passenger.boarding_area}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{passenger.transaction_count}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-green-600">{formatCurrency(passenger.total_paid)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${passenger.balance_at_month_end >= 10 ? 'text-green-600' :
                              passenger.balance_at_month_end >= 0 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                              {formatCurrency(passenger.balance_at_month_end)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden max-h-96 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {reportData.allPassengers.map((passenger) => (
                      <div key={passenger.legacy_passenger_id} className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-gray-900">{passenger.full_name}</div>
                            <div className="text-sm text-gray-500">ID: {passenger.legacy_passenger_id}</div>
                          </div>
                          <div className={`text-right font-medium ${passenger.balance_at_month_end >= 10 ? 'text-green-600' :
                            passenger.balance_at_month_end >= 0 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                            {formatCurrency(passenger.balance_at_month_end)}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ministry:</span>
                            <span className="font-medium">{passenger.ministry}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Boarding Area:</span>
                            <span className="font-medium">{passenger.boarding_area}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Transactions:</span>
                            <span className="font-medium">{passenger.transaction_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Total Paid:</span>
                            <span className="font-medium text-green-600">{formatCurrency(passenger.total_paid)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Passengers for Weekly Reports - Mobile Cards */}
          {activeTab === 'weekly' && reportData.topPassengers && (
            <div className="px-4 sm:px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Top Passengers</h4>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boardings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.topPassengers.map((passenger) => (
                        <tr key={passenger.legacy_passenger_id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{passenger.full_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{passenger.legacy_passenger_id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{passenger.boarding_count}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-green-600">{formatCurrency(passenger.total_paid)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden max-h-96 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {reportData.topPassengers.map((passenger) => (
                      <div key={passenger.legacy_passenger_id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-gray-900">{passenger.full_name}</div>
                            <div className="text-sm text-gray-500">ID: {passenger.legacy_passenger_id}</div>
                          </div>
                          <div className="text-green-600 font-medium">
                            {formatCurrency(passenger.total_paid)}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          <span className="font-medium text-gray-900">{passenger.boarding_count}</span> boardings
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Passenger Details for Daily Reports - Mobile Cards */}
          {activeTab === 'daily' && reportData.passengerDetails && (
            <div className="px-4 sm:px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Passenger Details</h4>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boardings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.passengerDetails.map((passenger) => (
                        <tr key={passenger.legacy_passenger_id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{passenger.full_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{passenger.legacy_passenger_id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{passenger.boarding_count}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-green-600">{formatCurrency(passenger.total_paid)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${passenger.current_balance >= 10 ? 'text-green-600' :
                              passenger.current_balance >= 0 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                              {formatCurrency(passenger.current_balance)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden max-h-96 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {reportData.passengerDetails.map((passenger) => (
                      <div key={passenger.legacy_passenger_id} className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-gray-900">{passenger.full_name}</div>
                            <div className="text-sm text-gray-500">ID: {passenger.legacy_passenger_id}</div>
                          </div>
                          <div className={`text-right font-medium ${passenger.current_balance >= 10 ? 'text-green-600' :
                            passenger.current_balance >= 0 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                            {formatCurrency(passenger.current_balance)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Boardings:</span>
                            <span className="ml-2 font-medium">{passenger.boarding_count}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Amount Paid:</span>
                            <span className="ml-2 font-medium text-green-600">{formatCurrency(passenger.total_paid)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Transactions - Only show for Daily Reports */}
          {activeTab === 'daily' && (
            <div className="border-t border-gray-200">
              <div className="px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                  <h4 className="text-lg font-medium text-gray-900">Recent Transactions</h4>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                    <ChevronDown className={`w-4 h-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Search and Filters */}
                {showFilters && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-3 sm:grid sm:grid-cols-1 md:grid-cols-3 sm:gap-4 sm:space-y-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search transactions..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <select
                        value={selectedTransactionType}
                        onChange={(e) => handleTransactionTypeChange(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">All Types</option>
                        <option value="boarding">Boarding</option>
                        <option value="topup">Top-up</option>
                        <option value="adjustment">Adjustment</option>
                      </select>

                      <button
                        onClick={clearFilters}
                        className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                )}

                {/* Transactions List */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  {/* Desktop Table */}
                  <div className="hidden md:block max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Transaction
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                              <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                              <p>No transactions found</p>
                              {(searchQuery || selectedTransactionType !== 'all') && (
                                <p className="text-sm mt-2">Try adjusting your search criteria</p>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    ID: {transaction.id}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Passenger: {transaction.passenger_id}
                                  </div>
                                  {transaction.notes && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      {transaction.notes}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTransactionTypeColor(transaction.transaction_type)}`}>
                                  {transaction.transaction_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {formatCurrency(transaction.balance_before)} → {formatCurrency(transaction.balance_after)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {formatDate(transaction.transaction_date, 'datetime')}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatRelativeTime(transaction.transaction_date)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getSyncStatusIcon(transaction.sync_status)}
                                  <span className="ml-2 text-sm text-gray-600 capitalize">
                                    {transaction.sync_status}
                                  </span>
                                  {transaction.is_offline && (
                                    <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                      Offline
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden max-h-96 overflow-y-auto">
                    {filteredTransactions.length === 0 ? (
                      <div className="px-6 py-12 text-center text-gray-500">
                        <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No transactions found</p>
                        {(searchQuery || selectedTransactionType !== 'all') && (
                          <p className="text-sm mt-2">Try adjusting your search criteria</p>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {filteredTransactions.map((transaction) => (
                          <div key={transaction.id} className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium text-gray-900">
                                    ID: {transaction.id}
                                  </div>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getTransactionTypeColor(transaction.transaction_type)}`}>
                                    {transaction.transaction_type}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 mb-1">
                                  Passenger: {transaction.passenger_id}
                                </div>
                                {transaction.notes && (
                                  <div className="text-xs text-gray-400 mb-2">
                                    {transaction.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                              <div>
                                <span className="text-gray-500">Amount:</span>
                                <div className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500">Balance:</span>
                                <div className="font-medium text-gray-900 text-xs">
                                  {formatCurrency(transaction.balance_before)} → {formatCurrency(transaction.balance_after)}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <div className="text-gray-500">
                                {formatDate(transaction.transaction_date, 'datetime')}
                              </div>
                              <div className="flex items-center">
                                {getSyncStatusIcon(transaction.sync_status)}
                                <span className="ml-1 text-gray-600 capitalize">
                                  {transaction.sync_status}
                                </span>
                                {transaction.is_offline && (
                                  <span className="ml-2 text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                    Offline
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConductorReports;