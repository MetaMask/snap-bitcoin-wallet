import { assert } from '@metamask/utils';

import type { CacheEntry, ICache, Serializable } from './ICache';

/**
 * A simple in-memory cache implementation supporting TTL (Time To Live) functionality.
 *
 * WARNINGS:
 * - This cache is not persistent and will be lost when the process is restarted.
 */
export class InMemoryCache implements ICache<Serializable> {
  readonly #cache: Map<string, CacheEntry> = new Map();

  #validateTtlOrThrow(ttlMilliseconds?: number): void {
    if (ttlMilliseconds === undefined) {
      return;
    }

    if (typeof ttlMilliseconds !== 'number') {
      throw new Error('TTL must be a number');
    }

    if (ttlMilliseconds < 0) {
      throw new Error('TTL must be positive');
    }

    if (ttlMilliseconds > Number.MAX_SAFE_INTEGER) {
      throw new Error('TTL must be less than 2^53 - 1');
    }
  }

  #isExpired(cacheEntry: CacheEntry): boolean {
    return cacheEntry.expiresAt < Date.now();
  }

  async #cleanupExpiredEntries(): Promise<void> {
    const expiredKeys: string[] = [];
    for (const [key, entry] of this.#cache.entries()) {
      if (this.#isExpired(entry)) {
        expiredKeys.push(key);
      }
    }
    await this.mdelete(expiredKeys);
  }

  async get(key: string): Promise<Serializable | undefined> {
    const result = await this.mget([key]);
    return result[key];
  }

  async set(
    key: string,
    value: Serializable,
    ttlMilliseconds = Number.MAX_SAFE_INTEGER,
  ): Promise<void> {
    this.#validateTtlOrThrow(ttlMilliseconds);

    this.#cache.set(key, {
      value,
      expiresAt: Math.min(
        Date.now() + (ttlMilliseconds ?? Number.MAX_SAFE_INTEGER),
        Number.MAX_SAFE_INTEGER,
      ),
    });
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.mdelete([key]);
    return result[key] ?? false;
  }

  async clear(): Promise<void> {
    this.#cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const cacheEntry = this.#cache.get(key);
    if (!cacheEntry) {
      return false;
    }

    if (this.#isExpired(cacheEntry)) {
      this.#cache.delete(key);
      return false;
    }

    return true;
  }

  async keys(): Promise<string[]> {
    await this.#cleanupExpiredEntries();
    return Array.from(this.#cache.keys());
  }

  async size(): Promise<number> {
    await this.#cleanupExpiredEntries();
    return this.#cache.size;
  }

  async peek(key: string): Promise<Serializable | undefined> {
    const cacheEntry = this.#cache.get(key);
    if (!cacheEntry) {
      return undefined;
    }

    if (this.#isExpired(cacheEntry)) {
      this.#cache.delete(key);
      return undefined;
    }

    return cacheEntry.value;
  }

  async mget(
    keys: string[],
  ): Promise<Record<string, Serializable | undefined>> {
    await this.#cleanupExpiredEntries();

    const result: Record<string, Serializable | undefined> = {};

    for (const key of keys) {
      const cacheEntry = this.#cache.get(key);
      if (!cacheEntry) {
        result[key] = undefined;
        continue;
      }

      result[key] = cacheEntry.value;
    }

    return result;
  }

  async mset(
    entries: { key: string; value: Serializable; ttlMilliseconds?: number }[],
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    if (entries.length === 1) {
      assert(entries[0]); // Enforce type narrowing as TS cannot infer that entries[0] is defined
      const { key, value, ttlMilliseconds } = entries[0];
      await this.set(key, value, ttlMilliseconds);
      return;
    }

    entries.forEach(({ ttlMilliseconds }) => {
      this.#validateTtlOrThrow(ttlMilliseconds);
    });

    entries.forEach(({ key, value, ttlMilliseconds }) => {
      if (value === undefined) {
        return;
      }
      this.#cache.set(key, {
        value,
        expiresAt: Math.min(
          Date.now() + (ttlMilliseconds ?? Number.MAX_SAFE_INTEGER),
          Number.MAX_SAFE_INTEGER,
        ),
      });
    });
  }

  async mdelete(keys: string[]): Promise<Record<string, boolean>> {
    return Object.fromEntries(
      keys.map((key) => [key, this.#cache.delete(key)]),
    );
  }
}
