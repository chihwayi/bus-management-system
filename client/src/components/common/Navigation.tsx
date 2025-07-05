// Navigation.tsx
import React, { useEffect } from 'react';
import { 
  Home, 
  Users, 
  UserCheck, 
  Route, 
  DollarSign, 
  FileText, 
  UserPlus,
  Settings,
  X
} from 'lucide-react';
import type { User } from '../../types';
import { NavLink, useNavigate } from 'react-router-dom';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  badge?: number;
}

interface NavigationProps {
  user?: User;
  pendingTransactions?: number;
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  user,
  pendingTransactions = 0,
  isMobileMenuOpen = false,
  onMobileMenuClose
}) => {
  const navigate = useNavigate();

  // Handle mobile menu closing when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && onMobileMenuClose) {
        const target = event.target as HTMLElement;
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && !mobileMenu.contains(target)) {
          onMobileMenuClose();
        }
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen, onMobileMenuClose]);

  const navigationItems: NavigationItem[] = [
    // Conductor Items
    {
      id: 'conductor-dashboard',
      label: 'Dashboard',
      icon: <Home className="h-5 w-5" />,
      path: '/conductor',
      roles: ['conductor']
    },
    {
      id: 'passenger-registration',
      label: 'Register Passenger',
      icon: <UserPlus className="h-5 w-5" />,
      path: '/conductor/register-passenger',
      roles: ['conductor']
    },
    {
      id: 'conductor-reports',
      label: 'Reports',
      icon: <FileText className="h-5 w-5" />,
      path: '/conductor/reports',
      roles: ['conductor']
    },
    {
      id: 'conductor-settings',
      label: 'Settings',
      icon: <Settings className="h-5 w-5" />,
      path: '/conductor/settings',
      roles: ['conductor']
    },

    // Admin Items
    {
      id: 'admin-dashboard',
      label: 'Dashboard',
      icon: <Home className="h-5 w-5" />,
      path: '/admin',
      roles: ['admin']
    },
    {
      id: 'passenger-management',
      label: 'Passengers',
      icon: <Users className="h-5 w-5" />,
      path: '/admin/passengers',
      roles: ['admin']
    },
    {
      id: 'conductor-management',
      label: 'Conductors',
      icon: <UserCheck className="h-5 w-5" />,
      path: '/admin/conductors',
      roles: ['admin']
    },
    {
      id: 'route-management',
      label: 'Routes',
      icon: <Route className="h-5 w-5" />,
      path: '/admin/routes',
      roles: ['admin']
    },
    {
      id: 'fare-management',
      label: 'Fare Management',
      icon: <DollarSign className="h-5 w-5" />,
      path: '/admin/fares',
      roles: ['admin']
    },
    {
      id: 'admin-reports',
      label: 'Reports',
      icon: <FileText className="h-5 w-5" />,
      path: '/admin/reports',
      roles: ['admin']
    },
    {
      id: 'admin-settings',
      label: 'Settings',
      icon: <Settings className="h-5 w-5" />,
      path: '/admin/settings',
      roles: ['admin']
    }
  ];

  if (!user) {
    return null;
  }

  const filteredItems = navigationItems.filter(item => 
    item.roles.includes(user.role)
  );

  // Handle navigation item click (close mobile menu)
  const handleNavItemClick = () => {
    if (isMobileMenuOpen && onMobileMenuClose) {
      onMobileMenuClose();
    }
  };

  return (
    <>
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" />
      )}

      {/* Desktop sidebar */}
      <nav className="hidden md:flex md:flex-col bg-gray-50 border-r border-gray-200 h-full">
        <div className="flex-1 p-4">
          <ul className="space-y-2">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `
                    w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      
                      {/* Badge for pending transactions on reports */}
                      {(item.id.includes('reports') || item.id === 'conductor-dashboard') && 
                       pendingTransactions > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                          {pendingTransactions}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Desktop User Role Badge */}
        <div className="p-4">
          <div className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Current Role
            </div>
            <div className={`text-sm font-medium capitalize ${
              user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'
            }`}>
              {user.role}
            </div>
            {user.role === 'conductor' && user.assigned_route_id && (
              <div className="text-xs text-gray-500 mt-1">
                Route assigned
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      <div
        id="mobile-menu"
        className={`fixed left-0 top-0 bottom-0 w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile menu header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onMobileMenuClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile navigation items */}
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1 p-4">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  onClick={handleNavItemClick}
                  className={({ isActive }) => `
                    w-full flex items-center justify-between px-3 py-3 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      
                      {/* Badge for pending transactions on reports */}
                      {(item.id.includes('reports') || item.id === 'conductor-dashboard') && 
                       pendingTransactions > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                          {pendingTransactions}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile User Role Badge */}
        <div className="p-4 border-t border-gray-200">
          <div className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Current Role
            </div>
            <div className={`text-sm font-medium capitalize ${
              user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'
            }`}>
              {user.role}
            </div>
            {user.role === 'conductor' && user.assigned_route_id && (
              <div className="text-xs text-gray-500 mt-1">
                Route assigned
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;