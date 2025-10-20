import type { Json } from '@metamask/snaps-sdk';

/**
 * A primitive value that can be serialized to JSON using the `serialize` function.
 */
export type Serializable =
  | Json
  | undefined
  | null
  | bigint
  | BigNumber
  | Uint8Array
  | Serializable[]
  | {
      [prop: string]: Serializable;
    };

export type TimestampMilliseconds = number;

/**
 * A single cache entry.
 */
export type CacheEntry = {
  value: Serializable;
  expiresAt: TimestampMilliseconds;
};

/**
 * Interface for a generic cache implementation.
 *
 * @template TValue - The type of values stored in the cache
 */
export type ICache<TValue> = {
  /**
   * Retrieves a value from the cache by key.
   *
   * @param key - The key to retrieve
   * @returns The value if found, undefined if not found
   */
  get(key: string): Promise<TValue | undefined>;

  /**
   * Stores a value in the cache with an optional TTL.
   * - If a value is undefined, it will not be stored in the cache.
   * - If a value is null, it will be stored in the cache.
   *
   * @param key - The key to store the value under
   * @param value - The value to store
   * @param ttlMilliseconds - Optional time-to-live in milliseconds. If not provided, the value will not expire.
   * @throws Error if any entry's ttlMilliseconds is not a number, is negative, or is greater than 2^53 - 1
   */
  set(key: string, value: TValue, ttlMilliseconds?: number): Promise<void>;

  /**
   * Removes a value from the cache.
   *
   * @param key - The key to remove
   * @returns true if the key was found and removed, false otherwise
   */
  delete(key: string): Promise<boolean>;

  /**
   * Removes all values from the cache.
   */
  clear(): Promise<void>;

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - The key to check
   * @returns true if the key exists, false otherwise
   */
  has(key: string): Promise<boolean>;

  /**
   * Returns all keys currently in the cache.
   *
   * @returns Array of keys
   */
  keys(): Promise<string[]>;

  /**
   * Returns the number of items in the cache.
   *
   * @returns The number of items
   */
  size(): Promise<number>;

  /**
   * Retrieves a value from the cache without affecting its TTL or last accessed time.
   *
   * @param key - The key to peek at
   * @returns The value if found, undefined if not found
   */
  peek(key: string): Promise<TValue | undefined>;

  /**
   * Retrieves multiple values from the cache in a single operation.
   *
   * @param keys - Array of keys to retrieve
   * @returns Object mapping keys to their values (or undefined if not found)
   */
  mget(keys: string[]): Promise<Record<string, TValue | undefined>>;

  /**
   * Stores multiple values in the cache in a single operation.
   * - If a value is undefined, it will not be stored in the cache.
   * - If a value is null, it will be stored in the cache.
   *
   * @param entries - Array of entries to store, each with key, value, and optional TTL (if not provided, the value will not expire)
   * @throws Error if any entry's ttlMilliseconds is not a number, is negative, or is greater than 2^53 - 1
   */
  mset(
    entries: { key: string; value: TValue; ttlMilliseconds?: number }[],
  ): Promise<void>;

  /**
   * Removes multiple values from the cache.
   *
   * @param keys - Array of keys to remove
   * @returns An object mapping each key to a boolean indicating whether it was found and removed
   */
  mdelete(keys: string[]): Promise<Record<string, boolean>>;
};
