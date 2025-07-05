import React, { useState, useEffect } from 'react';
import {
  User,
  Building,
  DollarSign,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { MINISTRIES } from '../../utils/constants';
import { validatePassengerData } from '../../utils/validation';
import type { CreatePassengerData, Route } from '../../types';
import apiService from '../../services/api';

interface PassengerRegistrationProps {
  onSubmit: (data: CreatePassengerData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  conductorId?: string;
  routeId?: string;
  className?: string;
  defaultRoute?: Route;
}

interface FormErrors {
  full_name?: string;
  ministry?: string;
  initial_balance?: string;
  legacy_passenger_id?: string;
  general?: string;
}

const PassengerRegistration: React.FC<PassengerRegistrationProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  conductorId,
  routeId,
  className = ''
}) => {
  const [formData, setFormData] = useState<CreatePassengerData>({
    full_name: '',
    ministry: '',
    initial_balance: 0,
    current_balance: 0,
    legacy_passenger_id: undefined,
    conductor_id: conductorId,
    route_id: routeId,
    boarding_area: '' // Will be set dynamically
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [conductorRoute, setConductorRoute] = useState<Route | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('PassengerRegistration props:', {
      conductorId,
      routeId,
      currentUser: apiService.getCurrentUser()
    });

    // Fetch conductor's route information when component mounts or conductorId changes
    const fetchConductorRoute = async () => {
      if (!conductorId) {
        setRouteError('No conductor ID provided');
        setLoadingRoute(false);
        return;
      }

      try {
        setLoadingRoute(true);
        setRouteError(null);

        console.log('Fetching conductor data for ID:', conductorId);
        const conductorResponse = await apiService.getConductor(conductorId);

        if (!conductorResponse.success) {
          throw new Error(conductorResponse.error || 'Failed to fetch conductor data');
        }

        const conductor = conductorResponse.data;
        console.log('Conductor data:', conductor);

        if (!conductor?.assigned_route_id) {
          throw new Error('Conductor is not assigned to any route');
        }

        console.log('Fetching route data for ID:', conductor.assigned_route_id);
        const routeResponse = await apiService.getRoute(conductor.assigned_route_id);

        if (!routeResponse.success) {
          throw new Error(routeResponse.error || 'Failed to fetch route data');
        }

        const route = routeResponse.data;
        console.log('Route data:', route);

        setConductorRoute(route ?? null);
        setFormData(prev => ({
          ...prev,
          boarding_area: route?.boarding_area || '',
          route_id: conductor.assigned_route_id
        }));
      } catch (error) {
        console.error('Error fetching route information:', error);
        setRouteError(error instanceof Error ? error.message : 'Failed to load route information');
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchConductorRoute();
  }, [conductorId]);

  const handleInputChange = (field: keyof CreatePassengerData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field-specific error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const validation = validatePassengerData(formData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      console.log('Final form data before submission:', formData);

      // Only call the onSubmit prop - let parent handle creation
      if (onSubmit) {
        await onSubmit(formData);
      }

      console.log('Passenger registration completed successfully');
      setShowSuccess(true);

      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          full_name: '',
          ministry: '',
          initial_balance: 0,
          current_balance: 0,
          legacy_passenger_id: undefined,
          conductor_id: conductorId,
          route_id: routeId,
          boarding_area: conductorRoute?.boarding_area || ''
        });
        setShowSuccess(false);
        setErrors({});
      }, 2000);

    } catch (error) {
      console.error('Registration error:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to register passenger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      full_name: '',
      ministry: '',
      initial_balance: 0,
      current_balance: 0,
      legacy_passenger_id: undefined,
      conductor_id: conductorId,
      route_id: routeId,
      boarding_area: conductorRoute?.boarding_area || ''
    });
    setErrors({});
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 ${className}`}>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Passenger Registered Successfully!
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {formData.full_name} has been registered and is ready to board.
          </p>
          <button
            onClick={() => setShowSuccess(false)}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Register Another
          </button>
        </div>
      </div>
    );
  }

  if (loadingRoute) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 ${className}`}>
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
          <span className="ml-2 text-sm sm:text-base">Loading route information...</span>
        </div>
        <div className="text-center text-sm text-gray-500 mt-2">
          Please wait while we load the conductor's route details
        </div>
      </div>
    );
  }

  if (routeError) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 ${className}`}>
        <div className="text-center text-red-500 py-8">
          <AlertCircle className="h-6 w-6 mx-auto mb-2" />
          <p className="font-medium text-sm sm:text-base">Failed to load route information</p>
          <p className="text-sm mt-2">{routeError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!conductorRoute) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 ${className}`}>
        <div className="text-center text-red-500 py-8">
          <AlertCircle className="h-6 w-6 mx-auto mb-2" />
          <p className="text-sm sm:text-base">This conductor is not assigned to any route.</p>
          <p className="text-sm mt-2">Please assign a route to this conductor before registering passengers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 mr-3">
              <Plus className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900">
              Register New Passenger
            </h3>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* General error */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <span className="text-sm text-red-800">{errors.general}</span>
            </div>
          </div>
        )}

        {/* Route Information (readonly) */}
        <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Route Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs text-gray-500">Route Name</p>
              <p className="text-sm font-medium break-words">{conductorRoute.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Boarding Area</p>
              <p className="text-sm font-medium break-words">{conductorRoute.boarding_area}</p>
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              className={`block w-full pl-10 pr-3 py-2 sm:py-3 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${errors.full_name ? 'border-red-300' : 'border-gray-300'
                }`}
              placeholder="Enter passenger's full name"
            />
          </div>
          {errors.full_name && (
            <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
          )}
        </div>

        {/* Ministry */}
        <div>
          <label htmlFor="ministry" className="block text-sm font-medium text-gray-700 mb-1">
            Ministry *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building className="h-5 w-5 text-gray-400" />
            </div>
            <select
              id="ministry"
              value={formData.ministry}
              onChange={(e) => handleInputChange('ministry', e.target.value)}
              className={`block w-full pl-10 pr-3 py-2 sm:py-3 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${errors.ministry ? 'border-red-300' : 'border-gray-300'
                }`}
            >
              <option value="">Select Ministry</option>
              {MINISTRIES.map((ministry) => (
                <option key={ministry.code} value={ministry.code}>
                  {ministry.name}
                </option>
              ))}
            </select>
          </div>
          {errors.ministry && (
            <p className="mt-1 text-sm text-red-600">{errors.ministry}</p>
          )}
        </div>

        {/* Initial Balance */}
        <div>
          <label htmlFor="initial_balance" className="block text-sm font-medium text-gray-700 mb-1">
            Initial Balance
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="number"
              id="initial_balance"
              value={formData.initial_balance}
              onChange={(e) => handleInputChange('initial_balance', parseFloat(e.target.value) || 0)}
              className={`block w-full pl-10 pr-3 py-2 sm:py-3 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${errors.initial_balance ? 'border-red-300' : 'border-gray-300'
                }`}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          {errors.initial_balance && (
            <p className="mt-1 text-sm text-red-600">{errors.initial_balance}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Optional: Add initial balance for the passenger
          </p>
        </div>

        {/* Legacy Passenger ID (Optional) */}
        <div>
          <label htmlFor="legacy_passenger_id" className="block text-sm font-medium text-gray-700 mb-1">
            Legacy Passenger ID
          </label>
          <input
            type="number"
            id="legacy_passenger_id"
            value={formData.legacy_passenger_id || ''}
            onChange={(e) => handleInputChange('legacy_passenger_id', e.target.value ? parseInt(e.target.value) : undefined)}
            className={`block w-full px-3 py-2 sm:py-3 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${errors.legacy_passenger_id ? 'border-red-300' : 'border-gray-300'
              }`}
            placeholder="Enter existing passenger ID (optional)"
          />
          {errors.legacy_passenger_id && (
            <p className="mt-1 text-sm text-red-600">{errors.legacy_passenger_id}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Optional: For migrating existing passengers
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 sm:py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full sm:w-auto px-4 py-2 sm:py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {(submitting || isLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {(submitting || isLoading) ? 'Registering...' : 'Register Passenger'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PassengerRegistration;