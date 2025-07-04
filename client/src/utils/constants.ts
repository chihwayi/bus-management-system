export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export const APP_NAME = process.env.REACT_APP_APP_NAME || 'PSC Bus Management System';

export const BALANCE_THRESHOLDS = {
  LOW_BALANCE: 5.00,
  ZERO_BALANCE: 0.00
} as const;

export const TRANSACTION_TYPES = {
  BOARDING: 'boarding',
  TOPUP: 'topup',
  ADJUSTMENT: 'adjustment'
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  CONDUCTOR: 'conductor'
} as const;

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed'
} as const;

export const BALANCE_STATUS_CONFIG = {
  good: {
    color: 'green',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    label: 'Good Balance'
  },
  low: {
    color: 'orange',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    label: 'Low Balance'
  },
  zero: {
    color: 'red',
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    label: 'No Balance'
  },
  negative: {
    color: 'red',
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    label: 'Negative Balance'
  }
} as const;

export const MINISTRIES = [
  { name: 'Ministry of Finance', code: 'MOF' },
  { name: 'Ministry of Health', code: 'MOH' },
  { name: 'Ministry of Education', code: 'MOE' },
  { name: 'Ministry of Transport', code: 'MOT' },
  { name: 'Ministry of Agriculture', code: 'MOA' },
  { name: 'Ministry of Youth', code: 'MOY' },
  { name: 'Ministry of Justice', code: 'MOJ' },
  { name: 'Ministry of Home Affairs', code: 'MHA' },
  { name: 'Ministry of Foreign Affairs', code: 'MFA' },
  { name: 'Ministry of Energy', code: 'MOEn' },
  { name: 'Other', code: 'OTHER' }
] as const;

export const BOARDING_AREAS = [
  'Glen View 3',
  'Glen View 1',
  'Glen Norah A',
  'Glen Norah B',
  'Highfields',
  'Other'
] as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const;

export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'psc_bus_auth_token',
  USER_DATA: 'psc_bus_user_data',
  OFFLINE_TRANSACTIONS: 'psc_bus_offline_transactions',
  OFFLINE_PASSENGERS: 'psc_bus_offline_passengers',
  LAST_SYNC: 'psc_bus_last_sync'
} as const;

export const DEBOUNCE_DELAY = 300; // milliseconds

export const TOAST_DURATION = 4000; // milliseconds

export const OFFLINE_SYNC_INTERVAL = 30000; // 30 seconds

export const MAX_OFFLINE_TRANSACTIONS = 1000;

export const CURRENCY_SYMBOL = '$';

export const DATE_FORMATS = {
  SHORT: 'MM/dd/yyyy',
  LONG: 'MMMM dd, yyyy',
  TIME: 'HH:mm:ss',
  DATETIME: 'MM/dd/yyyy HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
} as const;

export const REPORT_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
} as const;

export const EXPORT_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  PDF: 'pdf'
} as const;