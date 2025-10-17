/**
 * Performance utilities for React components
 * Provides hooks and utilities for optimizing component rendering
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook for rate-limiting function calls
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastRan = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = now;
      }
    },
    [callback, delay]
  ) as T;
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIntersecting] = React.useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

/**
 * Previous value hook for comparison
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Mounted state hook to prevent state updates after unmount
 */
export function useIsMounted(): () => boolean {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

/**
 * Performance measurement hook
 */
export function usePerformanceMark(name: string, dependencies: any[] = []) {
  useEffect(() => {
    const markName = `${name}-start`;
    const measureName = `${name}-duration`;

    performance.mark(markName);

    return () => {
      try {
        performance.measure(measureName, markName);
        const measure = performance.getEntriesByName(measureName)[0];

        if (measure && process.env.NODE_ENV !== 'production') {
          console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`);
        }

        performance.clearMarks(markName);
        performance.clearMeasures(measureName);
      } catch (error) {
        // Ignore performance measurement errors
      }
    };
  }, dependencies);
}

/**
 * Memoized callback that only changes when dependencies change
 * Wrapper around useCallback for better type inference
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

/**
 * Virtualization helper for large lists
 * Returns visible items based on scroll position
 */
export function useVirtualization<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number
): { visibleItems: T[]; offsetY: number; totalHeight: number } {
  return useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;
    const totalHeight = items.length * itemHeight;

    return { visibleItems, offsetY, totalHeight };
  }, [items, itemHeight, containerHeight, scrollTop]);
}

/**
 * Batch state updates hook
 * Useful for reducing re-renders when updating multiple state values
 */
export function useBatchedState<T extends Record<string, any>>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = React.useState<T>(initialState);

  const batchUpdate = useCallback((updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  return [state, batchUpdate];
}

/**
 * Image lazy loading hook
 */
export function useLazyImage(src: string): {
  imageSrc: string | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const [imageSrc, setImageSrc] = React.useState<string>();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setError(new Error('Failed to load image'));
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { imageSrc, isLoading, error };
}

/**
 * Component render counter for debugging
 */
export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔄 ${componentName} rendered ${renderCount.current} times`);
    }
  });

  return renderCount.current;
}

// Re-export useState for consistency
import React from 'react';
export { React };
