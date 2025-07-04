import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  Download, 
  RefreshCw,
  User,
  DollarSign,
  MapPin,
  Building
} from 'lucide-react';
import apiService from '../../services/api';
import { 
  formatCurrency, 
  getBalanceStatusConfig, 
  formatDate,
  debounce 
} from '../../utils/helpers';
import { MINISTRIES, BOARDING_AREAS, DEBOUNCE_DELAY } from '../../utils/constants';
import type { Passenger, PassengerFormData, Route } from '../../types';

interface PassengerManagementProps {
  className?: string;
}

const PassengerManagement: React.FC<PassengerManagementProps> = ({ className = '' }) => {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [ministryFilter, setMinistryFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // Form data for add/edit
  const [formData, setFormData] = useState<PassengerFormData>({
    full_name: '',
    ministry: '',
    boarding_area: '',
    route_id: '',
    current_balance: 0
  });

  // Debounced search function
  const debouncedSearch = debounce((query: string) => {
    setCurrentPage(1);
    loadPassengers(1, query);
  }, DEBOUNCE_DELAY);

  // Load passengers with filters
  const loadPassengers = async (page = 1, search = searchQuery) => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        page,
        limit: pageSize,
        ...(search && { search }),
        ...(selectedRoute && { route_id: selectedRoute }),
        ...(balanceFilter !== 'all' && { balance_status: balanceFilter }),
        ...(ministryFilter && { ministry: ministryFilter })
      };

      const response = await apiService.getAllPassengers(params);
      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          setPassengers(response.data);
          setTotalPages(Math.ceil(response.data.length / pageSize));
        } else if (
          typeof response.data === 'object' &&
          response.data !== null &&
          'passengers' in response.data &&
          Array.isArray((response.data as { passengers: Passenger[] }).passengers)
        ) {
          setPassengers((response.data as { passengers: Passenger[] }).passengers || []);
          setTotalPages(Math.ceil(((response.data as { total?: number }).total || 0) / pageSize));
        } else {
          setPassengers([]);
          setTotalPages(1);
        }
      } else {
        throw new Error(response.error || 'Failed to load passengers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passengers');
      console.error('Error loading passengers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load routes
  const loadRoutes = async () => {
    try {
      const response = await apiService.getAllRoutes();
      if (response.success && response.data) {
        setRoutes(response.data);
      }
    } catch (err) {
      console.error('Error loading routes:', err);
    }
  };

  // Initialize data
  useEffect(() => {
    loadPassengers();
    loadRoutes();
  }, []);

  // Handle search input
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery]);

  // Handle filter changes
  useEffect(() => {
    if (currentPage === 1) {
      loadPassengers();
    } else {
      setCurrentPage(1);
    }
  }, [selectedRoute, balanceFilter, ministryFilter]);

  // Handle page change
  useEffect(() => {
    if (currentPage > 1) {
      loadPassengers(currentPage);
    }
  }, [currentPage]);

  // Reset form
  const resetForm = () => {
    setFormData({
      full_name: '',
      ministry: '',
      boarding_area: '',
      route_id: '',
      current_balance: 0
    });
    setSelectedPassenger(null);
  };

  // Handle add passenger
  const handleAddPassenger = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Handle edit passenger
  const handleEditPassenger = (passenger: Passenger) => {
    setSelectedPassenger(passenger);
    setFormData({
      full_name: passenger.full_name,
      ministry: passenger.ministry,
      boarding_area: passenger.boarding_area,
      route_id: passenger.route_id || '',
      current_balance: passenger.current_balance
    });
    setShowEditModal(true);
  };

  // Handle delete passenger
  const handleDeletePassenger = async (passenger: Passenger) => {
    if (!window.confirm(`Are you sure you want to delete ${passenger.full_name}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.deletePassenger(passenger.id);
      if (response.success) {
        await loadPassengers(currentPage);
      } else {
        throw new Error(response.error || 'Failed to delete passenger');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete passenger');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (showAddModal) {
        const response = await apiService.createPassenger({
          ...formData,
          initial_balance: formData.current_balance,
        });
        if (!response.success) {
          throw new Error(response.error || 'Failed to create passenger');
        }
      } else if (showEditModal && selectedPassenger) {
        const response = await apiService.updatePassenger(selectedPassenger.id, formData);
        if (!response.success) {
          throw new Error(response.error || 'Failed to update passenger');
        }
      }

      setShowAddModal(false);
      setShowEditModal(false);
      resetForm();
      await loadPassengers(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle top-up
  const handleTopup = async (passenger: Passenger) => {
    const amount = prompt(`Enter top-up amount for ${passenger.full_name}:`);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.topupPassenger(
        passenger.id, 
        Number(amount), 
        'Admin top-up'
      );
      if (response.success) {
        await loadPassengers(currentPage);
      } else {
        throw new Error(response.error || 'Failed to top up passenger');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to top up passenger');
    } finally {
      setLoading(false);
    }
  };

  // Export passengers
  const handleExport = async () => {
    try {
      // Use 'daily' as an example; adjust as needed for your report type
      const response = await apiService.exportReport('daily', 'csv');
      const blob = response && response.data instanceof Blob ? response.data : null;
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `passengers_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Failed to export passengers');
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Passenger Management</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => loadPassengers(currentPage)}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              onClick={handleAddPassenger}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Passenger
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search passengers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Routes</option>
            {routes.map(route => (
              <option key={route.id} value={route.id}>{route.name}</option>
            ))}
          </select>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Balances</option>
            <option value="positive">Positive</option>
            <option value="low">Low Balance</option>
            <option value="zero">Zero Balance</option>
            <option value="negative">Negative</option>
          </select>

          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Ministries</option>
            {MINISTRIES.map(ministry => (
              <option key={ministry.code} value={ministry.name}>{ministry.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Passengers Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Passenger
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ministry
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading passengers...
                </td>
              </tr>
            ) : passengers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No passengers found
                </td>
              </tr>
            ) : (
              passengers.map((passenger) => {
                const balanceConfig = getBalanceStatusConfig(passenger.current_balance);
                return (
                  <tr key={passenger.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {passenger.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {passenger.legacy_passenger_id || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{passenger.ministry}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm text-gray-900">
                            {passenger.route_name || 'Unassigned'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {passenger.boarding_area}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        <span className={`text-sm font-medium ${balanceConfig.textColor}`}>
                          {formatCurrency(passenger.current_balance)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${balanceConfig.bgColor} ${balanceConfig.textColor}`}>
                        {balanceConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditPassenger(passenger)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit passenger"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleTopup(passenger)}
                          className="text-green-600 hover:text-green-900"
                          title="Top up balance"
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePassenger(passenger)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete passenger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {showAddModal ? 'Add New Passenger' : 'Edit Passenger'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ministry *
                  </label>
                  <select
                    required
                    value={formData.ministry}
                    onChange={(e) => setFormData({ ...formData, ministry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Ministry</option>
                    {MINISTRIES.map(ministry => (
                      <option key={ministry.code} value={ministry.name}>
                        {ministry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Boarding Area *
                  </label>
                  <select
                    required
                    value={formData.boarding_area}
                    onChange={(e) => setFormData({ ...formData, boarding_area: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Boarding Area</option>
                    {BOARDING_AREAS.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route
                  </label>
                  <select
                    value={formData.route_id}
                    onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Route</option>
                    {routes.map(route => (
                      <option key={route.id} value={route.id}>
                        {route.name} - {route.boarding_area}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Balance *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.current_balance}
                    onChange={(e) => setFormData({ ...formData, current_balance: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : (showAddModal ? 'Add Passenger' : 'Update Passenger')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassengerManagement;