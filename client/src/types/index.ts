export interface User {
  id: string;
  username: string;
  role: 'admin' | 'conductor';
  full_name: string;
  is_active: boolean;
  conductor_id?: string;
  assigned_route_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Passenger {
  id: string;
  legacy_passenger_id?: number;
  full_name: string;
  ministry: string;
  boarding_area: string;
  route_id?: string;
  route_name?: string;
  route_boarding_area?: string;
  base_fare?: number; // Add this line
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  boarding_area: string;
  distance_km?: number;
  base_fare: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conductor {
  id: string;
  user_id: string;
  employee_id?: string;
  assigned_route_id?: string;
  route_name?: string;
  full_name: string;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  passenger_id: string;
  conductor_id: string;
  route_id: string;
  transaction_type: 'boarding' | 'topup' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  notes?: string;
  is_offline: boolean;
  sync_status: 'pending' | 'synced' | 'failed';
  transaction_date: string;
  created_at: string;
  conductor_name?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PassengerFormData {
  full_name: string;
  ministry: string;
  boarding_area: string;
  route_id?: string;
  current_balance: number;
}

export interface CreatePassengerData extends PassengerFormData {
  legacy_passenger_id?: number;
  conductor_id?: string;
}

export interface RouteFormData {
  name: string;
  boarding_area: string;
  distance_km?: number;
  base_fare: number;
}

export interface ConductorFormData {
  username: string;
  password: string;
  full_name: string;
  employee_id?: string;
  assigned_route_id?: string;
}

export interface ReportData {
  date?: string;
  period?: {
    start: string;
    end: string;
  } | {
    month: string;
    year: string;
  };
  conductor: {
    name: string;
    route: string;
  };
  summary: {
    total_boardings: number;
    total_revenue: number;
    unique_passengers: number;
    total_topups?: number;
  };
  hourlyBreakdown?: Array<{
    hour: string;
    boardings: number;
    revenue: number;
  }>;
  passengerDetails?: Array<{
    full_name: string;
    legacy_passenger_id: number;
    boarding_count: number;
    total_paid: number;
    current_balance: number;
    transactions?: Transaction[];
  }>;
  dailyBreakdown?: Array<{
    date: string;
    boardings: number;
    unique_passengers?: number;
    revenue: number;
  }>;
  topPassengers?: Array<{
    full_name: string;
    legacy_passenger_id: number;
    boarding_count: number;
    total_paid: number;
  }>;
  allPassengers?: {
    id: string;
    full_name: string;
    legacy_passenger_id: string;
    ministry: string;
    boarding_area: string;
    transaction_count: number;
    total_paid: number;
    balance_at_month_end: number;
  }[];
  transactions?: Transaction[];
}

export interface DashboardStats {
  totalPassengers: number;
  totalBoardingsToday: number;
  totalRevenueToday: number;
  activeRoutes: number;
  activeConductors: number;
  lowBalancePassengers: number;
  negativeBalancePassengers: number;
}

export interface SearchFilters {
  query?: string;
  route_id?: string;
  balance_status?: 'all' | 'positive' | 'low' | 'zero' | 'negative';
  ministry?: string;
}

export interface BalanceStatus {
  status: 'good' | 'low' | 'zero' | 'negative';
  color: 'green' | 'orange' | 'red' | 'red';
  textColor: 'text-green-700' | 'text-orange-700' | 'text-red-700' | 'text-red-700';
  bgColor: 'bg-green-100' | 'bg-orange-100' | 'bg-red-100' | 'bg-red-100';
  borderColor: 'border-green-300' | 'border-orange-300' | 'border-red-300' | 'border-red-300';
}

export interface OfflineTransaction {
  id: string;
  passenger_id: string;
  conductor_id: string;
  route_id: string;
  transaction_type: 'boarding' | 'topup';
  amount: number;
  balance_before: number;
  balance_after: number;
  timestamp: number;
  synced: boolean;
}

export interface CreatePassengerData {
  full_name: string;
  ministry: string;
  boarding_area: string;
  initial_balance: number;
  legacy_passenger_id?: number;
  conductor_id?: string;
  route_id?: string;
}

export interface SyncData {
  transactions: OfflineTransaction[];
  passengers: Partial<Passenger>[];
}

export type TodayStats = {
  conductor: {
    id: string;
    name: string;
    employeeId: string;
    routeName: string;
    routeId: string;
  };
  stats: {
    totalBoardings: number;
    totalRevenue: number;
    uniquePassengers: number;
    date: string;
  };
};

export type ConductorTodayStats = TodayStats & {
  conductor_name: string;
  route_name: string;
};

export type RouteTodayStats = TodayStats & {
  route_name: string;
  boarding_area: string;
  active_conductors: number;
};

export type RecentBoarding = {
  id: string;
  passenger_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_date: string;
  notes: string;
  passenger_name: string;
  ministry: string;
  boarding_area: string;
  route_name: string;
};

// Add type for the full API response structure
export type RecentBoardingsResponse = {
  success: boolean;
  data: {
    conductor: {
      id: string;
      name: string;
      routeName: string;
    };
    boardings: RecentBoarding[];
  };
};

export type RecentTopup = {
  id: string;
  transaction_date: string;
  passenger_name: string;
  legacy_passenger_id: number;
  topup_amount: number;
  balance_after: number;
};

export interface Ministry {
  name: string;
  code: string;
}

export const MINISTRIES: Ministry[] = [
  { name: 'Ministry of Finance', code: 'MOF' },
  { name: 'Ministry of Health', code: 'MOH' },
  { name: 'Ministry of Education', code: 'MOE' },
  { name: 'Ministry of Transport', code: 'MOT' },
  { name: 'Ministry of Agriculture', code: 'MOA' },
  { name: 'Ministry of Justice', code: 'MOJ' },
  { name: 'Ministry of Defence', code: 'MOD' },
  { name: 'Ministry of Home Affairs', code: 'MHA' },
  { name: 'Ministry of Foreign Affairs', code: 'MFA' },
  { name: 'Ministry of Energy', code: 'MOEn' },
  { name: 'Other', code: 'OTHER' }
];

export const BALANCE_THRESHOLDS = {
  LOW_BALANCE: 30.00,
  ZERO_BALANCE: 0.00
} as const;

