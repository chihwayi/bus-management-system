import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  User,
  MapPin,
  Users,
  TrendingUp,
  Eye,
  UserCheck,
  UserX,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import apiService from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { Conductor, ConductorFormData, Route, Transaction } from '../../types';

interface ConductorManagementProps {
  className?: string;
}

const ConductorManagement: React.FC<ConductorManagementProps> = ({ className = '' }) => {
  const [conductors, setConductors] = useState<Conductor[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedConductor, setSelectedConductor] = useState<Conductor | null>(null);
  const [conductorStats, setConductorStats] = useState<any>(null);
  const [conductorTransactions, setConductorTransactions] = useState<Transaction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ConductorFormData>({
    username: '',
    password: '',
    full_name: '',
    employee_id: '',
    assigned_route_id: ''
  });

  // Load initial data
  useEffect(() => {
    loadConductors();
    loadRoutes();
  }, []);

  const loadConductors = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllConductors();
      if (response.success && response.data) {
        setConductors(response.data);
      }
    } catch (error) {
      console.error('Error loading conductors:', error);
      setError('Failed to load conductors');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const response = await apiService.getAllRoutes();
      if (response.success && response.data) {
        setRoutes(response.data);
      }
    } catch (error) {
      console.error('Error loading routes:', error);
    }
  };

  const handleAddConductor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError('');

      const response = await apiService.createConductor(formData);
      if (response.success) {
        setSuccessMessage('Conductor created successfully');
        setShowAddModal(false);
        resetForm();
        loadConductors();
      } else {
        setError(response.error || 'Failed to create conductor');
      }
    } catch (error) {
      console.error('Error creating conductor:', error);
      setError('Failed to create conductor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditConductor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedConductor) return;

    try {
      setIsSubmitting(true);
      setError('');

      // Prepare the update data - only include fields that should be updated
      const updateData = {
        full_name: formData.full_name,
        employee_id: formData.employee_id,
        assigned_route_id: formData.assigned_route_id
      };

      const response = await apiService.updateConductor(
        selectedConductor.id,
        updateData
      );

      if (response.success) {
        setSuccessMessage('Conductor updated successfully');
        setShowEditModal(false);
        resetForm();
        await loadConductors();
      } else {
        setError(response.error || 'Failed to update conductor');
      }
    } catch (error: any) {
      console.error('Update error details:', error.response?.data);
      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to update conductor. Please check the data and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConductor = async (conductorId: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiService.deleteConductor(conductorId);
      if (response.success) {
        setSuccessMessage('Conductor deleted successfully');
        setDeleteConfirmModal(null);
        loadConductors();
      } else {
        setError(response.error || 'Failed to delete conductor');
      }
    } catch (error) {
      console.error('Error deleting conductor:', error);
      setError('Failed to delete conductor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignRoute = async (conductorId: string, routeId: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiService.assignConductorToRoute(conductorId, routeId);
      if (response.success) {
        setSuccessMessage('Route assigned successfully');
        loadConductors();
      } else {
        setError(response.error || 'Failed to assign route');
      }
    } catch (error) {
      console.error('Error assigning route:', error);
      setError('Failed to assign route');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadConductorStats = async (conductorId: string) => {
    try {
      const [statsResponse, transactionsResponse] = await Promise.all([
        apiService.getConductorStats(conductorId),
        apiService.getConductorTransactions(conductorId)
      ]);

      if (statsResponse.success) {
        setConductorStats(statsResponse.data);
      }
      if (transactionsResponse.success) {
        setConductorTransactions(transactionsResponse.data || []);
      }
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error loading conductor stats:', error);
      setError('Failed to load conductor statistics');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      full_name: '',
      employee_id: '',
      assigned_route_id: ''
    });
  };

  const openEditModal = (conductor: Conductor) => {
    setSelectedConductor(conductor);
    setFormData({
      username: conductor.username,
      password: '', // Don't populate password for security
      full_name: conductor.full_name,
      employee_id: conductor.employee_id || '',
      assigned_route_id: conductor.assigned_route_id || ''
    });
    setShowEditModal(true);
  };

  const filteredConductors = conductors.filter(conductor => {
    const query = searchQuery.toLowerCase();
    return (
      conductor.full_name.toLowerCase().includes(query) ||
      conductor.username.toLowerCase().includes(query) ||
      conductor.employee_id?.toLowerCase().includes(query) ||
      conductor.route_name?.toLowerCase().includes(query)
    );
  });

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Conductor Management</h2>
          <div className="flex gap-2">
            <button
              onClick={loadConductors}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Conductor
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conductors by name, username, employee ID, or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
          <button onClick={clearMessages} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-700">{successMessage}</span>
          </div>
          <button onClick={clearMessages} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Conductors List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredConductors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No conductors found</p>
              <p className="text-sm">Add a new conductor to get started</p>
            </div>
          ) : (
            filteredConductors.map((conductor) => (
              <div key={conductor.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${conductor.is_active ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                      {conductor.is_active ? (
                        <UserCheck className="w-6 h-6 text-green-600" />
                      ) : (
                        <UserX className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{conductor.full_name}</h3>
                      <p className="text-sm text-gray-600">@{conductor.username}</p>
                      {conductor.employee_id && (
                        <p className="text-xs text-gray-500">Employee ID: {conductor.employee_id}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{conductor.route_name || 'No route assigned'}</span>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${conductor.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}>
                        {conductor.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadConductorStats(conductor.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Statistics"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(conductor)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Edit Conductor"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmModal(conductor.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Conductor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {showAddModal ? 'Add New Conductor' : 'Edit Conductor'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                  clearMessages();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleAddConductor : handleEditConductor} className="space-y-4">
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
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {showAddModal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Route
                </label>
                <select
                  value={formData.assigned_route_id}
                  onChange={(e) => setFormData({ ...formData, assigned_route_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} - {route.boarding_area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                    clearMessages();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : showAddModal ? 'Add Conductor' : 'Update Conductor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this conductor? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConductor(deleteConfirmModal)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {showStatsModal && selectedConductor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                Statistics for {selectedConductor.full_name}
              </h3>
              <button
                onClick={() => {
                  setShowStatsModal(false);
                  setSelectedConductor(null);
                  setConductorStats(null);
                  setConductorTransactions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {conductorStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Total Passengers</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {conductorStats.total_passengers || 0}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Total Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCurrency(conductorStats.total_revenue || 0)}
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Total Boardings</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {conductorStats.total_boardings || 0}
                  </p>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Recent Transactions</h4>
              {conductorTransactions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No transactions found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">Date</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Type</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Amount</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Balance After</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conductorTransactions.slice(0, 10).map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="border border-gray-200 px-4 py-2">
                            {formatDate(transaction.transaction_date, 'datetime')}
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${transaction.transaction_type === 'boarding'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                              }`}>
                              {transaction.transaction_type}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <span className={
                              transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
                            }>
                              {formatCurrency(Math.abs(transaction.amount))}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            {formatCurrency(transaction.balance_after)}
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            {transaction.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConductorManagement;