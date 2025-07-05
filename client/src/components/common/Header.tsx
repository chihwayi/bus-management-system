// Header.tsx
import React, { useState } from 'react';
import { User, Settings, LogOut, Wifi, WifiOff, Menu, X } from 'lucide-react';
import { APP_NAME } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/helpers';
import type { User as UserType } from '../../types';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  user?: UserType;
  isOnline: boolean;
  lastSync?: Date | null;
  pendingTransactions?: number;
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  user,
  isOnline,
  lastSync,
  pendingTransactions = 0,
  onMobileMenuToggle,
  isMobileMenuOpen = false
}) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    // Clear user data and redirect to login
    localStorage.removeItem('psc_bus_auth_token');
    localStorage.removeItem('psc_bus_user_data');
    navigate('/login');
  };

  const handleSettings = () => {
    navigate(user?.role === 'admin' ? '/admin/settings' : '/conductor/settings');
    setShowUserMenu(false);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Mobile menu button and Logo */}
          <div className="flex items-center space-x-3">
            {/* Mobile menu button */}
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Logo and App Name */}
            <div className="flex-shrink-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">{APP_NAME}</h1>
            </div>
          </div>

          {/* Center - Connection Status (Hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Online/Offline Status */}
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <div className="flex items-center text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium">Online</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm font-medium">Offline</span>
                </div>
              )}
            </div>

            {/* Sync Status */}
            {!isOnline && pendingTransactions > 0 && (
              <div className="text-sm text-orange-600">
                <span className="font-medium">{pendingTransactions}</span> pending
              </div>
            )}

            {/* Last Sync */}
            {lastSync && (
              <div className="text-sm text-gray-500">
                Last sync: {formatRelativeTime(lastSync)}
              </div>
            )}
          </div>

          {/* Right side - Connection status (mobile) and User Menu */}
          <div className="flex items-center space-x-2">
            {/* Mobile connection status */}
            <div className="md:hidden flex items-center">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <div className="flex items-center space-x-1">
                  <WifiOff className="h-4 w-4 text-red-600" />
                  {pendingTransactions > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 font-medium">
                      {pendingTransactions}
                    </span>
                  )}
                </div>
              )}
            </div>

            {user && (
              <div className="relative">
                {/* Desktop user menu */}
                <div className="hidden md:flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {user.role}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSettings}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      title="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Mobile user menu */}
                <div className="md:hidden">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="User menu"
                  >
                    <User className="h-5 w-5" />
                  </button>

                  {/* Mobile user dropdown */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {user.role}
                        </div>
                      </div>
                      
                      <button
                        onClick={handleSettings}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </button>
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile connection details (shown when offline) */}
      {!isOnline && (
        <div className="md:hidden bg-red-50 border-t border-red-200 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-red-700">
            <span>Offline Mode</span>
            <div className="flex items-center space-x-2">
              {pendingTransactions > 0 && (
                <span>{pendingTransactions} pending</span>
              )}
              {lastSync && (
                <span>Last sync: {formatRelativeTime(lastSync)}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;