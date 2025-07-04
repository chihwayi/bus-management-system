import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Edit2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle, 
  MapPin, 
  Route as RouteIcon,
  TrendingUp,
  Calculator,
  History,
  RefreshCw
} from 'lucide-react';
import apiService from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { Route } from '../../types';

interface FareAdjustment {
  route_id: string;
  old_fare: number;
  new_fare: number;
  reason: string;
  adjusted_by: string;
  adjusted_at: string;
}

interface FareCalculation {
  route_id: string;
  distance_km: number;
  base_rate: number;
  distance_multiplier: number;
  calculated_fare: number;
}

const FareManagement: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoute, setEditingRoute] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: number }>({});
  const [adjustmentReasons, setAdjustmentReasons] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fareHistory, setFareHistory] = useState<FareAdjustment[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fareCalculations, setFareCalculations] = useState<FareCalculation[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorSettings, setCalculatorSettings] = useState({
    base_rate: 2.0,
    distance_multiplier: 0.5,
    minimum_fare: 1.0
  });

  useEffect(() => {
    fetchRoutes();
    fetchFareHistory();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllRoutes();
      if (response.success && response.data) {
        setRoutes(response.data);
        // Initialize edit values with current fares
        const initialEditValues: { [key: string]: number } = {};
        response.data.forEach(route => {
          initialEditValues[route.id] = route.base_fare;
        });
        setEditValues(initialEditValues);
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

  const fetchFareHistory = async () => {
    try {
      // Note: This endpoint would need to be implemented in the backend
      // For now, we'll create a mock history based on route updates
      const mockHistory: FareAdjustment[] = [
        {
          route_id: 'route1',
          old_fare: 5.0,
          new_fare: 5.5,
          reason: 'Fuel cost increase',
          adjusted_by: 'Admin',
          adjusted_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      setFareHistory(mockHistory);
    } catch (err) {
      console.error('Error fetching fare history:', err);
    }
  };

  const handleEditStart = (routeId: string) => {
    setEditingRoute(routeId);
    setError(null);
    setSuccess(null);
  };

  const handleEditCancel = () => {
    setEditingRoute(null);
    // Reset edit values to original
    const resetValues: { [key: string]: number } = {};
    routes.forEach(route => {
      resetValues[route.id] = route.base_fare;
    });
    setEditValues(resetValues);
    setAdjustmentReasons({});
  };

  const handleFareChange = (routeId: string, value: number) => {
    setEditValues(prev => ({
      ...prev,
      [routeId]: value
    }));
  };

  const handleReasonChange = (routeId: string, reason: string) => {
    setAdjustmentReasons(prev => ({
      ...prev,
      [routeId]: reason
    }));
  };

  const handleSave = async (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    const newFare = editValues[routeId];
    const reason = adjustmentReasons[routeId] || '';

    if (newFare <= 0) {
      setError('Fare must be greater than 0');
      return;
    }

    if (newFare !== route.base_fare && !reason.trim()) {
      setError('Please provide a reason for the fare change');
      return;
    }

    try {
      const response = await apiService.updateRoute(routeId, {
        name: route.name,
        boarding_area: route.boarding_area,
        distance_km: route.distance_km,
        base_fare: newFare
      });

      if (response.success) {
        setSuccess(`Fare updated successfully for ${route.name}`);
        setEditingRoute(null);
        setAdjustmentReasons({});
        
        // Add to history
        if (newFare !== route.base_fare) {
          const historyEntry: FareAdjustment = {
            route_id: routeId,
            old_fare: route.base_fare,
            new_fare: newFare,
            reason: reason,
            adjusted_by: 'Current User', // This would come from auth context
            adjusted_at: new Date().toISOString()
          };
          setFareHistory(prev => [historyEntry, ...prev]);
        }
        
        // Refresh routes
        fetchRoutes();
      } else {
        setError('Failed to update fare');
      }
    } catch (err) {
      setError('Error updating fare');
      console.error('Error updating fare:', err);
    }
  };

  const calculateFares = () => {
    const calculations: FareCalculation[] = routes
      .filter(route => route.distance_km && route.distance_km > 0)
      .map(route => {
        const baseFare = calculatorSettings.base_rate;
        const distanceFee = route.distance_km! * calculatorSettings.distance_multiplier;
        const calculatedFare = Math.max(
          baseFare + distanceFee,
          calculatorSettings.minimum_fare
        );

        return {
          route_id: route.id,
          distance_km: route.distance_km!,
          base_rate: calculatorSettings.base_rate,
          distance_multiplier: calculatorSettings.distance_multiplier,
          calculated_fare: Math.round(calculatedFare * 100) / 100
        };
      });

    setFareCalculations(calculations);
  };

  const applyCalculatedFares = () => {
    const newEditValues: { [key: string]: number } = { ...editValues };
    fareCalculations.forEach(calc => {
      newEditValues[calc.route_id] = calc.calculated_fare;
    });
    setEditValues(newEditValues);
    setShowCalculator(false);
    setSuccess('Calculated fares applied. Don\'t forget to save changes!');
  };

  const getVarianceIndicator = (currentFare: number, calculatedFare: number) => {
    const variance = ((currentFare - calculatedFare) / calculatedFare) * 100;
    if (Math.abs(variance) < 5) return { color: 'text-green-600', text: 'Optimal' };
    if (variance > 5) return { color: 'text-orange-600', text: 'Above calculated' };
    return { color: 'text-red-600', text: 'Below calculated' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fare Management</h1>
          <p className="text-gray-600">Manage bus fares and pricing for all routes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCalculator(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Fare Calculator
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={fetchRoutes}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Routes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Route Fares</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boarding Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Fare
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
              {routes.map((route) => {
                const isEditing = editingRoute === route.id;
                const calculation = fareCalculations.find(c => c.route_id === route.id);
                const variance = calculation ? getVarianceIndicator(route.base_fare, calculation.calculated_fare) : null;
                
                return (
                  <tr key={route.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{route.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{route.boarding_area}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {route.distance_km ? `${route.distance_km} km` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValues[route.id] || 0}
                            onChange={(e) => handleFareChange(route.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(route.base_fare)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${route.is_active ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        <span className={`text-xs ${route.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {route.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {variance && (
                          <span className={`text-xs ${variance.color} ml-2`}>
                            {variance.text}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(route.id)}
                            className="text-green-600 hover:text-green-800 transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditStart(route.id)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Reason input for editing */}
        {editingRoute && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for fare change (required if changing fare):
              </label>
              <input
                type="text"
                value={adjustmentReasons[editingRoute] || ''}
                onChange={(e) => handleReasonChange(editingRoute, e.target.value)}
                placeholder="e.g., Fuel cost increase, Distance adjustment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fare Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Fare Calculator</h3>
              <button
                onClick={() => setShowCalculator(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Calculator Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculatorSettings.base_rate}
                    onChange={(e) => setCalculatorSettings(prev => ({
                      ...prev,
                      base_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Per KM Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculatorSettings.distance_multiplier}
                    onChange={(e) => setCalculatorSettings(prev => ({
                      ...prev,
                      distance_multiplier: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Fare ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculatorSettings.minimum_fare}
                    onChange={(e) => setCalculatorSettings(prev => ({
                      ...prev,
                      minimum_fare: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={calculateFares}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  Calculate Fares
                </button>
                {fareCalculations.length > 0 && (
                  <button
                    onClick={applyCalculatedFares}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Apply Calculated Fares
                  </button>
                )}
              </div>

              {/* Calculation Results */}
              {fareCalculations.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Calculated Fares</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Calculated</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {fareCalculations.map((calc) => {
                          const route = routes.find(r => r.id === calc.route_id);
                          const difference = calc.calculated_fare - (route?.base_fare || 0);
                          return (
                            <tr key={calc.route_id}>
                              <td className="px-4 py-2 text-sm text-gray-900">{route?.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{calc.distance_km} km</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(route?.base_fare || 0)}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(calc.calculated_fare)}</td>
                              <td className={`px-4 py-2 text-sm ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Fare Change History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Fare</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Fare</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjusted By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fareHistory.map((adjustment, index) => {
                    const route = routes.find(r => r.id === adjustment.route_id);
                    const change = adjustment.new_fare - adjustment.old_fare;
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(adjustment.adjusted_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {route?.name || 'Unknown Route'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(adjustment.old_fare)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(adjustment.new_fare)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {change >= 0 ? '+' : ''}{formatCurrency(change)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {adjustment.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {adjustment.adjusted_by}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {fareHistory.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No fare change history available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FareManagement;