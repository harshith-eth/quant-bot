// Cache utility for localStorage with expiration
export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export class LocalStorageCache {
  private static readonly DEFAULT_DURATION = 120000; // 2 minutes

  static set<T>(key: string, data: T, duration: number = LocalStorageCache.DEFAULT_DURATION): void {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheItem));
      localStorage.setItem(`${key}_duration`, duration.toString());
      console.log(`💾 Cached data for key: ${key}`);
    } catch (error) {
      console.warn(`Failed to cache data for key ${key}:`, error);
    }
  }

  static get<T>(key: string): T | null {
    try {
      const cachedData = localStorage.getItem(key);
      const cachedDuration = localStorage.getItem(`${key}_duration`);
      
      if (!cachedData || !cachedDuration) {
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cachedData);
      const duration = parseInt(cachedDuration);
      const now = Date.now();

      // Check if cache is still valid
      if (now - cacheItem.timestamp < duration) {
        console.log(`✅ Cache hit for key: ${key}`);
        return cacheItem.data;
      } else {
        // Cache expired, remove it
        LocalStorageCache.remove(key);
        console.log(`🕒 Cache expired for key: ${key}`);
        return null;
      }
    } catch (error) {
      console.error(`Error reading cache for key ${key}:`, error);
      LocalStorageCache.remove(key);
      return null;
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_duration`);
      console.log(`🗑️ Removed cache for key: ${key}`);
    } catch (error) {
      console.warn(`Failed to remove cache for key ${key}:`, error);
    }
  }

  static clear(): void {
    try {
      // Clear all cache items (items that have a corresponding _duration key)
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => !key.endsWith('_duration') && keys.includes(`${key}_duration`));
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_duration`);
      });
      
      console.log(`🧹 Cleared ${cacheKeys.length} cache items`);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  static isValid(key: string): boolean {
    try {
      const cachedData = localStorage.getItem(key);
      const cachedDuration = localStorage.getItem(`${key}_duration`);
      
      if (!cachedData || !cachedDuration) {
        return false;
      }

      const cacheItem: CacheItem<any> = JSON.parse(cachedData);
      const duration = parseInt(cachedDuration);
      const now = Date.now();

      return (now - cacheItem.timestamp) < duration;
    } catch (error) {
      return false;
    }
  }
}

// Cache keys
export const CACHE_KEYS = {
  PORTFOLIO_DATA: 'portfolio_data_cache',
  POSITIONS_DATA: 'positions_data_cache',
  TOKEN_METADATA: 'token_metadata_cache',
  RISK_MANAGEMENT_DATA: 'risk_management_data_cache',
} as const;

// Cache durations
export const CACHE_DURATIONS = {
  PORTFOLIO: 120000, // 2 minutes
  POSITIONS: 120000, // 2 minutes  
  TOKEN_METADATA: 300000, // 5 minutes (metadata changes less frequently)
  RISK_MANAGEMENT: 180000, // 3 minutes (risk data changes moderately)
} as const; 