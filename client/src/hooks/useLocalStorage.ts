import { useState, useEffect, useCallback } from 'react';

export interface UseLocalStorageOptions<T> {
  defaultValue?: T;
  serializer?: {
    parse: (value: string) => T;
    stringify: (value: T) => string;
  };
  syncAcrossTabs?: boolean;
}

export interface UseLocalStorageReturn<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  removeValue: () => void;
  error: string | null;
  loading: boolean;
}

const defaultSerializer = {
  parse: JSON.parse,
  stringify: JSON.stringify
};

// Fixed: Changed function signature to accept key first, then defaultValue, then options
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: Omit<UseLocalStorageOptions<T>, 'defaultValue'> = {}
): UseLocalStorageReturn<T> {
  const {
    serializer = defaultSerializer,
    syncAcrossTabs = false
  } = options;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        return serializer.parse(item);
      }
      return defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      try {
        setLoading(true);
        setError(null);

        const valueToStore = typeof newValue === 'function' 
          ? (newValue as (prev: T) => T)(value)
          : newValue;

        setValue(valueToStore);

        if (typeof window !== 'undefined') {
          if (valueToStore === undefined || valueToStore === null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, serializer.stringify(valueToStore));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Failed to set localStorage value: ${errorMessage}`);
        console.error(`Error setting localStorage key "${key}":`, error);
      } finally {
        setLoading(false);
      }
    },
    [key, serializer, value]
  );

  const removeValue = useCallback(() => {
    try {
      setLoading(true);
      setError(null);
      
      setValue(defaultValue);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to remove localStorage value: ${errorMessage}`);
      console.error(`Error removing localStorage key "${key}":`, error);
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue]);

  // Handle storage events for cross-tab synchronization
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = serializer.parse(e.newValue);
          setValue(newValue);
        } catch (error) {
          console.error(`Error parsing storage event for key "${key}":`, error);
        }
      } else if (e.key === key && e.newValue === null) {
        setValue(defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, defaultValue, serializer, syncAcrossTabs]);

  return {
    value,
    setValue: updateValue,
    removeValue,
    error,
    loading
  };
}

// Specialized hook for storing arrays
export function useLocalStorageArray<T>(
  key: string,
  defaultValue: T[] = []
): UseLocalStorageReturn<T[]> & {
  addItem: (item: T) => void;
  removeItem: (predicate: (item: T) => boolean) => void;
  updateItem: (predicate: (item: T) => boolean, updates: Partial<T>) => void;
  clearItems: () => void;
} {
  const {
    value,
    setValue,
    removeValue,
    error,
    loading
  } = useLocalStorage<T[]>(key, defaultValue);

  const addItem = useCallback((item: T) => {
    setValue(prev => [...prev, item]);
  }, [setValue]);

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setValue(prev => prev.filter(item => !predicate(item)));
  }, [setValue]);

  const updateItem = useCallback((predicate: (item: T) => boolean, updates: Partial<T>) => {
    setValue(prev => prev.map(item => 
      predicate(item) ? { ...item, ...updates } : item
    ));
  }, [setValue]);

  const clearItems = useCallback(() => {
    setValue([]);
  }, [setValue]);

  return {
    value,
    setValue,
    removeValue,
    error,
    loading,
    addItem,
    removeItem,
    updateItem,
    clearItems
  };
}

// Specialized hook for storing objects
export function useLocalStorageObject<T extends Record<string, any>>(
  key: string,
  defaultValue: T
): UseLocalStorageReturn<T> & {
  updateProperty: <K extends keyof T>(property: K, value: T[K]) => void;
  removeProperty: <K extends keyof T>(property: K) => void;
  mergeObject: (updates: Partial<T>) => void;
} {
  const {
    value,
    setValue,
    removeValue,
    error,
    loading
  } = useLocalStorage<T>(key, defaultValue);

  const updateProperty = useCallback(<K extends keyof T>(property: K, propValue: T[K]) => {
    setValue(prev => ({ ...prev, [property]: propValue }));
  }, [setValue]);

  const removeProperty = useCallback(<K extends keyof T>(property: K) => {
    setValue(prev => {
      const newValue = { ...prev };
      delete newValue[property];
      return newValue;
    });
  }, [setValue]);

  const mergeObject = useCallback((updates: Partial<T>) => {
    setValue(prev => ({ ...prev, ...updates }));
  }, [setValue]);

  return {
    value,
    setValue,
    removeValue,
    error,
    loading,
    updateProperty,
    removeProperty,
    mergeObject
  };
}

// Hook for managing user preferences
export function useUserPreferences() {
  return useLocalStorageObject('user_preferences', {
    theme: 'light' as const,
    language: 'en' as const,
    currency: 'USD' as const,
    dateFormat: 'MM/dd/yyyy' as const,
    autoSync: true,
    notifications: true,
    soundEnabled: true
  });
}

// Hook for managing app settings
export function useAppSettings() {
  return useLocalStorageObject('app_settings', {
    lastRoute: '',
    sidebarCollapsed: false,
    gridView: true,
    itemsPerPage: 20,
    sortBy: 'name' as const,
    sortDirection: 'asc' as 'asc' | 'desc'
  });
}