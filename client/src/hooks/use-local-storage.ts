import { useState, useEffect, useCallback } from "react";

// Generic hook for localStorage with type safety
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        
        // Save to localStorage
        if (valueToStore === undefined || valueToStore === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Function to remove the item from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// Hook for encrypted localStorage (useful for sensitive data like API keys)
export function useEncryptedLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      
      // Simple base64 encoding (not cryptographically secure, but better than plain text)
      const decrypted = atob(item);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error(`Error reading encrypted localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        
        if (valueToStore === undefined || valueToStore === null) {
          window.localStorage.removeItem(key);
        } else {
          // Simple base64 encoding
          const encrypted = btoa(JSON.stringify(valueToStore));
          window.localStorage.setItem(key, encrypted);
        }
      } catch (error) {
        console.error(`Error setting encrypted localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing encrypted localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// Hook for managing AI configuration
export function useAIConfig() {
  return useEncryptedLocalStorage('ai_config', {
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
    autoRouting: true,
    contentAnalysis: true,
    learningMode: true,
  });
}

// Hook for managing user preferences
export function useUserPreferences() {
  return useLocalStorage('user_preferences', {
    theme: 'light',
    language: 'it',
    defaultTemplate: 'LUNGO',
    autoSave: true,
    notifications: true,
  });
}

// Hook for managing learned patterns (for AI routing)
export function useLearnedPatterns() {
  return useLocalStorage<Record<string, string>>('learned_patterns', {});
}

// Hook for managing recent projects metadata
export function useRecentProjects() {
  return useLocalStorage<Array<{
    id: string;
    code: string;
    client: string;
    object: string;
    lastAccessed: string;
  }>>('recent_projects', []);
}

// Hook for localStorage size monitoring
export function useLocalStorageSize() {
  const [size, setSize] = useState(0);

  const calculateSize = useCallback(() => {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      setSize(total);
    } catch (error) {
      console.error('Error calculating localStorage size:', error);
      setSize(0);
    }
  }, []);

  useEffect(() => {
    calculateSize();
    
    // Recalculate on storage events
    const handleStorageChange = () => calculateSize();
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [calculateSize]);

  return { size, recalculate: calculateSize };
}

// Hook for clearing specific localStorage keys by pattern
export function useLocalStorageCleaner() {
  const clearByPattern = useCallback((pattern: string) => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(pattern)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return keysToRemove.length;
    } catch (error) {
      console.error('Error clearing localStorage by pattern:', error);
      return 0;
    }
  }, []);

  const clearAll = useCallback(() => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing all localStorage:', error);
      return false;
    }
  }, []);

  const clearG2Data = useCallback(() => {
    return clearByPattern('g2_') + 
           clearByPattern('meta_') + 
           clearByPattern('ai_') + 
           clearByPattern('learned_');
  }, [clearByPattern]);

  return { clearByPattern, clearAll, clearG2Data };
}

// Hook for syncing localStorage across tabs
export function useLocalStorageSync<T>(key: string, initialValue: T) {
  const [value, setValue, removeValue] = useLocalStorage(key, initialValue);
  const [isSync, setIsSync] = useState(false);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setIsSync(true);
          setValue(newValue);
          setTimeout(() => setIsSync(false), 100); // Brief sync indicator
        } catch (error) {
          console.error('Error syncing localStorage value:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, setValue]);

  return [value, setValue, removeValue, isSync] as const;
}
