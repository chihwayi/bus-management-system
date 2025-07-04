import { BALANCE_THRESHOLDS, BALANCE_STATUS_CONFIG, CURRENCY_SYMBOL } from './constants';
import type { BalanceStatus, Passenger } from '../types';

/**
 * Format currency amount
 */
export const formatCurrency = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${Math.abs(amount).toFixed(2)}`;
};

/**
 * Format currency with sign
 */
export const formatCurrencyWithSign = (amount: number): string => {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${CURRENCY_SYMBOL}${Math.abs(amount).toFixed(2)}`;
};

/**
 * Get balance status based on amount
 */
export const getBalanceStatus = (balance: number): keyof typeof BALANCE_STATUS_CONFIG => {
  if (balance < 0) return 'negative';
  if (balance === 0) return 'zero';
  if (balance <= BALANCE_THRESHOLDS.LOW_BALANCE) return 'low';
  return 'good';
};

/**
 * Get balance status configuration
 */
export const getBalanceStatusConfig = (balance: number) => {
  const status = getBalanceStatus(balance);
  return BALANCE_STATUS_CONFIG[status];
};

/**
 * Format date string
 */
export const formatDate = (dateString: string | Date, format: 'short' | 'long' | 'time' | 'datetime' = 'short'): string => {
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const options: Intl.DateTimeFormatOptions = {};
  
  switch (format) {
    case 'short':
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      break;
    case 'long':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
    case 'datetime':
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
  }

  return date.toLocaleDateString('en-US', options);
};

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (dateString: string | Date): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Validate passenger ID format
 */
export const isValidPassengerId = (id: string): boolean => {
  return /^\d+$/.test(id.trim());
};

/**
 * Format passenger display name
 */
export const formatPassengerDisplayName = (passenger: Passenger): string => {
  const id = passenger.legacy_passenger_id || 'N/A';
  return `${id} - ${passenger.full_name}`;
};

/**
 * Get passenger pill color classes
 */
export const getPassengerPillClasses = (balance: number): string => {
  const config = getBalanceStatusConfig(balance);
  return `${config.bgColor} ${config.textColor} ${config.borderColor} border-2`;
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Filter passengers by search query
 */
export const filterPassengers = (passengers: Passenger[], query: string): Passenger[] => {
  if (!query.trim()) return passengers;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return passengers.filter(passenger => {
    const matchesName = passenger.full_name.toLowerCase().includes(lowerQuery);
    const matchesId = passenger.legacy_passenger_id?.toString().includes(lowerQuery);
    const matchesMinistry = passenger.ministry.toLowerCase().includes(lowerQuery);
    const matchesBoardingArea = passenger.boarding_area.toLowerCase().includes(lowerQuery);
    
    return matchesName || matchesId || matchesMinistry || matchesBoardingArea;
  });
};

/**
 * Sort passengers by balance status and name
 */
export const sortPassengers = (passengers: Passenger[]): Passenger[] => {
  return [...passengers].sort((a, b) => {
    // First sort by balance status (negative, zero, low, good)
    const statusA = getBalanceStatus(a.current_balance);
    const statusB = getBalanceStatus(b.current_balance);
    
    const statusOrder = { negative: 0, zero: 1, low: 2, good: 3 };
    const statusComparison = statusOrder[statusA] - statusOrder[statusB];
    
    if (statusComparison !== 0) {
      return statusComparison;
    }
    
    // Then sort by name
    return a.full_name.localeCompare(b.full_name);
  });
};

/**
 * Check if app is offline
 */
export const isOffline = (): boolean => {
  return !navigator.onLine;
};

/**
 * Convert bytes to human readable format
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,15}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * Generate random color
 */
export const generateRandomColor = (): string => {
  const colors = [
    'bg-red-100 text-red-800',
    'bg-yellow-100 text-yellow-800',
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Truncate text
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Download file
 */
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};