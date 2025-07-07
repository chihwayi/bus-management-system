import React, { useState, useEffect } from 'react';
import { Search, Edit, DollarSign, CreditCard, User, X, Bell, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency, getBalanceStatusConfig } from '../../utils/helpers';
import apiService from '../../services/api';
import type { Passenger } from '../../types';

interface BalanceEditComponentProps {
  passengers: Passenger[];
  onPassengerUpdate?: (updatedPassenger: Passenger) => void;
  className?: string;
}

const BalanceEditComponent: React.FC<BalanceEditComponentProps> = ({
  passengers,
  onPassengerUpdate,
  className = ''
}) => {
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ 
    type: 'success' | 'error' | 'info'; 
    message: string 
  } | null>(null);

  // Handle balance update with actual API integration
  const handleBalanceUpdate = async () => {
    if (!selectedPassenger) return;
    
    const amount = parseFloat(newBalance);
    if (isNaN(amount) || amount < 0) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid balance amount (≥ 0)'
      });
      return;
    }

    if (!reason.trim()) {
      setNotification({
        type: 'error',
        message: 'Please provide a reason for the balance adjustment'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call API service to update balance
      const response = await apiService.updatePassengerBalance(
        selectedPassenger.id,
        amount,
        reason.trim()
      );

      if (response.success && response.data) {
        // Update selected passenger balance
        const updatedPassenger = {
          ...selectedPassenger,
          current_balance: amount
        };
        
        setSelectedPassenger(updatedPassenger);
        
        // Notify parent component of the update
        if (onPassengerUpdate) {
          onPassengerUpdate(updatedPassenger);
        }

        setNotification({
          type: 'success',
          message: `Successfully updated ${selectedPassenger.full_name}'s balance to ${formatCurrency(amount)}!`
        });
        
        // Reset form
        setNewBalance('');
        setReason('');
      } else {
        throw new Error(response.error || 'Failed to process balance update');
      }
    } catch (error: any) {
      console.error('Balance update error:', error);
      setNotification({
        type: 'error',
        message: apiService.handleApiError(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter passengers based on search query
  const filteredPassengers = searchQuery.length > 0
    ? passengers.filter(passenger =>
        passenger.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        passenger.legacy_passenger_id?.toString().includes(searchQuery) ||
        passenger.ministry.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
    : [];

  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-4 right-4 sm:right-4 sm:left-auto sm:min-w-[300px] z-50 p-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white flex items-center gap-2 animate-in slide-in-from-top sm:slide-in-from-right duration-300`}>
          <Bell className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium flex-1 break-words">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-white hover:bg-opacity-20 rounded flex-shrink-0">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className={`bg-white rounded-lg shadow-sm border relative ${className}`}>
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <Edit className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Balance Adjustment</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Correct or manually set passenger account balances
          </p>
        </div>

        <div className="p-4 space-y-6">
          {/* Passenger Selection */}
          {!selectedPassenger ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Passenger
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, or ministry..."
                    className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Dropdown */}
                {searchQuery.length > 0 && filteredPassengers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {filteredPassengers.map((passenger) => {
                      const balanceConfig = getBalanceStatusConfig(passenger.current_balance);
                      return (
                        <button
                          key={passenger.id}
                          onClick={() => {
                            setSelectedPassenger(passenger);
                            setNewBalance(passenger.current_balance.toString());
                            setSearchQuery('');
                          }}
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
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selected Passenger
              </label>
              <div className={`p-4 rounded-lg border-2 ${
                getBalanceStatusConfig(selectedPassenger.current_balance).borderColor
              } ${getBalanceStatusConfig(selectedPassenger.current_balance).bgColor}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="bg-white p-2 rounded-full flex-shrink-0">
                      <User className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{selectedPassenger.full_name}</h3>
                      <p className="text-sm text-gray-600">ID: #{selectedPassenger.legacy_passenger_id}</p>
                      <p className="text-xs text-gray-500 truncate">{selectedPassenger.ministry}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className={`font-bold ${
                        getBalanceStatusConfig(selectedPassenger.current_balance).textColor
                      }`}>
                        {formatCurrency(selectedPassenger.current_balance)}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedPassenger(null)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white hover:bg-opacity-50"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance Edit Form */}
          {selectedPassenger && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Current Balance
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formatCurrency(selectedPassenger.current_balance)}
                    readOnly
                    className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="newBalance" className="block text-sm font-medium text-gray-700 mb-3">
                  New Balance
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="newBalance"
                    type="number"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    placeholder="Enter new balance..."
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-3">
                  Reason for Adjustment
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you're adjusting this balance..."
                  rows={3}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be recorded in the transaction history.
                </p>
              </div>

              {/* Balance Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Current Balance:</span>
                  <span className="font-medium">{formatCurrency(selectedPassenger.current_balance)}</span>
                </div>
                {newBalance && !isNaN(parseFloat(newBalance)) && (
                  <>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">New Balance:</span>
                      <span className={`font-medium ${
                        parseFloat(newBalance) > selectedPassenger.current_balance ? 'text-green-600' :
                        parseFloat(newBalance) < selectedPassenger.current_balance ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatCurrency(parseFloat(newBalance))}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-gray-900">Difference:</span>
                        <span className={`${
                          parseFloat(newBalance) > selectedPassenger.current_balance ? 'text-green-600' :
                          parseFloat(newBalance) < selectedPassenger.current_balance ? 'text-red-600' : 'text-gray-600'
                        } text-lg`}>
                          {parseFloat(newBalance) > selectedPassenger.current_balance ? '+' : ''}
                          {parseFloat(newBalance) < selectedPassenger.current_balance ? '-' : ''}
                          {formatCurrency(Math.abs(parseFloat(newBalance) - selectedPassenger.current_balance))}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleBalanceUpdate}
                  disabled={isLoading || !newBalance || !reason.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors touch-manipulation flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Update Balance
                </button>
                <button
                  onClick={() => {
                    setSelectedPassenger(null);
                    setNewBalance('');
                    setReason('');
                  }}
                  className="flex-1 sm:flex-initial px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-medium transition-colors touch-manipulation"
                >
                  Cancel
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
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
              <span className="text-sm font-medium text-gray-600">Updating balance...</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BalanceEditComponent;