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
  duration = 3000 // Increased duration for mobile
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
    <div className={`fixed top-4 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto z-50 p-3 sm:p-4 rounded-lg border shadow-lg ${config.bg} ${config.text} flex items-start gap-2 sm:gap-3 animate-in slide-in-from-top sm:slide-in-from-right duration-300 sm:min-w-[320px] sm:max-w-[400px]`}>
      <div className="flex-shrink-0 mt-0.5">
        {config.icon}
      </div>
      <span className="text-sm sm:text-base font-medium flex-1 leading-relaxed break-words">{message}</span>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors duration-150 touch-manipulation"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
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

  // Enhanced size configurations for mobile - improved touch targets
  const sizeConfig = useMemo(() => ({
    sm: {
      container: 'p-3 min-h-[100px] sm:p-2 sm:min-h-[80px]', // Larger on mobile
      id: 'text-base font-bold sm:text-sm',
      name: 'text-sm sm:text-xs',
      balance: 'text-sm sm:text-xs',
      icon: 'h-5 w-5 sm:h-4 sm:w-4',
      statusText: 'text-xs',
      clickIndicator: 'text-xs'
    },
    md: {
      container: 'p-4 min-h-[120px] sm:p-3 sm:min-h-[100px]',
      id: 'text-lg font-bold sm:text-base',
      name: 'text-base sm:text-sm',
      balance: 'text-base sm:text-sm',
      icon: 'h-6 w-6 sm:h-5 sm:w-5',
      statusText: 'text-sm sm:text-xs',
      clickIndicator: 'text-sm sm:text-xs'
    },
    lg: {
      container: 'p-5 min-h-[140px] sm:p-4 sm:min-h-[120px]',
      id: 'text-xl font-bold sm:text-lg',
      name: 'text-lg sm:text-base',
      balance: 'text-lg sm:text-base',
      icon: 'h-7 w-7 sm:h-6 sm:w-6',
      statusText: 'text-base sm:text-sm',
      clickIndicator: 'text-base sm:text-sm'
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

  // Enhanced touch/press handling for mobile
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setIsPressed(true);
    
    if (onLongPress) {
      pressTimer.current = setTimeout(() => {
        onLongPress(localPassenger);
        // Haptic feedback for mobile devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, 600); // Shorter for mobile
    }
  }, [onLongPress, localPassenger]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setIsPressed(false);
    setTouchStart(null);
    
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Cancel long press if user moves finger too much
    if (deltaX > 10 || deltaY > 10) {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      setIsPressed(false);
    }
  }, [touchStart]);

  // Legacy mouse handlers for desktop
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

    // Haptic feedback for mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }

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

        // Success haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 50, 50]);
        }

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
      
      // Error haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
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
      return `Tap to deduct ${formatCurrency(localPassenger.base_fare || 0)} from ${localPassenger.full_name}`;
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
          relative rounded-xl border-2 cursor-pointer transition-all duration-200 select-none touch-manipulation
          ${balanceConfig.bgColor} ${balanceConfig.borderColor} ${balanceConfig.textColor}
          ${config.container}
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}
          ${isPressed ? 'scale-95 shadow-md' : canBoard ? 'active:scale-95 hover:scale-105' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : canBoard ? 'hover:shadow-xl active:shadow-md' : 'opacity-70'}
          ${isLoading ? 'animate-pulse' : ''}
          ${justPaid ? 'ring-2 ring-green-400 bg-green-50 animate-pulse' : ''}
          ${className}
        `}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        title={tooltipText}
        role="button"
        tabIndex={0}
        aria-label={tooltipText}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-xl flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
              <span className="text-sm font-medium text-gray-600">
                Processing...
              </span>
            </div>
          </div>
        )}

        {/* Payment success indicator */}
        {justPaid && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-20 rounded-xl flex items-center justify-center z-10">
            <div className="text-center">
              <Check className="h-10 w-10 mx-auto mb-1 text-green-600 animate-in zoom-in duration-300" />
              <span className="text-sm font-bold text-green-700">
                PAID
              </span>
            </div>
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in duration-200">
            <CheckCircle className="h-5 w-5" />
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col h-full">
          {/* Header with ID and balance icon */}
          <div className="flex items-center justify-between mb-2">
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
          <div className={`${config.name} text-gray-700 font-medium truncate flex-1 leading-relaxed`}>
            {localPassenger.full_name}
          </div>

          {/* Balance with enhanced styling */}
          {showBalance && (
            <div className={`${config.balance} font-bold mt-2 flex items-center gap-1`}>
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{formatCurrency(localPassenger.current_balance)}</span>
            </div>
          )}

          {/* Quick status indicators */}
          <div className="mt-2 space-y-1">
            {localPassenger.current_balance < 0 && (
              <div className={`${config.statusText} text-red-600 font-bold animate-pulse`}>
                NEGATIVE
              </div>
            )}

            {localPassenger.current_balance > 0 && localPassenger.current_balance <= 30 && (
              <div className={`${config.statusText} text-orange-600 font-medium`}>
                LOW BALANCE
              </div>
            )}

            {localPassenger.current_balance < (localPassenger.base_fare || 0) && localPassenger.current_balance >= 0 && (
              <div className={`${config.statusText} text-red-600 font-bold`}>
                INSUFFICIENT
              </div>
            )}

            {canBoard && (
              <div className={`${config.statusText} text-blue-600 font-medium`}>
                READY TO PAY
              </div>
            )}
          </div>
        </div>

        {/* Inactive overlay */}
        {!localPassenger.is_active && (
          <div className="absolute inset-0 bg-gray-500 bg-opacity-50 rounded-xl flex items-center justify-center">
            <span className="text-sm font-bold text-white bg-gray-700 px-3 py-2 rounded shadow-lg">
              INACTIVE
            </span>
          </div>
        )}

        {/* Click indicator for valid payments - improved for mobile */}
        {canBoard && !isLoading && !justPaid && (
          <div className="absolute bottom-2 right-2 opacity-60 sm:opacity-50">
            <div className={`${config.clickIndicator} text-gray-600 bg-white bg-opacity-90 px-2 py-1 rounded shadow-sm`}>
              Tap to pay
            </div>
          </div>
        )}
      </div>
    </>
  );
});

// Enhanced Grid container for passenger pills - mobile-optimized
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
  // Enhanced grid configurations for better mobile experience
  const gridCols = useMemo(() => ({
    sm: 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
    md: 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
  }), []);

  const handleBoard = useCallback(async () => {
    console.log('Payment completed');
  }, []);

  return (
    <div className={`grid ${gridCols[size]} gap-3 sm:gap-4 p-2 sm:p-0 ${className}`}>
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

// Enhanced Empty state component - mobile-optimized
export const EmptyPassengerState: React.FC<{
  message?: string;
  showIcon?: boolean;
}> = React.memo(({
  message = "No passengers found",
  showIcon = true
}) => (
  <div className="text-center py-12 px-4">
    {showIcon && (
      <div className="mx-auto h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <User className="h-10 w-10 text-gray-400" />
      </div>
    )}
    <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
      {message}
    </h3>
    <p className="text-gray-500 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
      Try adjusting your filters or search terms to find passengers.
    </p>
  </div>
));

export default PassengerPill;