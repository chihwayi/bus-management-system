import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Route as RouteIcon, 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  DollarSign,
  Search,
  Filter,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import apiService from '../../services/api';
import { formatCurrency } from '../../utils/helpers';
import { BOARDING_AREAS } from '../../utils/constants';
import type { Route, Conductor, Passenger, RouteFormData } from '../../types';

interface RouteStats {
  passengersCount: number;
  conductorsCount: number;
  totalRevenue: number;
}

const RouteManagement: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [routeStats, setRouteStats] = useState<{ [key: string]: RouteStats }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<RouteFormData>({
    name: '',
    boarding_area: '',
    distance_km: 0,
    base_fare: 0
  });

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllRoutes();
      if (response.success && response.data) {
        setRoutes(response.data);
        // Fetch stats for each route
        await fetchRouteStats(response.data);
      } else {
        setError('Failed to fetch routes');
      }
    } catch (err) {
      setError('Error fetching routes');
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRouteStats = async (routeList: Route[]) => {
    const stats: { [key: string]: RouteStats } = {};
    
    for (const route of routeList) {
      try {
        const [passengersResponse, conductorsResponse, statsResponse] = await Promise.all([
          apiService.getRoutePassengers(route.id),
          apiService.getRouteConductors(route.id),
          apiService.getRouteStats(route.id)
        ]);

        stats[route.id] = {
          passengersCount: passengersResponse.data?.length || 0,
          conductorsCount: conductorsResponse.data?.length || 0,
          totalRevenue: statsResponse.data?.total_revenue || 0
        };
      } catch (err) {
        console.error(`Error fetching stats for route ${route.id}:`, err);
        stats[route.id] = {
          passengersCount: 0,
          conductorsCount: 0,
          totalRevenue: 0
        };
      }
    }
    
    setRouteStats(stats);
  };

  const handleCreateRoute = () => {
    setModalMode('create');
    setFormData({
      name: '',
      boarding_area: '',
      distance_km: 0,
      base_fare: 0
    });
    setSelectedRoute(null);
    setShowModal(true);
  };

  const handleEditRoute = (route: Route) => {
    setModalMode('edit');
    setFormData({
      name: route.name,
      boarding_area: route.boarding_area,
      distance_km: route.distance_km || 0,
      base_fare: route.base_fare
    });
    setSelectedRoute(route);
    setShowModal(true);
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!window.confirm(`Are you sure you want to delete the route "${route.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiService.deleteRoute(route.id);
      if (response.success) {
        setSuccess('Route deleted successfully');
        fetchRoutes();
      } else {
        setError('Failed to delete route');
      }
    } catch (err) {
      setError('Error deleting route');
      console.error('Error deleting route:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      let response;
      
      if (modalMode === 'create') {
        response = await apiService.createRoute(formData);
      } else if (selectedRoute) {
        response = await apiService.updateRoute(selectedRoute.id, formData);
      }

      if (response && response.success) {
        setSuccess(`Route ${modalMode === 'create' ? 'created' : 'updated'} successfully`);
        setShowModal(false);
        fetchRoutes();
      } else {
        setError(`Failed to ${modalMode} route`);
      }
    } catch (err) {
      setError(`Error ${modalMode === 'create' ? 'creating' : 'updating'} route`);
      console.error(`Error ${modalMode} route:`, err);
    }
  };

  const filteredRoutes = routes.filter(route => {
    const matchesSearch = route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         route.boarding_area.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && route.is_active) ||
                         (filterStatus === 'inactive' && !route.is_active);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-600">Manage bus routes and their configurations</p>
        </div>
        <button
          onClick={handleCreateRoute}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search routes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Routes</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Routes Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoutes.map((route) => (
            <div key={route.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <RouteIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{route.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {route.boarding_area}
                      </div>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    route.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {route.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Base Fare</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(route.base_fare)}
                    </span>
                  </div>
                  
                  {route.distance_km && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Distance</span>
                      <span className="font-medium">{route.distance_km} km</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {routeStats[route.id]?.passengersCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Passengers</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {routeStats[route.id]?.conductorsCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Conductors</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <DollarSign className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(routeStats[route.id]?.totalRevenue || 0)}
                      </div>
                      <div className="text-xs text-gray-500">Revenue</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleEditRoute(route)}
                    className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(route)}
                    className="flex-1 bg-red-50 text-red-700 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredRoutes.length === 0 && !loading && (
        <div className="text-center py-12">
          <RouteIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Get started by creating your first route.'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <button
              onClick={handleCreateRoute}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Create Route
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {modalMode === 'create' ? 'Create New Route' : 'Edit Route'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter route name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Boarding Area *
                  </label>
                  <select
                    required
                    value={formData.boarding_area}
                    onChange={(e) => setFormData(prev => ({ ...prev, boarding_area: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select boarding area</option>
                    {BOARDING_AREAS.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.distance_km || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      distance_km: e.target.value ? parseFloat(e.target.value) : 0 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter distance"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Fare ({formatCurrency(0).replace('0.00', '')}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.base_fare || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      base_fare: e.target.value ? parseFloat(e.target.value) : 0 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter base fare"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {modalMode === 'create' ? 'Create Route' : 'Update Route'}
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

export default RouteManagement;