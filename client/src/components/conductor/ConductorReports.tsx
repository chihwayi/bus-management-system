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
  Clock
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
          response = await apiService.getConductorMonthlyReport(
            conductorId,
            (date.getMonth() + 1).toString()
          );
          break;
      }

      if (response.success && response.data) {
        setReportData(response.data);
        await loadRecentTransactions();
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

  const loadRecentTransactions = async () => {
    try {
      let params: any = { conductorId };

      if (activeTab === 'daily') {
        params.date = selectedDate;
      } else if (activeTab === 'weekly') {
        const date = new Date(selectedDate);
        params.startDate = new Date(date.setDate(date.getDate() - 7)).toISOString().split('T')[0];
        params.endDate = selectedDate;
      } else { // monthly
        const date = new Date(selectedDate);
        params.month = (date.getMonth() + 1).toString();
        params.year = date.getFullYear().toString();
      }

      // Use the correct endpoint based on report type
      let response;
      if (activeTab === 'daily') {
        response = await apiService.getConductorDailyReport(conductorId, params.date);
      } else if (activeTab === 'weekly') {
        response = await apiService.getConductorWeeklyReport(conductorId, params.startDate);
      } else { // monthly
        response = await apiService.getConductorMonthlyReport(conductorId, params.month);
      }

      if (response.success && response.data) {
        // Extract transactions from the response data
        const transactions = response.data.passengerDetails?.flatMap(passenger =>
          passenger.transactions || []
        ) || [];
        setTransactions(transactions);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions([]);
    }
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
    try {
      let params: any = { conductorId };

      if (activeTab === 'daily') {
        params.date = selectedDate;
      } else if (activeTab === 'weekly') {
        const date = new Date(selectedDate);
        params.startDate = new Date(date.setDate(date.getDate() - 7)).toISOString().split('T')[0];
        params.endDate = selectedDate;
      } else { // monthly
        const date = new Date(selectedDate);
        params.month = (date.getMonth() + 1).toString();
        params.year = date.getFullYear().toString();
      }

      const response = await apiService.exportReport(
        activeTab,
        'csv',
        params
      );

      if (response.success) {
        // Create download link
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTab}_report_${selectedDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError('Failed to export report');
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
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Conductor Reports
          </h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || !reportData}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 mr-2 ${isExporting ? 'animate-spin' : ''}`} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.key
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
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
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
            Showing {activeTab} report for {formatDate(selectedDate, 'long')}
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center">
                <Users className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-blue-100 text-sm">Total Passengers</p>
                  <p className="text-2xl font-bold">{reportData.summary.unique_passengers}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
              <div className="flex items-center">
                <Activity className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-green-100 text-sm">Total Boardings</p>
                  <p className="text-2xl font-bold">{reportData.summary.total_boardings}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-purple-100 text-sm">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.summary.total_revenue)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-orange-100 text-sm">Total Top-ups</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.summary.total_topups || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Report Sections */}
          {reportData.hourlyBreakdown && (
            <div className="px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Hourly Breakdown</h4>
              <div className="bg-white shadow rounded-lg p-4">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {reportData.hourlyBreakdown.map((hour) => (
                    <div key={hour.hour} className="text-center p-2 border rounded">
                      <div className="font-medium">{hour.hour}:00</div>
                      <div className="text-sm text-gray-600">{hour.boardings} boardings</div>
                      <div className="text-sm text-green-600">{formatCurrency(hour.revenue)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Passenger Details */}
          {reportData.passengerDetails && (
            <div className="px-6 pb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Passenger Details</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
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
            </div>
          )}

          {/* Recent Transactions */}
          <div className="border-t border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Recent Transactions</h4>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  <ChevronDown className={`w-4 h-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Search and Filters */}
              {showFilters && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Transactions List */}
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConductorReports;