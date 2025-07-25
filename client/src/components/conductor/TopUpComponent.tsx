import React, { useState, useEffect } from 'react';
import { Search, Plus, DollarSign, CreditCard, User, X, Bell, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency, getBalanceStatusConfig } from '../../utils/helpers';
import apiService from '../../services/api';
import type { Passenger } from '../../types';

interface TopUpComponentProps {
  passengers: Passenger[];
  onPassengerUpdate?: (updatedPassenger: Passenger) => void;
  className?: string;
}

interface NotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ 
  type, 
  message, 
  onClose, 
  duration = 3000 
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const typeStyles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white'
  };

  return (
    <div className={`fixed top-4 left-4 right-4 sm:right-4 sm:left-auto sm:min-w-[300px] z-50 p-3 rounded-lg shadow-lg ${typeStyles[type]} flex items-center gap-2 animate-in slide-in-from-top sm:slide-in-from-right duration-300`}>
      <Bell className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1 break-words">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white hover:bg-opacity-20 rounded flex-shrink-0">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

// Passenger Search Component for Top-up
const PassengerTopUpSearch: React.FC<{
  passengers: Passenger[];
  onSelectPassenger: (passenger: Passenger) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}> = ({ passengers, onSelectPassenger, searchQuery, onSearchChange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredPassengers, setFilteredPassengers] = useState<Passenger[]>([]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const filtered = passengers.filter(passenger =>
        passenger.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        passenger.legacy_passenger_id?.toString().includes(searchQuery) ||
        passenger.ministry.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10); // Limit to 10 results
      
      setFilteredPassengers(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredPassengers([]);
      setShowDropdown(false);
    }
  }, [searchQuery, passengers]);

  const handleSelectPassenger = (passenger: Passenger) => {
    onSelectPassenger(passenger);
    setShowDropdown(false);
    onSearchChange('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, ID, or ministry..."
          className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {filteredPassengers.map((passenger) => {
            const balanceConfig = getBalanceStatusConfig(passenger.current_balance);
            return (
              <button
                key={passenger.id}
                onClick={() => handleSelectPassenger(passenger)}
                className="w-full p-3 sm:p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {passenger.full_name}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      ID: #{passenger.legacy_passenger_id}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {passenger.ministry}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ml-2 ${balanceConfig.textColor}`}>
                    {formatCurrency(passenger.current_balance)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Selected Passenger Card
const SelectedPassengerCard: React.FC<{
  passenger: Passenger;
  onDeselect: () => void;
}> = ({ passenger, onDeselect }) => {
  const balanceConfig = getBalanceStatusConfig(passenger.current_balance);

  return (
    <div className={`p-4 rounded-lg border-2 ${balanceConfig.borderColor} ${balanceConfig.bgColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="bg-white p-2 rounded-full flex-shrink-0">
            <User className="h-6 w-6 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{passenger.full_name}</h3>
            <p className="text-sm text-gray-600">ID: #{passenger.legacy_passenger_id}</p>
            <p className="text-xs text-gray-500 truncate">{passenger.ministry}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className={`font-bold ${balanceConfig.textColor}`}>
              {formatCurrency(passenger.current_balance)}
            </span>
          </div>
          <button
            onClick={onDeselect}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white hover:bg-opacity-50"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
};

const TopUpComponent: React.FC<TopUpComponentProps> = ({
  passengers,
  onPassengerUpdate,
  className = ''
}) => {
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ 
    type: 'success' | 'error' | 'info'; 
    message: string 
  } | null>(null);

  // Quick top-up amounts
  const quickAmounts = [20, 50, 100, 200, 500, 1000];

  // Handle top-up with actual API integration
  const handleTopUp = async (amount: number) => {
    if (!selectedPassenger) return;
    
    if (amount <= 0) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid amount greater than 0'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call actual API service
      const response = await apiService.topupPassenger(
        selectedPassenger.id,
        amount,
        `Top-up from conductor dashboard`
      );

      if (response.success && response.data) {
        // Update selected passenger balance
        const updatedPassenger = {
          ...selectedPassenger,
          current_balance: selectedPassenger.current_balance + amount
        };
        
        setSelectedPassenger(updatedPassenger);
        
        // Notify parent component of the update
        if (onPassengerUpdate) {
          onPassengerUpdate(updatedPassenger);
        }

        setNotification({
          type: 'success',
          message: `Successfully topped up ${selectedPassenger.full_name} with ${formatCurrency(amount)}!`
        });
        
        // Reset custom amount
        setCustomAmount('');
      } else {
        throw new Error(response.error || 'Failed to process top-up');
      }
    } catch (error: any) {
      console.error('Top-up error:', error);
      setNotification({
        type: 'error',
        message: apiService.handleApiError(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomTopUp = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid amount'
      });
      return;
    }
    handleTopUp(amount);
  };

  const handlePassengerUpdate = (updatedPassenger: Passenger) => {
    // Update the selected passenger if it matches
    if (selectedPassenger && selectedPassenger.id === updatedPassenger.id) {
      setSelectedPassenger(updatedPassenger);
    }
    
    // Propagate the update to parent
    if (onPassengerUpdate) {
      onPassengerUpdate(updatedPassenger);
    }
  };

  return (
    <>
      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className={`bg-white rounded-lg shadow-sm border relative ${className}`}>
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Balance Top-Up</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Add balance to passenger accounts
          </p>
        </div>

        <div className="p-4 space-y-6">
          {/* Passenger Selection */}
          {!selectedPassenger ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Passenger
              </label>
              <PassengerTopUpSearch
                passengers={passengers}
                onSelectPassenger={setSelectedPassenger}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selected Passenger
              </label>
              <SelectedPassengerCard
                passenger={selectedPassenger}
                onDeselect={() => setSelectedPassenger(null)}
              />
            </div>
          )}

          {/* Top-up Options */}
          {selectedPassenger && (
            <div className="space-y-6">
              {/* Quick Amounts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quick Top-up Amounts
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleTopUp(amount)}
                      disabled={isLoading}
                      className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 active:bg-green-100 transition-all duration-200 flex items-center justify-center gap-2 font-medium text-gray-700 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      <span className="text-sm sm:text-base">{formatCurrency(amount)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Custom Amount
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter amount..."
                      min="0"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleCustomTopUp}
                    disabled={isLoading || !customAmount}
                    className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors touch-manipulation"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Top Up
                  </button>
                </div>
              </div>

              {/* Balance Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Current Balance:</span>
                  <span className="font-medium">{formatCurrency(selectedPassenger.current_balance)}</span>
                </div>
                {customAmount && !isNaN(parseFloat(customAmount)) && parseFloat(customAmount) > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Top-up Amount:</span>
                      <span className="font-medium text-green-600">+{formatCurrency(parseFloat(customAmount))}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-gray-900">New Balance:</span>
                        <span className="text-green-600 text-lg">
                          {formatCurrency(selectedPassenger.current_balance + parseFloat(customAmount))}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setSelectedPassenger(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-medium transition-colors touch-manipulation"
                >
                  Select Different Passenger
                </button>
                <button
                  onClick={() => {
                    setCustomAmount('');
                    setNotification(null);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-medium transition-colors touch-manipulation"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {passengers.length === 0 && (
            <div className="text-center py-12">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-base font-medium text-gray-900 mb-2">No Passengers Available</h3>
              <p className="text-sm text-gray-500 px-4">
                No passengers found in your current route.
              </p>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-green-500" />
              <span className="text-sm font-medium text-gray-600">Processing top-up...</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TopUpComponent;