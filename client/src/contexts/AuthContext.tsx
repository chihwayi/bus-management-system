import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import apiService from '../services/api';
import syncService from '../services/syncService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      if (apiService.isAuthenticated()) {
        const currentUser = apiService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          // Initialize sync service if user is authenticated
          await syncService.initialize();
        } else {
          // Try to fetch user from API
          const response = await apiService.getMe();
          if (response.success && response.data) {
            setUser(response.data);
            await syncService.initialize();
          } else {
            // Clear invalid auth
            apiService.logout();
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      apiService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await apiService.login(username, password);
      
      if (response.success && response.user) {
        setUser(response.user);
        // Initialize sync service after successful login
        await syncService.initialize();
        return true;
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
    apiService.logout();
    syncService.reset();
    setUser(null);
  };

  useEffect(() => {
    checkAuth();
    
    // Cleanup sync service on unmount
    return () => {
      syncService.destroy();
    };
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};