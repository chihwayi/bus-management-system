// Header.tsx
import React from 'react';
import { User, Settings, LogOut, Wifi, WifiOff } from 'lucide-react';
import { APP_NAME } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/helpers';
import type { User as UserType } from '../../types';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  user?: UserType;
  isOnline: boolean;
  lastSync?: Date | null;
  pendingTransactions?: number;
}

const Header: React.FC<HeaderProps> = ({
  user,
  isOnline,
  lastSync,
  pendingTransactions = 0,
}) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear user data and redirect to login
    localStorage.removeItem('psc_bus_auth_token');
    localStorage.removeItem('psc_bus_user_data');
    navigate('/login');
  };

  const handleSettings = () => {
    navigate(user?.role === 'admin' ? '/admin/settings' : '/conductor/settings');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and App Name */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">{APP_NAME}</h1>
            </div>
          </div>

          {/* Center - Connection Status */}
          <div className="flex items-center space-x-4">
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

          {/* Right side - User Menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3">
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;