import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Components
import Header from './components/common/Header';
import LoadingSpinner from './components/common/LoadingSpinner';
import LoginPage from './components/auth/LoginPage';
import ConductorDashboard from './components/conductor/ConductorDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import PassengerRegistration from './components/conductor/PassengerRegistration';
import ConductorReports from './components/conductor/ConductorReports';
import ConductorManagement from './components/admin/ConductorManagement';
import FareManagement from './components/admin/FareManagement';
import PassengerManagement from './components/admin/PassengerManagement';
import RouteManagement from './components/admin/RouteManagement';
import Navigation from './components/common/Navigation';

// Services
import apiService from './services/api';
import syncService from './services/syncService';
import offlineService from './services/offlineService';

// Types
import type { User } from './types';

// Context for global state management
interface AppContextType {
  user: User | null;
  isLoading: boolean;
  isOffline: boolean;
  lastSync: Date | null;
  pendingTransactions: number;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AppContext = React.createContext<AppContextType | null>(null);

// Custom hook to use app context
export const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

// Main Layout Component that wraps Header and Navigation
const MainLayout: React.FC = () => {
  const { isOffline, user, lastSync, pendingTransactions } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-medium z-40">
          🔴 You are currently offline. Changes will be synced when connection is restored.
        </div>
      )}

      {/* Header at the top */}
      <Header
        user={user as User}
        isOnline={!isOffline}
        lastSync={lastSync}
        pendingTransactions={pendingTransactions}
        onMobileMenuToggle={toggleMobileMenu}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="flex flex-1">
        {/* Navigation sidebar - hidden on mobile */}
        <div className="hidden md:block w-64 bg-gray-50 border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto">
          <Navigation
            user={user as User}
            pendingTransactions={pendingTransactions}
          />
        </div>

        {/* Mobile navigation */}
        <Navigation
          user={user as User}
          pendingTransactions={pendingTransactions}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main content area */}
        <main className={`flex-1 ${user ? 'md:ml-64' : ''} p-4 md:p-6 overflow-auto transition-all duration-300`}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'conductor';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isLoading } = useAppContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading PSC Bus Management System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to appropriate dashboard instead of unauthorized page
    const redirectPath = user.role === 'admin' ? '/admin' : '/conductor';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

// Unauthorized Access Component
const UnauthorizedPage: React.FC = () => {
  const { user } = useAppContext();

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page.
        </p>
        <Navigate to={user?.role === 'admin' ? '/admin' : '/conductor'} replace />
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState(0);

  // Initialize the application and services once on mount
  useEffect(() => {
    // Setup offline listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for existing authentication and initialize app state
    const initializeApp = async () => {
      try {
        const token = localStorage.getItem('psc_bus_auth_token');
        if (token) {
          const currentUser = await apiService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
            await syncService.initialize();
            await syncService.syncData(true);
            setLastSync(new Date());
            // Get pending transactions count
            const pending = await offlineService.getPendingTransactionsCount();
            setPendingTransactions(pending);
          } else {
            localStorage.removeItem('psc_bus_auth_token');
            localStorage.removeItem('psc_bus_user_data');
          }
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        localStorage.removeItem('psc_bus_auth_token');
        localStorage.removeItem('psc_bus_user_data');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    // Cleanup function for useEffect
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      syncService.destroy();
    };
  }, []);

  // Sync data when coming back online
  useEffect(() => {
    if (!isOffline && user) {
      const syncData = async () => {
        try {
          await syncService.syncData(true);
          setLastSync(new Date());
          const pending = await offlineService.getPendingTransactionsCount();
          setPendingTransactions(pending);
        } catch (error) {
          console.error('Failed to sync data:', error);
        }
      };
      syncData();
    }
  }, [isOffline, user]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await apiService.login(username, password);

      let token: string | undefined;
      let user: User | undefined;

      if (response.success) {
        const responseWithData = response as any;
        if (responseWithData.data?.token && responseWithData.data?.user) {
          token = responseWithData.data.token;
          user = responseWithData.data.user;
        } else if (response.token && response.user) {
          token = response.token;
          user = response.user;
        }

        if (token && user) {
          localStorage.setItem('psc_bus_auth_token', token);
          localStorage.setItem('psc_bus_user_data', JSON.stringify(user));
          setUser(user);
          await syncService.initialize();
          await syncService.syncData(true);
          setLastSync(new Date());
          const pending = await offlineService.getPendingTransactionsCount();
          setPendingTransactions(pending);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    syncService.destroy();
    localStorage.removeItem('psc_bus_auth_token');
    localStorage.removeItem('psc_bus_user_data');
    offlineService.clearAllOfflineData();
    setUser(null);
    setLastSync(null);
    setPendingTransactions(0);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await apiService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        localStorage.setItem('psc_bus_user_data', JSON.stringify(currentUser));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const contextValue: AppContextType = {
    user,
    isLoading,
    isOffline,
    lastSync,
    pendingTransactions,
    login,
    logout,
    refreshUser
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading PSC Bus Management System...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public routes - Login page without layout */}
            <Route path="/login" element={<LoginPage />} />

            {/* All protected routes use the MainLayout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              {/* Default redirect based on user role */}
              <Route
                index
                element={
                  user?.role === 'admin' ? (
                    <Navigate to="/admin" replace />
                  ) : (
                    <Navigate to="/conductor" replace />
                  )
                }
              />

              {/* Admin routes */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/passengers"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <PassengerManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/conductors"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ConductorManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/routes"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <RouteManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/fares"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <FareManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/settings"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <div className="p-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h1>
                      <p className="text-gray-600">Admin settings page coming soon...</p>
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Conductor routes */}
              <Route
                path="conductor"
                element={
                  <ProtectedRoute requiredRole="conductor">
                    <ConductorDashboard user={user as User} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="conductor/register-passenger"
                element={
                  <ProtectedRoute requiredRole="conductor">
                    <PassengerRegistration
                      conductorId={user?.conductor_id ?? ''}
                      onSubmit={async (passengerData) => {
                        try {
                          console.log('Creating passenger with data:', passengerData);

                          // Create the passenger using apiService
                          const response = await apiService.createPassenger(passengerData);

                          if (!response.success) {
                            throw new Error(response.error || 'Failed to create passenger');
                          }

                          console.log('Passenger created successfully:', response.data);

                          // Update pending transactions count
                          const pending = await offlineService.getPendingTransactionsCount();
                          setPendingTransactions(pending);

                          // Optionally refresh passengers list if you have that state
                          // await refreshPassengersList();

                          // Do not return anything to satisfy the expected void return type
                        } catch (error) {
                          console.error('Error creating passenger:', error);
                          throw error; // Re-throw to let PassengerRegistration handle the error display
                        }
                      }}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="conductor/reports"
                element={
                  <ProtectedRoute requiredRole="conductor">
                    <ConductorReports
                      conductorId={user?.conductor_id ?? ''}
                      onRefresh={async () => {
                        const pending = await offlineService.getPendingTransactionsCount();
                        setPendingTransactions(pending);
                      }}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="conductor/settings"
                element={
                  <ProtectedRoute requiredRole="conductor">
                    <div className="p-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-6">Conductor Settings</h1>
                      <p className="text-gray-600">Conductor settings page coming soon...</p>
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Unauthorized page */}
              <Route path="unauthorized" element={<UnauthorizedPage />} />

              {/* Catch all other routes and redirect appropriately */}
              <Route
                path="*"
                element={
                  <Navigate
                    to={user?.role === 'admin' ? '/admin' : '/conductor'}
                    replace
                  />
                }
              />
            </Route>
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </Router>
    </AppContext.Provider>
  );
};

export default App;