import { CreatePassengerData } from "../types";

interface ValidationResult {
  isValid: boolean;
  errors: {
    full_name?: string;
    ministry?: string;
    boarding_area?: string;
    initial_balance?: string;
    legacy_passenger_id?: string;
  };
}

export const validatePassengerData = (data: CreatePassengerData): ValidationResult => {
  const errors: ValidationResult['errors'] = {};

  // Validate full name
  if (!data.full_name || data.full_name.trim().length === 0) {
    errors.full_name = 'Full name is required';
  } else if (data.full_name.trim().length < 2) {
    errors.full_name = 'Full name must be at least 2 characters long';
  } else if (data.full_name.trim().length > 100) {
    errors.full_name = 'Full name must not exceed 100 characters';
  } else if (!/^[a-zA-Z\s'-]+$/.test(data.full_name.trim())) {
    errors.full_name = 'Full name can only contain letters, spaces, hyphens, and apostrophes';
  }

  // Validate ministry
  if (!data.ministry || data.ministry.trim().length === 0) {
    errors.ministry = 'Ministry is required';
  }

  // Validate boarding area
  if (!data.boarding_area || data.boarding_area.trim().length === 0) {
    errors.boarding_area = 'Boarding area is required';
  }

  // Validate initial balance
  if (data.initial_balance < 0) {
    errors.initial_balance = 'Initial balance cannot be negative';
  } else if (data.initial_balance > 10000) {
    errors.initial_balance = 'Initial balance cannot exceed $10,000';
  }

  // Validate legacy passenger ID (if provided)
  if (data.legacy_passenger_id !== undefined) {
    if (data.legacy_passenger_id <= 0) {
      errors.legacy_passenger_id = 'Legacy passenger ID must be a positive number';
    } else if (data.legacy_passenger_id > 999999) {
      errors.legacy_passenger_id = 'Legacy passenger ID must not exceed 999999';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
