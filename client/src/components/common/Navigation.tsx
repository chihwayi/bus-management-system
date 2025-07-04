// Navigation.tsx
import React from 'react';
import { 
  Home, 
  Users, 
  UserCheck, 
  Route, 
  DollarSign, 
  FileText, 
  UserPlus,
  Settings
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
}

const Navigation: React.FC<NavigationProps> = ({
  user,
  pendingTransactions = 0
}) => {
  const navigate = useNavigate();

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

  return (
    <nav className="bg-gray-50 border-r border-gray-200 h-full">
      <div className="p-4">
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

      {/* User Role Badge */}
      <div className="absolute bottom-4 left-4 right-4">
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
  );
};

export default Navigation;