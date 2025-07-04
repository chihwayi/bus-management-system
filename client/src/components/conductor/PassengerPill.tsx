import React, { useState, useRef, useCallback, useMemo } from 'react';
import { User, AlertCircle, CheckCircle, Minus, Bus, Loader2, DollarSign, Check, X } from 'lucide-react';
import { formatCurrency, getBalanceStatusConfig } from '../../utils/helpers';
import apiService from '../../services/api';
import type { Passenger } from '../../types';

interface PassengerPillProps {
  passenger: Passenger;
  isSelected?: boolean;
  isDisabled?: boolean;
  showBalance?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (passenger: Passenger) => void;
  onLongPress?: (passenger: Passenger) => void;
  className?: string;
  onSelect: () => void;
  onBoard: () => Promise<void>;
  conductorId?: string;
  routeId?: string;
  onPassengerUpdate?: (updatedPassenger: Passenger) => void;
}

interface ToastNotificationProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  onClose: () => void;
  duration?: number;
}

const ToastNotification: React.FC<ToastNotificationProps> = React.memo(({
  type,
  message,
  onClose,
  duration = 2500
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const typeConfig = useMemo(() => ({
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: <Check className="h-4 w-4 text-green-600" />
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <X className="h-4 w-4 text-red-600" />
    },
    warning: {
      bg: 'bg-orange-50 border-orange-200',
      text: 'text-orange-800',
      icon: <AlertCircle className="h-4 w-4 text-orange-600" />
    }
  }), []);

  const config = typeConfig[type];

  return (
    <div className={`fixed top-4 right-4 z-50 p-3 rounded-lg border shadow-lg ${config.bg} ${config.text} flex items-center gap-2 animate-in slide-in-from-right duration-300 min-w-[280px] max-w-[400px]`}>
      {config.icon}
      <span className="text-sm font-medium flex-1 leading-tight">{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors duration-150"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
});

const PassengerPill: React.FC<PassengerPillProps> = React.memo(({
  passenger,
  isSelected = false,
  isDisabled = false,
  showBalance = true,
  size = 'md',
  onClick,
  onLongPress,
  className = '',
  onBoard,
  conductorId,
  routeId,
  onPassengerUpdate
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string
  } | null>(null);
  const [localPassenger, setLocalPassenger] = useState<Passenger>(passenger);
  const [justPaid, setJustPaid] = useState(false);

  // Memoize expensive calculations
  const balanceConfig = useMemo(() => getBalanceStatusConfig(localPassenger.current_balance), [localPassenger.current_balance]);
  const displayId = useMemo(() => localPassenger.legacy_passenger_id || 'N/A', [localPassenger.legacy_passenger_id]);
  const canBoard = useMemo(() => 
    localPassenger.current_balance >= (localPassenger.base_fare || 0) && localPassenger.is_active,
    [localPassenger.current_balance, localPassenger.base_fare, localPassenger.is_active]
  );

  // Size configurations - memoized to prevent recreation
  const sizeConfig = useMemo(() => ({
    sm: {
      container: 'p-2 min-h-[80px]',
      id: 'text-sm font-bold',
      name: 'text-xs',
      balance: 'text-xs',
      icon: 'h-4 w-4',
    },
    md: {
      container: 'p-3 min-h-[100px]',
      id: 'text-base font-bold',
      name: 'text-sm',
      balance: 'text-sm',
      icon: 'h-5 w-5',
    },
    lg: {
      container: 'p-4 min-h-[120px]',
      id: 'text-lg font-bold',
      name: 'text-base',
      balance: 'text-base',
      icon: 'h-6 w-6',
    }
  }), []);

  const config = sizeConfig[size];

  // Update local passenger when prop changes - optimized
  React.useEffect(() => {
    if (passenger.id !== localPassenger.id || passenger.current_balance !== localPassenger.current_balance) {
      setLocalPassenger(passenger);
    }
  }, [passenger, localPassenger.id, localPassenger.current_balance]);

  // Reset just paid status after animation
  React.useEffect(() => {
    if (justPaid) {
      const timer = setTimeout(() => setJustPaid(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [justPaid]);

  // Long press handling - optimized with useCallback
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
    if (onLongPress) {
      pressTimer.current = setTimeout(() => {
        onLongPress(localPassenger);
      }, 800);
    }
  }, [onLongPress, localPassenger]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Optimize notification close handler
  const handleNotificationClose = useCallback(() => {
    setNotification(null);
  }, []);

  // Auto-deduct fare on click - optimized
  const handleClick = useCallback(async () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    if (isDisabled || isLoading) return;

    // Call optional onClick prop first
    if (onClick) {
      onClick(localPassenger);
    }

    // Check if passenger can board
    if (!localPassenger.is_active) {
      setNotification({
        type: 'error',
        message: `${localPassenger.full_name} is inactive`
      });
      return;
    }

    // Get fare amount from passenger's route
    const fareAmount = localPassenger.base_fare || 0;

    if (localPassenger.current_balance < fareAmount) {
      setNotification({
        type: 'error',
        message: `Insufficient balance! ${formatCurrency(localPassenger.current_balance)} < ${formatCurrency(fareAmount)}`
      });
      return;
    }

    if (!conductorId || !routeId) {
      setNotification({
        type: 'error',
        message: 'Missing conductor or route information'
      });
      return;
    }

    // Auto-deduct fare
    setIsLoading(true);

    try {
      const response = await apiService.boardPassenger(
        localPassenger.id,
        conductorId,
        routeId,
        fareAmount
      );

      if (response.success && response.data) {
        const updatedPassenger = response.data;

        setLocalPassenger(updatedPassenger);
        setJustPaid(true);

        if (onPassengerUpdate) {
          onPassengerUpdate(updatedPassenger);
        }

        let message = `✓ ${localPassenger.full_name} - Paid ${formatCurrency(fareAmount)}`;
        let notificationType: 'success' | 'warning' = 'success';

        if (updatedPassenger.current_balance <= 0) {
          message += ` | Balance: ${formatCurrency(updatedPassenger.current_balance)} - CRITICAL!`;
          notificationType = 'warning';
        } else if (updatedPassenger.current_balance <= 30) {
          message += ` | Balance: ${formatCurrency(updatedPassenger.current_balance)} - Low`;
          notificationType = 'warning';
        } else {
          message += ` | Balance: ${formatCurrency(updatedPassenger.current_balance)}`;
        }

        setNotification({
          type: notificationType,
          message
        });

        await onBoard();
      } else {
        throw new Error(response.error || 'Failed to process payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setNotification({
        type: 'error',
        message: `Payment failed: ${apiService.handleApiError(error)}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [isDisabled, isLoading, onClick, localPassenger, conductorId, routeId, onPassengerUpdate, onBoard]);

  // Balance status icon with enhanced styling - memoized
  const balanceIcon = useMemo(() => {
    if (localPassenger.current_balance < 0) {
      return <AlertCircle className={`${config.icon} text-red-500 animate-pulse`} />;
    } else if (localPassenger.current_balance === 0) {
      return <Minus className={`${config.icon} text-red-500`} />;
    } else if (localPassenger.current_balance <= 30) {
      return <AlertCircle className={`${config.icon} text-orange-500`} />;
    }
    return <CheckCircle className={`${config.icon} text-green-500`} />;
  }, [localPassenger.current_balance, config.icon]);

  // Memoize tooltip text
  const tooltipText = useMemo(() => {
    if (canBoard) {
      return `Click to deduct ${formatCurrency(localPassenger.base_fare || 0)} from ${localPassenger.full_name}`;
    }
    return `Cannot board: ${!localPassenger.is_active ? 'Inactive' : 'Insufficient balance'}`;
  }, [canBoard, localPassenger.base_fare, localPassenger.full_name, localPassenger.is_active]);

  return (
    <>
      {notification && (
        <ToastNotification
          type={notification.type}
          message={notification.message}
          onClose={handleNotificationClose}
        />
      )}

      <div
        className={`
          relative rounded-xl border-2 cursor-pointer transition-all duration-300 select-none
          ${balanceConfig.bgColor} ${balanceConfig.borderColor} ${balanceConfig.textColor}
          ${config.container}
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}
          ${isPressed ? 'scale-95' : canBoard ? 'hover:scale-105' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : canBoard ? 'hover:shadow-xl' : 'opacity-70'}
          ${isLoading ? 'animate-pulse' : ''}
          ${justPaid ? 'ring-2 ring-green-400 bg-green-50 animate-pulse' : ''}
          ${className}
        `}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        title={tooltipText}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-xl flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
              <span className="text-xs font-medium text-gray-600">
                Processing...
              </span>
            </div>
          </div>
        )}

        {/* Payment success indicator */}
        {justPaid && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-20 rounded-xl flex items-center justify-center z-10">
            <div className="text-center">
              <Check className="h-8 w-8 mx-auto mb-1 text-green-600 animate-in zoom-in duration-300" />
              <span className="text-xs font-bold text-green-700">
                PAID
              </span>
            </div>
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in duration-200">
            <CheckCircle className="h-4 w-4" />
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col h-full">
          {/* Header with ID and balance icon */}
          <div className="flex items-center justify-between mb-1">
            <span className={`${config.id} truncate`}>
              #{displayId}
            </span>
            <div className="flex items-center gap-1">
              {showBalance && balanceIcon}
              {canBoard && (
                <Bus className={`${config.icon} text-blue-500 opacity-70`} />
              )}
            </div>
          </div>

          {/* Passenger name */}
          <div className={`${config.name} text-gray-700 font-medium truncate flex-1`}>
            {localPassenger.full_name}
          </div>

          {/* Balance with enhanced styling */}
          {showBalance && (
            <div className={`${config.balance} font-bold mt-1 flex items-center gap-1`}>
              <DollarSign className="h-3 w-3" />
              {formatCurrency(localPassenger.current_balance)}
            </div>
          )}

          {/* Quick status indicators */}
          <div className="mt-1 space-y-1">
            {localPassenger.current_balance < 0 && (
              <div className="text-xs text-red-600 font-bold animate-pulse">
                NEGATIVE
              </div>
            )}

            {localPassenger.current_balance > 0 && localPassenger.current_balance <= 30 && (
              <div className="text-xs text-orange-600 font-medium">
                LOW BALANCE
              </div>
            )}

            {localPassenger.current_balance < (localPassenger.base_fare || 0) && localPassenger.current_balance >= 0 && (
              <div className="text-xs text-red-600 font-bold">
                INSUFFICIENT
              </div>
            )}

            {canBoard && (
              <div className="text-xs text-blue-600 font-medium">
                READY TO PAY
              </div>
            )}
          </div>
        </div>

        {/* Inactive overlay */}
        {!localPassenger.is_active && (
          <div className="absolute inset-0 bg-gray-500 bg-opacity-50 rounded-xl flex items-center justify-center">
            <span className="text-xs font-bold text-white bg-gray-700 px-2 py-1 rounded shadow-lg">
              INACTIVE
            </span>
          </div>
        )}

        {/* Click indicator for valid payments */}
        {canBoard && !isLoading && !justPaid && (
          <div className="absolute bottom-1 right-1 opacity-50">
            <div className="text-xs text-gray-500 bg-white bg-opacity-80 px-2 py-1 rounded">
              Click to pay
            </div>
          </div>
        )}
      </div>
    </>
  );
});

// Enhanced Grid container for passenger pills - optimized
export const PassengerPillGrid: React.FC<{
  passengers: Passenger[];
  selectedPassenger?: Passenger;
  onPassengerSelect?: (passenger: Passenger) => void;
  onPassengerLongPress?: (passenger: Passenger) => void;
  showBalance?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  conductorId?: string;
  routeId?: string;
  onPassengerUpdate?: (updatedPassenger: Passenger) => void;
}> = React.memo(({
  passengers,
  selectedPassenger,
  onPassengerSelect,
  onPassengerLongPress,
  showBalance = true,
  size = 'md',
  className = '',
  conductorId,
  routeId,
  onPassengerUpdate
}) => {
  const gridCols = useMemo(() => ({
    sm: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
    md: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  }), []);

  const handleBoard = useCallback(async () => {
    console.log('Payment completed');
  }, []);

  return (
    <div className={`grid ${gridCols[size]} gap-4 ${className}`}>
      {passengers.map((passenger) => (
        <PassengerPill
          key={passenger.id}
          passenger={passenger}
          isSelected={selectedPassenger?.id === passenger.id}
          onClick={onPassengerSelect}
          onLongPress={onPassengerLongPress}
          showBalance={showBalance}
          size={size}
          onSelect={() => onPassengerSelect?.(passenger)}
          conductorId={conductorId}
          routeId={routeId}
          onPassengerUpdate={onPassengerUpdate}
          onBoard={handleBoard}
        />
      ))}
    </div>
  );
});

// Enhanced Empty state component - memoized
export const EmptyPassengerState: React.FC<{
  message?: string;
  showIcon?: boolean;
}> = React.memo(({
  message = "No passengers found",
  showIcon = true
}) => (
  <div className="text-center py-16">
    {showIcon && (
      <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <User className="h-8 w-8 text-gray-400" />
      </div>
    )}
    <h3 className="text-xl font-semibold text-gray-900 mb-3">
      {message}
    </h3>
    <p className="text-gray-500 max-w-md mx-auto">
      Try adjusting your filters or search terms to find passengers.
    </p>
  </div>
));

export default PassengerPill;