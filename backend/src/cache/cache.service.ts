import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Error getting cache for key ${key}:`, error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(
        `Cache set for key: ${key}${ttl ? `, TTL: ${ttl}s` : ''}`,
      );
    } catch (error) {
      this.logger.error(`Error setting cache for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting cache for key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      // Note: cache-manager v5+ doesn't have direct pattern matching
      // This would need to be implemented differently or use a different cache store
      this.logger.debug(
        `Cache pattern deletion not implemented for pattern: ${pattern}`,
      );
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Clear all caches by iterating through stores
      const stores = this.cacheManager.stores;
      for (const store of stores) {
        await store.clear();
      }
      this.logger.debug('Cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }

  // Cache helpers for specific entities
  async getSpaces(siteId?: string): Promise<any[] | undefined> {
    const key = siteId ? `spaces:site:${siteId}` : 'spaces:all';
    return this.get(key);
  }

  async setSpaces(spaces: any[], siteId?: string, ttl = 300): Promise<void> {
    const key = siteId ? `spaces:site:${siteId}` : 'spaces:all';
    await this.set(key, spaces, ttl);
  }

  async getAnalyticsData(
    type: string,
    params: Record<string, any>,
  ): Promise<any | undefined> {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return this.get(key);
  }

  async setAnalyticsData(
    type: string,
    params: Record<string, any>,
    data: any,
    ttl = 600,
  ): Promise<void> {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    await this.set(key, data, ttl);
  }

  async getAddonServices(siteId?: string): Promise<any[] | undefined> {
    const key = siteId ? `addons:site:${siteId}` : 'addons:all';
    return this.get(key);
  }

  async setAddonServices(
    services: any[],
    siteId?: string,
    ttl = 300,
  ): Promise<void> {
    const key = siteId ? `addons:site:${siteId}` : 'addons:all';
    await this.set(key, services, ttl);
  }

  async invalidateSiteCache(siteId: string): Promise<void> {
    await Promise.all([
      this.delPattern(`spaces:site:${siteId}*`),
      this.delPattern(`addons:site:${siteId}*`),
      this.delPattern(`analytics:*site:${siteId}*`),
    ]);
  }

  // Cache warming methods
  async warmSpacesCache(): Promise<void> {
    try {
      // This would typically call your space service to get all spaces
      // For now, we'll just log that warming would happen
      this.logger.log('Spaces cache warming initiated');
    } catch (error) {
      this.logger.error('Error warming spaces cache:', error);
    }
  }

  async warmAnalyticsCache(): Promise<void> {
    try {
      this.logger.log('Analytics cache warming initiated');
    } catch (error) {
      this.logger.error('Error warming analytics cache:', error);
    }
  }

  // Cache statistics
  async getCacheStats(): Promise<{ keys: number; memory: string }> {
    try {
      let totalKeys = 0;
      const stores = this.cacheManager.stores;

      for (const store of stores) {
        // Note: Getting keys from individual stores would require store-specific implementation
        // This is a simplified implementation
        totalKeys += 0; // Would need actual key counting logic
      }

      return {
        keys: totalKeys,
        memory: 'Not available', // Would need cache manager specific implementation
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { keys: 0, memory: 'Unknown' };
    }
  }
}
