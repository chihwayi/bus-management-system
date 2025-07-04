import syncService from './syncService';
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL, LOCAL_STORAGE_KEYS } from '../utils/constants';
import type {
  AuthResponse,
  ApiResponse,
  User,
  Passenger,
  PassengerFormData,
  Route,
  RouteFormData,
  Conductor,
  ConductorFormData,
  Transaction,
  ReportData,
  DashboardStats,
  SearchFilters,
  ConductorTodayStats,
  RecentBoarding,
  RouteTodayStats,
  TodayStats,
  CreatePassengerData
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError<ApiResponse>) => {
        if (error.response?.status === 401) {
          this.clearAuthData();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
  }

  private setAuthToken(token: string): void {
    localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, token);
  }

  private clearAuthData(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_DATA);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    const response = await this.api.get('/health');
    return response.data;
  }

  // Authentication
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/login', {
      username,
      password,
    });

    if (response.data.success && response.data.token) {
      this.setAuthToken(response.data.token);
      if (response.data.user) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
      }
    }

    return response.data;
  }

  async getMe(): Promise<ApiResponse<User>> {
    const response = await this.api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    const response = await this.api.post<ApiResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  logout(): void {
    this.clearAuthData();
    // Reset sync service on logout
    syncService.reset();
  }

  // Passengers
  async getAllPassengers(filters?: SearchFilters): Promise<ApiResponse<Passenger[]>> {
    const params = new URLSearchParams();

    if (filters?.query) params.append('search', filters.query);
    if (filters?.route_id) params.append('route_id', filters.route_id);
    if (filters?.balance_status && filters.balance_status !== 'all') {
      params.append('balance_status', filters.balance_status);
    }
    if (filters?.ministry) params.append('ministry', filters.ministry);

    const response = await this.api.get<ApiResponse<Passenger[]>>(`/passengers?${params.toString()}`);
    return response.data;
  }

  async searchPassengers(query: string): Promise<ApiResponse<Passenger[]>> {
    const response = await this.api.get<ApiResponse<Passenger[]>>(`/passengers/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  async getPassenger(id: string): Promise<ApiResponse<Passenger>> {
    const response = await this.api.get<ApiResponse<Passenger>>(`/passengers/${id}`);
    return response.data;
  }

  async createPassenger(data: CreatePassengerData): Promise<ApiResponse<Passenger>> {
    // Transform snake_case to camelCase and match backend expectations
    const payload = {
      fullName: data.full_name,
      ministry: data.ministry,
      boardingArea: data.boarding_area,
      currentBalance: data.initial_balance,
      legacyPassengerId: data.legacy_passenger_id,  // Ensure this is included
      conductorId: data.conductor_id,
      routeId: data.route_id
    };

    console.log('Creating passenger with payload:', payload); // Debug log

    const response = await this.api.post<ApiResponse<Passenger>>('/passengers', payload);
    return response.data;
  }

  async updatePassenger(id: string, data: Partial<PassengerFormData>): Promise<ApiResponse<Passenger>> {
    const response = await this.api.put<ApiResponse<Passenger>>(`/passengers/${id}`, data);
    return response.data;
  }

  async deletePassenger(id: string): Promise<ApiResponse> {
    const response = await this.api.delete<ApiResponse>(`/passengers/${id}`);
    return response.data;
  }

  // api.ts
  async boardPassenger(
    passengerId: string,
    conductorId: string,
    routeId: string,
    fareAmount: number
  ): Promise<ApiResponse<Passenger>> {
    try {
      // Verify IDs exist first
      const conductorExists = await this.getConductor(conductorId);
      const routeExists = await this.getRoute(routeId);

      if (!conductorExists.success) {
        throw new Error(`Conductor ${conductorId} not found`);
      }
      if (!routeExists.success) {
        throw new Error(`Route ${routeId} not found`);
      }

      const response = await this.api.post<ApiResponse<Passenger>>(
        `/passengers/${passengerId}/board`,
        {
          conductorId,
          routeId,
          fareAmount
        }
      );

      return response.data;
    } catch (error) {
      console.error('Boarding failed:', error);
      throw error;
    }
  }

  async topupPassenger(passengerId: string, amount: number, notes?: string): Promise<ApiResponse<Transaction>> {
    const response = await this.api.post<ApiResponse<Transaction>>(`/passengers/${passengerId}/topup`, {
      amount,
      notes
    });
    return response.data;
  }

  async transferPassenger(passengerId: string, newRouteId: string): Promise<ApiResponse<Passenger>> {
    const response = await this.api.post<ApiResponse<Passenger>>(`/passengers/${passengerId}/transfer`, {
      route_id: newRouteId
    });
    return response.data;
  }

  async getPassengerTransactions(passengerId: string): Promise<ApiResponse<Transaction[]>> {
    const response = await this.api.get<ApiResponse<Transaction[]>>(`/passengers/${passengerId}/transactions`);
    return response.data;
  }

  // Routes
  async getAllRoutes(): Promise<ApiResponse<Route[]>> {
    const response = await this.api.get<ApiResponse<Route[]>>('/routes');
    return response.data;
  }

  async getRoute(id: string): Promise<ApiResponse<Route>> {
    const response = await this.api.get<ApiResponse<Route>>(`/routes/${id}`);
    return response.data;
  }

  async createRoute(data: RouteFormData): Promise<ApiResponse<Route>> {
    const payload = {
      name: data.name,
      boardingArea: data.boarding_area,
      distanceKm: data.distance_km,
      baseFare: data.base_fare
    };

    const response = await this.api.post<ApiResponse<Route>>('/routes', payload);
    return response.data;
  }

  async updateRoute(id: string, data: Partial<RouteFormData>): Promise<ApiResponse<Route>> {
    const payload: any = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.boarding_area !== undefined) payload.boardingArea = data.boarding_area;
    if (data.distance_km !== undefined) payload.distanceKm = data.distance_km;
    if (data.base_fare !== undefined) payload.baseFare = data.base_fare;

    const response = await this.api.put<ApiResponse<Route>>(`/routes/${id}`, payload);
    return response.data;
  }

  async deleteRoute(id: string): Promise<ApiResponse> {
    const response = await this.api.delete<ApiResponse>(`/routes/${id}`);
    return response.data;
  }

  async getRoutePassengers(routeId: string): Promise<ApiResponse<Passenger[]>> {
    const response = await this.api.get<ApiResponse<Passenger[]>>(`/routes/${routeId}/passengers`);
    return response.data;
  }

  async getRouteConductors(routeId: string): Promise<ApiResponse<Conductor[]>> {
    const response = await this.api.get<ApiResponse<Conductor[]>>(`/routes/${routeId}/conductors`);
    return response.data;
  }

  async getRouteStats(routeId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get<ApiResponse<any>>(`/routes/${routeId}/stats`);
    return response.data;
  }

  // Conductors
  async getAllConductors(): Promise<ApiResponse<Conductor[]>> {
    const response = await this.api.get<ApiResponse<Conductor[]>>('/conductors');
    return response.data;
  }

  async getConductor(id: string): Promise<ApiResponse<Conductor>> {
    const response = await this.api.get<ApiResponse<Conductor>>(`/conductors/${id}`);
    return response.data;
  }

  async createConductor(data: ConductorFormData): Promise<ApiResponse<Conductor>> {
    const payload = {
      username: data.username,
      password: data.password,
      fullName: data.full_name,      // Transform to camelCase
      employeeId: data.employee_id,  // Transform to camelCase
      assignedRouteId: data.assigned_route_id // Transform to camelCase
    };

    const response = await this.api.post<ApiResponse<Conductor>>('/conductors', payload);
    return response.data;
  }

  async updateConductor(id: string, data: Partial<ConductorFormData>): Promise<ApiResponse<Conductor>> {
    try {
      // Transform data to match backend expectations
      const payload = {
        fullName: data.full_name,         // Maps to user table
        employeeId: data.employee_id,     // Maps to conductor table
        assignedRouteId: data.assigned_route_id  // Maps to conductor table
      };

      const response = await this.api.put<ApiResponse<Conductor>>(
        `/conductors/${id}`,
        payload
      );
      return response.data;
    } catch (error) {
      console.error('Update conductor API error:', error);
      throw error;
    }
  }

  async deleteConductor(id: string): Promise<ApiResponse> {
    const response = await this.api.delete<ApiResponse>(`/conductors/${id}`);
    return response.data;
  }

  async getConductorPassengers(conductorId: string): Promise<ApiResponse<Passenger[]>> {
    const response = await this.api.get<ApiResponse<Passenger[]>>(`/conductors/${conductorId}/passengers`);
    return response.data;
  }

  async getConductorStats(conductorId: string): Promise<ApiResponse<DashboardStats>> {
    const response = await this.api.get<ApiResponse<DashboardStats>>(`/conductors/${conductorId}/stats`);
    return response.data;
  }

  async getConductorTransactions(conductorId: string): Promise<ApiResponse<Transaction[]>> {
    const response = await this.api.get<ApiResponse<Transaction[]>>(`/conductors/${conductorId}/transactions`);
    return response.data;
  }

  async assignConductorToRoute(conductorId: string, routeId: string): Promise<ApiResponse<Conductor>> {
    const response = await this.api.post<ApiResponse<Conductor>>(`/conductors/${conductorId}/assign`, {
      route_id: routeId
    });
    return response.data;
  }

  // Reports
  async getConductorDailyReport(conductorId: string, date?: string): Promise<ApiResponse<ReportData>> {
    const params = new URLSearchParams();
    params.append('conductorId', conductorId);
    if (date) params.append('date', date);

    const response = await this.api.get<ApiResponse<ReportData>>(
      `/reports/conductor/daily?${params.toString()}`
    );
    return response.data;
  }

  async getConductorWeeklyReport(conductorId: string, week?: string): Promise<ApiResponse<ReportData>> {
    const params = new URLSearchParams();
    params.append('conductorId', conductorId);
    if (week) params.append('week', week);
    const response = await this.api.get<ApiResponse<ReportData>>(
      `/reports/conductor/weekly?${params.toString()}`
    );
    return response.data;
  }

  async getConductorMonthlyReport(conductorId: string, month?: string): Promise<ApiResponse<ReportData>> {
    const params = new URLSearchParams();
    params.append('conductorId', conductorId);
    if (month) params.append('month', month);
    const response = await this.api.get<ApiResponse<ReportData>>(
      `/reports/conductor/monthly?${params}`
    );
    return response.data;
  }

  async getAdminOverview(): Promise<ApiResponse<DashboardStats>> {
    const response = await this.api.get<ApiResponse<DashboardStats>>('/reports/admin/overview');
    return response.data;
  }

  async exportReport(
    type: 'daily' | 'weekly' | 'monthly' | 'transactions',
    format: 'csv' | 'json' = 'csv',
    filters?: {
      startDate?: string;
      endDate?: string;
      conductorId?: string;
      month?: string;
      year?: string;
    }
  ): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (filters?.conductorId) params.append('conductorId', filters.conductorId);

      if (type === 'daily' && filters?.startDate) {
        params.append('date', filters.startDate);
      } else if (type === 'weekly' && filters?.startDate) {
        params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
      } else if (type === 'monthly') {
        if (filters?.month) params.append('month', filters.month);
        if (filters?.year) params.append('year', filters.year);
      } else if (type === 'transactions') {
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
      }

      const response = await this.api.get<ApiResponse<any>>(
        `/reports/export/${type}?${params.toString()}`,
        {
          headers: {
            Accept: format === 'csv' ? 'text/csv' : 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Export report error:', error);
      throw error;
    }
  }

  /*
  async exportReport(type: 'daily' | 'weekly' | 'monthly', format: 'csv' | 'excel' = 'csv', filters?: any): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
    }
    params.append('format', format);

    const response = await this.api.get(`/reports/export/${type}?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }
    */

  async getPassengerTransactionHistory(passengerId: string): Promise<ApiResponse<Transaction[]>> {
    const response = await this.api.get<ApiResponse<Transaction[]>>(`/reports/passenger/${passengerId}/history`);
    return response.data;
  }

  async getAdminRecentTransactions(limit: number = 10): Promise<ApiResponse<Transaction[]>> {
    const response = await this.api.get<ApiResponse<Transaction[]>>(`/admin/transactions/recent?limit=${limit}`);
    return response.data;
  }

  async getAdminTransactionStats(period: 'today' | 'week' | 'month' = 'today'): Promise<ApiResponse<any>> {
    const response = await this.api.get<ApiResponse<any>>(`/admin/transactions/stats?period=${period}`);
    return response.data;
  }

  async getAdminRevenueByRoute(period: 'today' | 'week' | 'month' = 'today'): Promise<ApiResponse<any>> {
    const response = await this.api.get<ApiResponse<any>>(`/admin/revenue/by-route?period=${period}`);
    return response.data;
  }

  /**
   * Get today's boarding stats for the current conductor
   */
  async getConductorTodayStats(): Promise<ApiResponse<TodayStats>> {
    try {
      const response = await this.api.get<ApiResponse<TodayStats>>('/boarding/today');
      return response.data;
    } catch (error) {
      console.error('Failed to get conductor today stats:', error);
      throw error;
    }
  }

  /**
   * Get today's stats for all conductors (admin only)
   */
  async getAllConductorsTodayStats(): Promise<ApiResponse<ConductorTodayStats[]>> {
    try {
      const response = await this.api.get<ApiResponse<ConductorTodayStats[]>>('/boarding/admin/conductors');
      return response.data;
    } catch (error) {
      console.error('Failed to get all conductors today stats:', error);
      throw error;
    }
  }

  /**
   * Get today's stats grouped by route (admin only)
   */
  async getRoutesTodayStats(): Promise<ApiResponse<RouteTodayStats[]>> {
    try {
      const response = await this.api.get<ApiResponse<RouteTodayStats[]>>('/boarding/admin/routes');
      return response.data;
    } catch (error) {
      console.error('Failed to get routes today stats:', error);
      throw error;
    }
  }

  /**
   * Get recent boardings for the current conductor
   */
  async getRecentBoardings(): Promise<ApiResponse<RecentBoarding[]>> {
    try {
      const response = await this.api.get<ApiResponse<RecentBoarding[]>>('/boarding/recent');
      return response.data;
    } catch (error) {
      console.error('Failed to get recent boardings:', error);
      throw error;
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }

  getCurrentUser(): User | null {
    const userData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  }

  // Error handling helper
  handleApiError(error: any): string {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;